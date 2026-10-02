import os
import json
import torch
from pyvi import ViTokenizer
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import onnx
import onnxruntime as ort
import numpy as np

MODEL_DIR = os.path.join(os.path.dirname(__file__), 'model_checkpoint')
ONNX_PATH = os.path.join(MODEL_DIR, 'phobert_intent.onnx')

def export_to_onnx():
    print("📦 Bắt đầu xuất mô hình PhoBERT sang định dạng ONNX...")
    
    # 1. Load Tokenizer & Model đã train
    tokenizer = AutoTokenizer.from_pretrained(MODEL_DIR)
    model = AutoModelForSequenceClassification.from_pretrained(MODEL_DIR)
    model.eval()

    # 2. Tạo input giả lập (Dummy Input) cho việc export ONNX
    dummy_text = "quy chuẩn đóng gói thùng xốp card màn hình"
    segmented = ViTokenizer.tokenize(dummy_text)
    inputs = tokenizer(
        segmented,
        max_length=128,
        padding='max_length',
        truncation=True,
        return_tensors='pt'
    )

    input_ids = inputs['input_ids']
    attention_mask = inputs['attention_mask']

    # 3. Export sang file ONNX
    torch.onnx.export(
        model,
        (input_ids, attention_mask),
        ONNX_PATH,
        export_params=True,
        opset_version=14,
        do_constant_folding=True,
        input_names=['input_ids', 'attention_mask'],
        output_names=['logits'],
        dynamic_axes={
            'input_ids': {0: 'batch_size', 1: 'sequence_length'},
            'attention_mask': {0: 'batch_size', 1: 'sequence_length'},
            'logits': {0: 'batch_size'}
        }
    )

    print(f"✅ Đã xuất thành công file ONNX tại: {ONNX_PATH}")

    # 4. Kiểm tra tính toàn vẹn của mô hình ONNX
    onnx_model = onnx.load(ONNX_PATH)
    onnx.checker.check_model(onnx_model)
    print("🔍 Đã kiểm tra tính toàn vẹn của file ONNX (Model Check OK)!")

    # 5. Chạy thử nghiệm Inference bằng ONNX Runtime
    print("\n--- CHẠY THỬ NGHIỆM INFERENCE ONNX ---")
    session = ort.InferenceSession(ONNX_PATH)
    
    # Load label mapping
    mapping_path = os.path.join(MODEL_DIR, 'label_mapping.json')
    with open(mapping_path, 'r', encoding='utf-8') as f:
        mapping = json.load(f)
    id2label = {int(k): v for k, v in mapping['id2label'].items()}

    test_queries = [
        "tôi là ai và hôm nay tôi bán được bao nhiêu",
        "quy chuẩn bọc thùng xốp linh kiện pc",
        "tra cứu tiến độ đơn hàng DH-1002",
        "card rtx 4070 còn tồn kho mấy cái",
        "i5 13400 cần nguồn bao nhiêu watt",
        "doanh thu hôm nay của công ty được bao nhiêu"
    ]

    for q in test_queries:
        seg = ViTokenizer.tokenize(q)
        encoded = tokenizer(seg, max_length=128, padding='max_length', truncation=True, return_tensors='np')
        
        ort_inputs = {
            'input_ids': encoded['input_ids'].astype(np.int64),
            'attention_mask': encoded['attention_mask'].astype(np.int64)
        }
        
        ort_outputs = session.run(['logits'], ort_inputs)
        logits = ort_outputs[0]
        pred_id = int(np.argmax(logits, axis=1)[0])
        pred_label = id2label.get(pred_id, 'UNKNOWN')
        confidence = float(np.max(np.exp(logits) / np.sum(np.exp(logits))))

        print(f"Query: \"{q}\"")
        print(f"  --> Predicted: {pred_label} (Confidence: {confidence:.2%})\n")

if __name__ == '__main__':
    export_to_onnx()
