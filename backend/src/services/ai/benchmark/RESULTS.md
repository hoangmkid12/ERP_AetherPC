# Đánh giá AetherCopilot — kết quả & cách chạy lại

Ngày đánh giá: 2026-10-12. Mọi bộ kiểm thử nằm trong thư mục này và chạy lại được.

## 1. Độ chính xác hiểu câu hỏi (held-out)

`heldout_cases.js` gồm 2 bộ câu hỏi **diễn đạt khác với dữ liệu huấn luyện**:

- **DEV** (26 câu): dùng để phân tích lỗi và tinh chỉnh ngưỡng / quy tắc.
- **TEST** (40 câu): viết và **khoá trước khi tinh chỉnh**, không dùng để chỉnh — chỉ báo cáo.

Chỉ số: *Đúng* (chọn đúng kỹ năng / từ chối đúng câu vượt quyền hoặc ngoài phạm vi),
*Sai tự tin* (trả lời SUCCESS nhưng sai kỹ năng, hoặc trả lời câu lẽ ra phải từ chối —
loại lỗi nguy hiểm nhất), *Từ chối thừa* (câu trả lời được nhưng hệ thống báo chưa chắc).

| Bộ   | Thời điểm        | Đúng          | Sai tự tin   | Từ chối thừa | Chặn quyền sai |
|------|------------------|---------------|--------------|--------------|----------------|
| DEV  | Trước cải tiến   | 19/26 (73,1%) | 6/26 (23,1%) | 1/26 (3,8%)  | 0              |
| DEV  | Sau cải tiến*    | 26/26 (100%)  | 0            | 0            | 0              |
| TEST | Trước cải tiến   | 32/40 (80,0%) | 6/40 (15,0%) | 2/40 (5,0%)  | 0              |
| TEST | **Sau cải tiến** | **34/40 (85,0%)** | **2/40 (5,0%)** | 4/40 (10,0%) | 0          |

\* Kết quả DEV sau cải tiến lạc quan vì đã tinh chỉnh trên chính bộ này — **số liệu nên báo
cáo là của bộ TEST**.

Cải tiến chính: tỷ lệ *sai tự tin* trên TEST giảm từ 15% xuống 5%, đổi lại tỷ lệ "chưa
chắc chắn, mời diễn đạt lại" tăng 5 điểm — với hệ thống ERP, hỏi lại an toàn hơn hiện
một con số sai.

Các câu TEST còn sai (để phát triển tiếp, không chỉnh theo):
- "giá con i7 14700k bên mình bán nhiêu" → nhầm sang tư vấn tương thích
- "đang có chương trình giảm giá gì không" → nhầm sang tra giá sản phẩm
- 4 câu báo "chưa chắc chắn" dù trả lời được (chính sách đổi trả, tỷ lệ phương thức
  thanh toán, số người mỗi phòng ban, cách đóng thùng máy)

Thay đổi đã áp dụng:
- Ngưỡng cosine 0,38 → 0,42 và yêu cầu khoảng cách tới ý định thứ 2 ≥ 0,05
  (`matcher/vectorMatcher.js`); ngưỡng đồng thuận vector+NLP 0,20 → 0,5.
- Quy tắc định tuyến theo tín hiệu rõ ràng (`actors/intentGuards.js`): mã đơn → tra đơn;
  hỏi tương thích / công suất nguồn; chiết khấu VIP; câu hỏi quy trình → SOP; kỳ thời
  gian phải khớp kỹ năng doanh thu (nhận cả không dấu / gõ thiếu 1 ký tự).
- Thêm kỹ năng `YESTERDAY_REVENUE`.

Lưu ý phương pháp: đây là đánh giá **khâu chọn kỹ năng** của tầng offline với DB giả —
không đo chất lượng câu trả lời do Gemini sinh ra.

## 1b. Mô hình phân loại ý định tự huấn luyện (node-nlp, chạy cục bộ)

Mô hình mạng nơ-ron nhỏ của thư viện `node-nlp`, huấn luyện cục bộ (không gọi API ngoài)
trên `../data/dataset_intent.json`, phân loại câu hỏi vào 8 ý định để định tuyến trong
`ai.controller.js` (chỉ dùng kết quả khi độ tin cậy ≥ 0,70).

Phương pháp (`nlp_intent_eval.js`):
- **K-fold phân tầng 5 phần**, xáo trộn bằng seed cố định (chạy lại ra cùng kết quả).
- **Bộ TEST khoá** `intent_test_locked.json`: 56 câu (7 câu/ý định), viết TRƯỚC khi mở rộng
  dữ liệu, có câu không dấu / văn nói / viết tắt. Script dừng nếu câu TEST lọt vào dữ liệu
  train; khi mở rộng dữ liệu, mọi câu giống câu TEST (trigram Jaccard ≥ 0,5, không phân biệt
  dấu) bị loại tự động (34 câu bị loại).
