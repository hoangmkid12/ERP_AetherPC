import json
import os
import torch
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from pyvi import ViTokenizer
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score, f1_score
from torch.utils.data import Dataset, DataLoader
from transformers import AutoTokenizer, AutoModelForSequenceClassification, AdamW, get_linear_schedule_with_warmup

# Cấu hình thiết bị (Ưu tiên GPU CUDA nếu có, fallback sang CPU)
DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
MODEL_NAME = 'vinai/phobert-base-v2'
BATCH_SIZE = 8
MAX_LEN = 128
EPOCHS = 6
LEARNING_RATE = 2e-5
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), 'model_checkpoint')
os.makedirs(OUTPUT_DIR, exist_ok=True)

class ERPIntentDataset(Dataset):
    def __init__(self, texts, labels, tokenizer, max_len=128):
        self.texts = texts
        self.labels = labels
        self.tokenizer = tokenizer
        self.max_len = max_len

    def __len__(self):
        return len(self.texts)

    def __getitem__(self, item):
        text = str(self.texts[item])
        # Tách từ tiếng Việt bằng pyvi chuẩn PhoBERT
        segmented_text = ViTokenizer.tokenize(text)
        
        encoding = self.tokenizer(
            segmented_text,
            truncation=True,
            max_length=self.max_len,
            padding='max_length',
            return_token_type_ids=False,
            return_attention_mask=True,
            return_tensors='pt',
        )

        return {
            'text': text,
            'input_ids': encoding['input_ids'].flatten(),
            'attention_mask': encoding['attention_mask'].flatten(),
            'labels': torch.tensor(self.labels[item], dtype=torch.long)
        }

