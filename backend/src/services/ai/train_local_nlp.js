/**
 * Huấn luyện lại mô hình phân loại ý định cục bộ (node-nlp).
 *
 *   cd backend && npm run ai:train
 *   (tương đương: node src/services/ai/benchmark/nlp_intent_eval.js --save)
 *
 * Dùng chung một quy trình với bộ đánh giá: k-fold phân tầng, đo trên bộ TEST khoá,
 * rồi lưu mô hình train trên TOÀN BỘ dữ liệu thành model.nlp. (Trước đây script này
 * chỉ train trên 80% dữ liệu ngẫu nhiên rồi lưu luôn mô hình đó, và mỗi lần chạy ra
 * một con số độ chính xác khác nhau.)
 *
 * Dữ liệu: src/services/ai/data/dataset_intent.json. KHÔNG thêm câu của
 * benchmark/intent_test_locked.json vào dữ liệu train — bộ đánh giá sẽ dừng nếu phát hiện.
 */
const path = require('path');
const { spawnSync } = require('child_process');

const result = spawnSync(
  process.execPath,
  [path.join(__dirname, 'benchmark', 'nlp_intent_eval.js'), '--save', ...process.argv.slice(2)],
  { stdio: 'inherit' }
);
process.exit(result.status ?? 1);