- Dữ liệu bổ sung đợt 2 dựa trên lỗi của cross-validation, **không** dựa trên lỗi bộ TEST.

| Chỉ số | 170 câu (ban đầu) | 466 câu (mở rộng) |
|---|---|---|
| CV Accuracy | 82,9% | **90,3%** |
| CV Macro-F1 | 83,5% | **91,1%** |
| CV Precision @0,70 (đúng trong số câu mô hình đủ tự tin) | 87,9% | **94,9%** |
| TEST Accuracy | 85,7% | **89,3%** |
| TEST Macro-F1 | 86,3% | **89,9%** |
| TEST Coverage @0,70 (tỷ lệ câu đủ tự tin để dùng) | 83,9% | **91,1%** |
| TEST Precision @0,70 | 95,7% (2 nhầm) | 92,2% (4 nhầm) |

Lưu ý khi báo cáo: Precision @0,70 trên TEST giảm nhẹ, nhưng TEST chỉ 56 câu nên chênh
2 câu nằm trong dao động; trên CV (466 dự đoán) chỉ số này tăng 87,9% → 94,9%. Giữ ngưỡng
0,70 vì đường cong trên CV khá phẳng (0,85 chỉ giảm 22 → 13 câu nhầm nhưng mất ~7% độ phủ —
các câu đó sẽ rơi xuống tầng Gemini, tốn lượt gọi API).

Lỗi còn lại trên TEST tập trung ở MY_PROFILE_TASKS ↔ HR_STAFF_COUNT (câu có "nhân viên",
"cá nhân") và PRODUCT_LOOKUP ↔ PC_COMPATIBILITY (câu hỏi tồn kho dạng "có ... không").

Sửa lỗi triển khai: trước đây `model.nlp` bị `.gitignore` bỏ qua và dataset nằm ở
`ai_training/` ngoài build context Docker (`./backend`) → trên server không có mô hình lẫn
dữ liệu, bước phân loại cục bộ bị bỏ qua hoàn toàn. Nay dataset nằm trong backend và
`model.nlp` (đúng bản đã đánh giá) được đưa vào git.

Huấn luyện lại: `cd backend && npm run ai:train` (đánh giá + lưu mô hình), `npm run ai:eval`
(chỉ đánh giá), thêm `--cv-errors` để xem lỗi CV theo cặp ý định.

## 1c. So sánh với PhoBERT (thử nghiệm, chưa tích hợp)

Fine-tune `vinai/phobert-base-v2` trên Google Colab (GPU T4) với **cùng 466 câu, cùng 5 fold**
(`../data/cv_folds.json`) và **cùng bộ TEST khoá** — notebook `ai_training/Train_PhoBERT_KLTN.ipynb`,
chi tiết & kết quả gốc trong `ai_training/PHOBERT.md` và `ai_training/results/`.

| Chỉ số | node-nlp | PhoBERT |
|---|---|---|
| CV Accuracy | 90,3% | **97,0%** (5 fold: 95,7–97,9%, độ lệch chuẩn 0,8%) |
| CV Macro-F1 | 91,1% | **97,0%** |
| CV Precision @0,70 | 94,9% | **98,0%** |
| CV định tuyến nhầm @0,70 | 22 | **9** |
| TEST Accuracy | 89,3% | **96,4%** |
| TEST Precision @0,70 | 92,2% | **98,1%** |

PhoBERT chính xác hơn rõ rệt và nhất quán ở cả 5 fold. Hệ thống vẫn dùng node-nlp vì chi phí vận
hành (mô hình ~540 MB so với ~0,5 MB, thêm ~300–500 MB RAM, cần tách từ bằng Python); tích hợp PhoBERT
là hướng phát triển tiếp theo.

## 1d. Sinh SQL từ câu hỏi (Gemini + mô tả DB)

`sql_generation_eval.js`: 17 câu hỏi (CEO / Kế toán / Kho), mỗi câu có SQL đáp án viết tay; tính
ĐÚNG khi SQL hệ thống sinh ra chạy được và cho cùng kết quả với đáp án. Model `gemini-3.5-flash-lite`.

| | Trước | Sau |
|---|---|---|
| Đúng | 10/17 (59%) | **15/17** lần chạy đầu → **17/17** sau 2 chỉnh sửa* |
| Chạy được (không lỗi SQL) | 12/17 | **17/17** |
| Vòng tự sửa: sửa đúng SQL lỗi cố ý | — | **3/3** |