def load_data():
    dataset_path = os.path.join(os.path.dirname(__file__), 'dataset_intent.json')
    with open(dataset_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    df = pd.DataFrame(data)
    labels = sorted(df['intent'].unique())
    label2id = {label: i for i, label in enumerate(labels)}
    id2label = {i: label for i, label in enumerate(labels)}

    # Lưu label mapping để Backend Node.js / Inference sử dụng
    mapping_path = os.path.join(OUTPUT_DIR, 'label_mapping.json')
    with open(mapping_path, 'w', encoding='utf-8') as f:
        json.dump({'label2id': label2id, 'id2label': id2label}, f, ensure_ascii=False, indent=2)

    df['label_id'] = df['intent'].map(label2id)
    return df, label2id, id2label

def train_epoch(model, data_loader, optimizer, scheduler, device, n_examples):
    model = model.train()
    losses = []
    correct_predictions = 0

    for d in data_loader:
        input_ids = d['input_ids'].to(device)
        attention_mask = d['attention_mask'].to(device)
        labels = d['labels'].to(device)

        outputs = model(
            input_ids=input_ids,
            attention_mask=attention_mask,
            labels=labels
        )

        loss = outputs.loss
        logits = outputs.logits
        _, preds = torch.max(logits, dim=1)

        correct_predictions += torch.sum(preds == labels)
        losses.append(loss.item())

        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
        optimizer.step()
        scheduler.step()
        optimizer.zero_grad()

    return correct_predictions.double() / n_examples, np.mean(losses)

def eval_model(model, data_loader, device, n_examples):
    model = model.eval()
    losses = []
    correct_predictions = 0
    all_preds = []
    all_labels = []

    with torch.no_grad():
        for d in data_loader:
            input_ids = d['input_ids'].to(device)
            attention_mask = d['attention_mask'].to(device)
            labels = d['labels'].to(device)

            outputs = model(
                input_ids=input_ids,
                attention_mask=attention_mask,
                labels=labels
            )

            loss = outputs.loss
            logits = outputs.logits
            _, preds = torch.max(logits, dim=1)

            correct_predictions += torch.sum(preds == labels)
            losses.append(loss.item())
            all_preds.extend(preds.cpu().tolist())
            all_labels.extend(labels.cpu().tolist())

    return correct_predictions.double() / n_examples, np.mean(losses), all_preds, all_labels

def main():
    print(f"🚀 Khởi động Pipeline Huấn luyện PhoBERT trên thiết bị: {DEVICE}")
    df, label2id, id2label = load_data()
    num_classes = len(label2id)
    print(f"📊 Tổng số mẫu dữ liệu: {len(df)} | Số lượng Intent: {num_classes}")

    # Chia dữ liệu Train (80%), Val (10%), Test (10%)
    train_df, test_df = train_test_split(df, test_size=0.2, random_state=42, stratify=df['label_id'])
    val_df, test_df = train_test_split(test_df, test_size=0.5, random_state=42, stratify=test_df['label_id'])

    print(f"📦 Train: {len(train_df)} mẫu | Val: {len(val_df)} mẫu | Test: {len(test_df)} mẫu")

    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
    model = AutoModelForSequenceClassification.from_pretrained(
        MODEL_NAME,
        num_labels=num_classes,
        id2label=id2label,
        label2id=label2id
    )
    model = model.to(DEVICE)

    train_dataset = ERPIntentDataset(train_df['text'].values, train_df['label_id'].values, tokenizer, MAX_LEN)
    val_dataset = ERPIntentDataset(val_df['text'].values, val_df['label_id'].values, tokenizer, MAX_LEN)
    test_dataset = ERPIntentDataset(test_df['text'].values, test_df['label_id'].values, tokenizer, MAX_LEN)

    train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=BATCH_SIZE)
    test_loader = DataLoader(test_dataset, batch_size=BATCH_SIZE)

    optimizer = AdamW(model.parameters(), lr=LEARNING_RATE, correct_bias=False)
    total_steps = len(train_loader) * EPOCHS
    scheduler = get_linear_schedule_with_warmup(
        optimizer,
        num_warmup_steps=int(total_steps * 0.1),
        num_training_steps=total_steps
    )

    history = {'train_acc': [], 'train_loss': [], 'val_acc': [], 'val_loss': []}
    best_f1 = 0

    print("\n================ BẮT ĐẦU HUẤN LUYỆN ================")
    for epoch in range(EPOCHS):
        print(f"\n--- Epoch {epoch + 1}/{EPOCHS} ---")
        train_acc, train_loss = train_epoch(model, train_loader, optimizer, scheduler, DEVICE, len(train_df))
        print(f"Train loss: {train_loss:.4f} | Train accuracy: {train_acc:.4f}")

        val_acc, val_loss, val_preds, val_labels = eval_model(model, val_loader, DEVICE, len(val_df))
        val_f1 = f1_score(val_labels, val_preds, average='weighted')
        print(f"Val loss: {val_loss:.4f} | Val accuracy: {val_acc:.4f} | Val F1: {val_f1:.4f}")

        history['train_acc'].append(train_acc.item() if hasattr(train_acc, 'item') else train_acc)
        history['train_loss'].append(train_loss)
        history['val_acc'].append(val_acc.item() if hasattr(val_acc, 'item') else val_acc)
        history['val_loss'].append(val_loss)

        if val_f1 > best_f1:
            best_f1 = val_f1
            torch.save(model.state_dict(), os.path.join(OUTPUT_DIR, 'best_model_state.bin'))
            tokenizer.save_pretrained(OUTPUT_DIR)
            model.save_pretrained(OUTPUT_DIR)
            print(f"⭐ Đã lưu checkpoint tốt nhất tại epoch {epoch + 1} (F1: {val_f1:.4f})")

    print("\n================ ĐÁNH GIÁ TRÊN TẬP TEST ================")
    # Load model tốt nhất
    model.load_state_dict(torch.load(os.path.join(OUTPUT_DIR, 'best_model_state.bin'), map_location=DEVICE))
    test_acc, test_loss, test_preds, test_labels = eval_model(model, test_loader, DEVICE, len(test_df))
    test_f1 = f1_score(test_labels, test_preds, average='weighted')

    print(f"\n🎯 KẾT QUẢ TẬP TEST: Accuracy = {test_acc:.4f} | Weighted F1-Score = {test_f1:.4f}")
    target_names = [id2label[i] for i in range(num_classes)]
    report = classification_report(test_labels, test_preds, target_names=target_names, zero_division=0)
    print("\nBảng đánh giá chi tiết (Classification Report):\n")
    print(report)

    # Lưu báo cáo vào text file
    with open(os.path.join(OUTPUT_DIR, 'classification_report.txt'), 'w', encoding='utf-8') as f:
        f.write(report)

    # Vẽ biểu đồ Confusion Matrix
    cm = confusion_matrix(test_labels, test_preds)
    plt.figure(figsize=(10, 8))
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', xticklabels=target_names, yticklabels=target_names)
    plt.title('Ma Trận Nhầm Lẫn (Confusion Matrix) - PhoBERT Intent Classification', fontsize=12)
    plt.xlabel('Dự đoán (Predicted Label)')
    plt.ylabel('Thực tế (True Label)')
    plt.xticks(rotation=45, ha='right')
    plt.tight_layout()
    cm_path = os.path.join(OUTPUT_DIR, 'confusion_matrix.png')
    plt.savefig(cm_path, dpi=300)
    print(f"📊 Đã lưu ma trận nhầm lẫn tại: {cm_path}")

    # Vẽ biểu đồ Loss & Accuracy qua các Epochs
    plt.figure(figsize=(12, 5))
    plt.subplot(1, 2, 1)
    plt.plot(history['train_loss'], label='Train Loss', color='blue', marker='o')
    plt.plot(history['val_loss'], label='Val Loss', color='orange', marker='s')
    plt.title('Đồ Thị Hàm Mất Mát (Loss Curves)')
    plt.xlabel('Epoch')
    plt.ylabel('Loss')
    plt.legend()
    plt.grid(True)

    plt.subplot(1, 2, 2)
    plt.plot(history['train_acc'], label='Train Accuracy', color='blue', marker='o')
    plt.plot(history['val_acc'], label='Val Accuracy', color='green', marker='s')
    plt.title('Đồ Thị Độ Chính Xác (Accuracy Curves)')
    plt.xlabel('Epoch')
    plt.ylabel('Accuracy')
    plt.legend()
    plt.grid(True)

    plt.tight_layout()
    curves_path = os.path.join(OUTPUT_DIR, 'training_curves.png')
    plt.savefig(curves_path, dpi=300)
    print(f"📈 Đã lưu đồ thị quá trình huấn luyện tại: {curves_path}")
    print("\n✅ Hoàn thành xuất sắc Pipeline Huấn luyện mô hình!")

if __name__ == '__main__':
    main()
