# Thử nghiệm PhoBERT cho bài toán phân loại ý định

Mục tiêu: fine-tune PhoBERT trên cùng bài toán mà mô hình `node-nlp` của AetherCopilot đang giải
(phân loại câu hỏi của nhân viên vào 8 ý định), rồi **so sánh công bằng** hai mô hình. Đây là phần
nghiên cứu/thử nghiệm — PhoBERT **không** được tích hợp vào hệ thống đang chạy (lý do ở mục 6).

Cách chạy: mở `Train_PhoBERT_KLTN.ipynb` trên Google Colab → `Runtime → Change runtime type → T4 GPU`
→ `Run all` (~10–15 phút). Cell cuối tải về `phobert_results.json` và 2 biểu đồ.

## 1. PhoBERT là gì

- Mô hình ngôn ngữ **pre-trained cho tiếng Việt** của VinAI (Nguyen & Nguyen, 2020), kiến trúc
  **RoBERTa** — một biến thể của BERT (Transformer encoder, chỉ có phần mã hoá).
- Bản `phobert-base-v2`: 12 lớp Transformer, ~135 triệu tham số, pre-train trên khoảng 20GB văn bản
  tiếng Việt (Wikipedia + tin tức) và 120GB dữ liệu OSCAR.
- Pre-train bằng **Masked Language Modeling**: che ngẫu nhiên một số từ trong câu và bắt mô hình đoán
  lại → mô hình học được ngữ nghĩa và ngữ pháp tiếng Việt mà không cần dữ liệu gán nhãn.

## 2. Fine-tuning là gì và vì sao phù hợp

- **Pre-train** (VinAI đã làm, rất tốn tài nguyên): học hiểu tiếng Việt nói chung.
- **Fine-tune** (notebook này làm): gắn thêm một **lớp phân loại** (classification head — một lớp
  tuyến tính nhận vector biểu diễn của token `<s>` và cho ra 8 điểm số, một điểm cho mỗi ý định),
  rồi huấn luyện tiếp toàn bộ mô hình trên dữ liệu gán nhãn của mình.
- Nhờ đã "hiểu tiếng Việt" từ trước, chỉ cần vài trăm câu gán nhãn là đủ — đây là ý tưởng của
  **transfer learning** (học chuyển giao).

## 3. Tách từ tiếng Việt (word segmentation)

Tiếng Việt viết tách theo âm tiết, nhưng một từ có thể gồm nhiều âm tiết (*bảo hành*, *doanh thu*).
PhoBERT được pre-train trên văn bản **đã tách từ**, các âm tiết của một từ nối bằng `_`:

```
"chính sách bảo hành đổi trả"  →  "chính_sách bảo_hành đổi_trả"
```

Vì vậy đầu vào khi fine-tune cũng phải tách từ giống vậy. Notebook dùng **pyvi**; nhóm tác giả
PhoBERT khuyến nghị VnCoreNLP (RDRSegmenter) — pyvi gọn hơn để cài trên Colab, kết quả gần tương đương.
Sau khi tách từ, tokenizer của PhoBERT (BPE — Byte Pair Encoding) cắt tiếp thành các đơn vị con.

## 4. Thiết lập huấn luyện

| Tham số | Giá trị | Lý do |
|---|---|---|
| `max_len` | 64 token | Câu hỏi ngắn (< 30 từ) |
| `batch_size` | 16 | Vừa bộ nhớ GPU T4, ổn định gradient |
| `epochs` | 10 | Dữ liệu nhỏ (466 câu) cần nhiều lượt; loss hội tụ trước epoch 10 (xem biểu đồ loss) |
| `learning_rate` | 3e-5 | Khoảng khuyến nghị cho fine-tune BERT/RoBERTa (2e-5 – 5e-5) |
| Optimizer | AdamW, weight decay 0,01 | Chuẩn cho Transformer; weight decay chống overfit |
| Lịch learning rate | warmup 10% rồi giảm tuyến tính | Tránh làm hỏng trọng số pre-train ở các bước đầu |
| Gradient clipping | 1,0 | Chống gradient bùng nổ |
| Seed | 42 | Chạy lại ra cùng kết quả |
| Hàm mất mát | Cross-entropy | Chuẩn cho phân loại nhiều lớp |
| Độ tin cậy | Xác suất lớn nhất sau softmax | So với ngưỡng 0,70 giống controller của backend |

Vòng lặp huấn luyện viết tay bằng PyTorch (không dùng `Trainer` của HuggingFace) để thấy rõ từng
bước: forward → tính loss → `backward()` → cập nhật trọng số → cập nhật learning rate.

## 5. Phương pháp đánh giá — so sánh công bằng với node-nlp

Hai mô hình được đánh giá trên **cùng** dữ liệu và **cùng** cách chia:

- **Dữ liệu train**: `backend/src/services/ai/data/dataset_intent.json` (466 câu, 8 ý định).
- **Cross-validation 5 fold**: dùng `cv_folds.json` — xuất từ bộ đánh giá của node-nlp
  (`npm run ai:eval -- --export-folds`), nên hai mô hình train/test trên **đúng cùng các fold**.
- **Bộ TEST khoá**: `backend/src/services/ai/benchmark/intent_test_locked.json` (56 câu, 7 câu/ý định),
  viết trước khi mở rộng dữ liệu, không bao giờ dùng để train hay chỉnh tham số. Notebook dừng nếu
  phát hiện câu TEST lọt vào dữ liệu train.
- **Chỉ số**: Accuracy, Macro-F1, và tại ngưỡng 0,70: Coverage (tỷ lệ câu đủ tự tin để dùng) và
  Precision (trong số đó, tỷ lệ đúng — sai ở đây nghĩa là định tuyến nhầm).

Kết quả node-nlp (đã có, xem `backend/src/services/ai/benchmark/RESULTS.md`):

| Chỉ số | node-nlp CV | PhoBERT CV | node-nlp TEST | PhoBERT TEST |
|---|---|---|---|---|
| Accuracy | 90,3% | *(điền sau khi chạy)* | 89,3% | *(điền)* |
| Macro-F1 | 91,1% | | 89,9% | |
| Coverage @0,70 | 92,7% | | 91,1% | |
| Precision @0,70 | 94,9% | | 92,2% | |

Lưu ý khi đọc kết quả: bộ TEST chỉ 56 câu — mỗi câu ≈ 1,8 điểm phần trăm, nên chênh lệch 1–2 câu
giữa hai mô hình chưa đủ để kết luận mô hình nào tốt hơn. Kết quả CV (466 dự đoán) đáng tin hơn;
notebook in thêm độ lệch chuẩn accuracy giữa 5 fold.

## 6. Vì sao không tích hợp PhoBERT vào hệ thống đang chạy

| | node-nlp (đang dùng) | PhoBERT |
|---|---|---|
| Kích thước mô hình | ~0,5 MB | ~540 MB (~135 MB nếu nén int8) |
| RAM khi chạy | Không đáng kể | +300–500 MB |
| Thời gian dự đoán (CPU) | < 5 ms | ~50–100 ms |
| Tách từ | Không cần | Cần (pyvi/VnCoreNLP là thư viện Python/Java — backend là Node.js) |
| Huấn luyện lại | Vài giây, ngay trên máy | Cần GPU (Colab) |

Với 8 ý định và câu hỏi ngắn, mô hình nhỏ đã đạt ~90%; PhoBERT tốn tài nguyên hơn hàng trăm lần.
Tích hợp chỉ đáng làm khi PhoBERT cho kết quả **vượt rõ rệt** trên CV — hoặc khi bài toán mở rộng
(phân loại thẳng vào ~95 kỹ năng thay vì 8 ý định, dữ liệu vài nghìn câu). Hướng tích hợp khi cần:
xuất ONNX (cell cuối notebook) → chạy bằng `onnxruntime-node`; tách từ bằng một dịch vụ Python nhỏ,
hoặc fine-tune lại không tách từ để bỏ phụ thuộc pyvi.

## 7. Câu hỏi hội đồng có thể hỏi

- **Vì sao không train PhoBERT từ đầu?** Pre-train cần hàng chục GB văn bản và nhiều GPU trong nhiều
  ngày; fine-tune tận dụng kiến thức đã học, chỉ cần vài trăm câu và vài phút GPU.
- **466 câu có đủ không?** Cho 8 ý định (~40–80 câu/ý định) là đủ để fine-tune; đánh giá bằng
  cross-validation để kết quả không phụ thuộc một lần chia ngẫu nhiên.
- **Làm sao biết không bị rò rỉ dữ liệu test?** Bộ TEST viết trước, kiểm tra trùng tự động (cả không
  dấu), lọc câu giống > 0,5 theo trigram khi thêm dữ liệu, notebook kiểm tra lại trước khi train.
- **Vì sao dùng Macro-F1?** Các ý định có số mẫu khác nhau (38–81); Macro-F1 lấy trung bình F1 từng ý
  định nên ý định ít mẫu không bị ý định nhiều mẫu lấn át như Accuracy.
- **Độ tin cậy 0,70 lấy ở đâu?** Là ngưỡng controller dùng để quyết định tin kết quả mô hình; đường
  cong Coverage/Precision theo ngưỡng được tính trên CV (không dùng TEST) để chọn ngưỡng.

> Ghi chú: `train_phobert.py` / `export_onnx.py` là phiên bản script cũ (chia ngẫu nhiên 80/10/10);
> notebook `Train_PhoBERT_KLTN.ipynb` là phiên bản dùng cho so sánh trong báo cáo.