\* 2 chỉnh sửa sau khi xem kết quả: (1) đáp án câu "5 PO giao sớm nhất" thêm cột `po_number`
(hệ thống trả đúng 5 PO, đúng thứ tự, nhưng theo `po_number` thay vì `id`); (2) bỏ qua SQL soạn
sẵn khi câu hỏi đòi tính tổng/đếm mà mẫu không có hàm tính. Vì chỉnh sau khi xem kết quả và bộ
câu hỏi nhỏ, **con số khách quan để báo cáo là 10/17 → 15/17**.

Nguyên nhân lỗi trước khi sửa và cách sửa:
- Mô tả DB viết tay lệch với DB thật (cột không tồn tại `orders.channel`,
  `purchase_orders.expected_date`, `products.warranty_months`, `order_items.total`; giá trị trạng
  thái sai như `payment_method = 'VIETQR'/'MOMO'`; chỉ 16/55 bảng) → **mô tả tự sinh từ DB thật**
  (`schemaIntrospector.js`): bảng, cột, khoá chính/ngoại và giá trị trạng thái thật, chỉ gồm những
  gì vai trò được đọc.
- Hàm và mô tả DB không được export → màn hình huấn luyện nhận `undefined` (gợi ý SQL lỗi 500,
  nút "Sửa SQL" gửi `undefined` cho Gemini) → export đúng.
- Bước "chữa tên cột" phá cột thật (`total_price` → `total_amount`; nút "Sửa SQL" đổi mọi
  `amount`/`quantity`) → bỏ, thay bằng **vòng tự sửa**: gửi lỗi thật của PostgreSQL cho Gemini
  sửa, tối đa 2 lần (`generateValidatedSql`, `repairSqlWithGemini`).
- Màn hình huấn luyện trả SQL "dự phòng" chung chung khi không sinh được (sai câu hỏi) → báo rõ
  "chưa sinh được SQL".

## 2. Bảo mật

| Bộ kiểm thử | Nội dung | Kết quả |
|---|---|---|
| `security_sql_test.js` — lớp ứng dụng | SQL do AI sinh: vượt quyền bảng theo vai trò, cột bí mật, lấy cả dòng, CTE/subquery giấu bảng, ghi dữ liệu, hàm hệ thống, nhiều câu lệnh, comment... | 51/51 |
| `security_sql_test.js` — lớp DB | User `aether_ai_readonly`: không ghi, không đọc cột bí mật / bảng cấu hình / hàm hệ thống | 9/9 |
| `chat_rbac_test.js` | Toàn bộ luồng chat: shipper / sales / kho / HR hỏi dữ liệu vượt quyền, prompt injection, tra đơn của người khác | 12/12 |
| `cache_isolation_test.js` | Cache không trả câu trả lời của người này cho người khác | Đạt |

## 3. Các bộ kiểm thử có sẵn (đã sửa để kiểm tra đúng nội dung)

| Bộ | Kết quả | Ghi chú |
|---|---|---|
| `benchmark_stage5.js` | 14/14 | Trước đây "100 câu đồng thời" báo 76–88/100 — nguyên nhân là DB giả thiếu `order.findFirst`, không phải lỗi đồng thời. Câu gõ sai "doang thu thag nay" trước đây "đạt" dù trả doanh thu CẢ NĂM — nay kiểm tra đúng kỳ THÁNG. Test vô hiệu hoá cache trước đây luôn đạt (tra khoá không tồn tại) — nay kiểm tra thật. |
| `../context/test_stage4_multiturn.js` | 23/23 | "thế còn hôm qua?" trước đây "đạt" nhưng trả doanh thu HÔM NAY — nay kiểm tra nội dung là doanh thu hôm qua. |
| `../actors/test_actor_trainers.js` | 15/15 | |

## Cách chạy lại

```bash
cd backend
node src/services/ai/benchmark/heldout_eval.js            # DEV + TEST (offline)
npm run ai:eval                                           # mô hình node-nlp: k-fold + TEST khoá (offline)
node src/services/ai/benchmark/heldout_eval.js TEST -v    # in từng câu
node src/services/ai/benchmark/benchmark_stage5.js        # offline
node src/services/ai/benchmark/cache_isolation_test.js    # offline
node src/services/ai/context/test_stage4_multiturn.js     # offline
node -r dotenv/config src/services/ai/benchmark/security_sql_test.js   # cần DB, chỉ đọc
node -r dotenv/config src/services/ai/benchmark/chat_rbac_test.js      # cần DB, chỉ đọc
```
