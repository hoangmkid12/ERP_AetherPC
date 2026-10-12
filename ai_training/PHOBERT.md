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

## 5b. Kết quả (chạy 2026-10-12, Google Colab, GPU T4)

File gốc: `results/phobert_results.json`, biểu đồ `results/phobert_confusion_matrix.png`,
`results/phobert_training_loss.png`. Số liệu node-nlp: `backend/src/services/ai/benchmark/RESULTS.md`.

| Chỉ số | node-nlp CV | **PhoBERT CV** | node-nlp TEST | **PhoBERT TEST** |
|---|---|---|---|---|
| Accuracy | 90,3% | **97,0%** | 89,3% | **96,4%** |
| Macro-F1 | 91,1% | **97,0%** | 89,9% | **96,4%** |
| Coverage @0,70 | 92,7% | **97,2%** | 91,1% | **96,4%** |
| Precision @0,70 | 94,9% | **98,0%** | 92,2% | **98,1%** |
| Số câu định tuyến nhầm @0,70 | 22 | **9** | 4 | **1** |

- **Accuracy từng fold (PhoBERT):** 96,9% · 97,9% · 95,7% · 96,7% · 97,8% — trung bình 97,0%,
  độ lệch chuẩn 0,8%. Fold kém nhất của PhoBERT (95,7%) vẫn cao hơn trung bình node-nlp (90,3%).
- **Số câu sai trên CV:** ~14/466 (PhoBERT) so với ~45/466 (node-nlp) — ít lỗi hơn khoảng 3 lần.
- **Bộ TEST:** 6/8 ý định đúng tuyệt đối; 2 câu sai rơi vào đúng cặp node-nlp cũng hay nhầm nhất:
  "kpi cá nhân tháng này đạt bao nhiêu rồi" → FINANCE_REPORT (0,57 — dưới ngưỡng, không bị dùng) và
  "công ty mình có tổng cộng bao nhiêu nhân viên" → MY_PROFILE_TASKS (0,85).
- **Đường loss:** giảm đều 2,02 → 0,09 qua 10 epoch, phẳng dần từ epoch 7 — hội tụ ổn định. (Đây là
  loss trên dữ liệu train; khả năng tổng quát hoá được đánh giá bằng CV và bộ TEST ở trên.)

Đọc kết quả: bộ TEST chỉ 56 câu (mỗi câu ≈ 1,8 điểm %), nên **kết luận dựa trên CV** (466 dự đoán, cùng
fold cho cả hai mô hình). Trên CV, PhoBERT hơn node-nlp ~6,7 điểm accuracy và nhất quán ở cả 5 fold.

**Kết luận:** mô hình ngôn ngữ pre-train cho tiếng Việt (PhoBERT) phân loại ý định chính xác hơn rõ rệt
so với mạng nơ-ron nhỏ huấn luyện từ đầu (node-nlp) trên cùng 466 câu — đúng như kỳ vọng của transfer
learning: PhoBERT đã "hiểu" tiếng Việt từ trước nên tổng quát hoá tốt hơn với câu diễn đạt lạ, không dấu.

## 6. Vì sao không tích hợp PhoBERT vào hệ thống đang chạy

| | node-nlp (đang dùng) | PhoBERT |
|---|---|---|
| Kích thước mô hình | ~0,5 MB | ~540 MB (~135 MB nếu nén int8) |
| RAM khi chạy | Không đáng kể | +300–500 MB |
| Thời gian dự đoán (CPU) | < 5 ms | ~50–100 ms |
| Tách từ | Không cần | Cần (pyvi/VnCoreNLP là thư viện Python/Java — backend là Node.js) |
| Huấn luyện lại | Vài giây, ngay trên máy | Cần GPU (Colab) |

Kết quả mục 5b cho thấy PhoBERT **vượt rõ rệt** (97,0% so với 90,3% trên CV), nên về độ chính xác thì
tích hợp là xứng đáng. Hệ thống hiện chưa tích hợp vì chi phí vận hành: mô hình nặng hơn ~1.000 lần,
cần thêm ~300–500 MB RAM trên server và bước tách từ bằng Python trong khi backend là Node.js. Ngoài ra,
mô hình phân loại chỉ là một tầng trong pipeline (trước nó còn tầng quy tắc + vector theo kỹ năng), nên
mức cải thiện trên toàn hệ thống sẽ nhỏ hơn mức chênh 6,7 điểm của riêng bộ phân loại.

**Hướng phát triển tiếp theo:** xuất ONNX (cell cuối notebook, nén int8 còn ~135 MB) → chạy bằng
`onnxruntime-node`; tách từ bằng một dịch vụ Python nhỏ, hoặc fine-tune lại không tách từ để bỏ phụ
thuộc pyvi; giữ node-nlp làm phương án dự phòng khi PhoBERT chưa sẵn sàng.

## 6b. Demo khi trình bày

Bộ câu `backend/src/services/ai/benchmark/demo_cases.json` (18 câu, **không có trong dữ liệu train**):
câu thường, không dấu, văn nói/viết tắt, gõ sai chính tả, các cặp dễ nhầm, trò chuyện.

- **node-nlp (mô hình đang chạy thật):** `cd backend && npm run ai:demo` — hoặc thử 1 câu:
  `npm run ai:demo -- "câu hỏi bất kỳ"`. Kết quả hiện tại: đúng 17/18.
- **PhoBERT:** ô **DEMO 1** trong notebook chạy cùng bộ câu; ô **DEMO 2** có hàm `thu('...')` để gõ câu
  bất kỳ. Lưu mô hình vào Google Drive một lần (ô "Lưu mô hình"), hôm trình bày chỉ cần chạy ô 1–4
  rồi ô "Nạp mô hình" — không phải train lại.

Câu node-nlp sai — *"đh DH-5521 ship tới đâu r"* → MY_PROFILE_TASKS với độ tin cậy 1,00 — là ví dụ tốt
để giải thích kiến trúc nhiều tầng: trong hệ thống thật, quy tắc `intentGuards` nhận ra mã đơn `DH-…`
và đưa thẳng vào tra cứu đơn **trước** khi tới bộ phân loại, nên câu này vẫn được trả lời đúng.

## 7. Câu hỏi hội đồng có thể hỏi

- **PhoBERT tốt hơn vậy sao hệ thống không dùng?** Đánh đổi giữa độ chính xác và chi phí vận hành:
  PhoBERT hơn ~6,7 điểm nhưng nặng hơn ~1.000 lần, cần thêm RAM server và một dịch vụ Python để tách từ.
  Bộ phân loại chỉ là một tầng trong pipeline nên lợi ích trên toàn hệ thống nhỏ hơn. Thử nghiệm này
  cung cấp số liệu để quyết định tích hợp ở giai đoạn sau, khi quy mô người dùng tăng.
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
