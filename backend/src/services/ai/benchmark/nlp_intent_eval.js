/**
 * ĐÁNH GIÁ & HUẤN LUYỆN MÔ HÌNH PHÂN LOẠI Ý ĐỊNH CỤC BỘ (node-nlp)
 *
 *   node src/services/ai/benchmark/nlp_intent_eval.js           # chỉ đánh giá
 *   node src/services/ai/benchmark/nlp_intent_eval.js --save    # đánh giá + lưu model.nlp
 *   node src/services/ai/benchmark/nlp_intent_eval.js --dataset <file.json>
 *
 * Quy trình (100% cục bộ, không gọi API ngoài):
 *  1. K-fold phân tầng (5 phần, xáo trộn bằng seed cố định → chạy lại ra cùng kết quả):
 *     mỗi lần train trên 4/5 dữ liệu, đo trên 1/5 còn lại.
 *  2. Train trên TOÀN BỘ dữ liệu rồi đo trên bộ TEST KHOÁ (intent_test_locked.json) —
 *     bộ câu hỏi viết trước khi mở rộng dữ liệu, không bao giờ đưa vào train.
 *  3. --save: lưu mô hình train trên toàn bộ dữ liệu thành model.nlp (đúng mô hình
 *     vừa được đánh giá ở bước 2 là mô hình chạy thật).
 *
 * Chỉ số:
 *  - Accuracy, Macro-F1 (trung bình F1 các ý định — không bị ý định đông mẫu lấn át)
 *  - Tại ngưỡng 0.70 (ngưỡng controller dùng để TIN kết quả mô hình):
 *      Coverage  = tỷ lệ câu mô hình đủ tự tin để được dùng
 *      Precision = trong các câu được dùng, tỷ lệ đúng (sai ở đây = định tuyến nhầm)
 */
const fs = require('fs');
const path = require('path');
const { NlpManager } = require('node-nlp');
const { registerErpEntities } = require('../localNlp.service');

const CONFIDENCE_THRESHOLD = 0.70; // khớp ai.controller.js (localNlpResult.confidence >= 0.70)
const K = 5;
const SEED = 20261012;

const args = process.argv.slice(2);
const datasetArg = args.includes('--dataset') ? args[args.indexOf('--dataset') + 1] : null;
const DATASET_PATH = datasetArg ? path.resolve(datasetArg) : path.join(__dirname, '..', 'data', 'dataset_intent.json');
const TEST_PATH = path.join(__dirname, 'intent_test_locked.json');
const MODEL_PATH = path.join(__dirname, '..', 'model.nlp');

// PRNG có seed (mulberry32) để xáo trộn tái lập được
const rng = (seed) => () => {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const shuffle = (arr, rand) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

// Cấu hình GIỐNG HỆT localNlp.service.js (initLocalNlpModel)
const train = async (samples) => {
  const manager = new NlpManager({ languages: ['vi', 'en'], forceNER: true, nlu: { log: false }, autoSave: false });
  registerErpEntities(manager);
  for (const s of samples) manager.addDocument('vi', s.text, s.intent);
  await manager.train();
  return manager;
};

const predict = async (manager, samples) => {
  const out = [];
  for (const s of samples) {
    const r = await manager.process('vi', s.text);
    const intent = r && r.intent && r.intent !== 'None' ? r.intent : 'None';
    out.push({ text: s.text, actual: s.intent, predicted: intent, score: Number(r?.score || 0) });
  }
  return out;
};

const metrics = (preds, intents) => {
  const n = preds.length;
  const correct = preds.filter(p => p.predicted === p.actual).length;
  const perIntent = {};
  for (const it of intents) {
    const tp = preds.filter(p => p.predicted === it && p.actual === it).length;
    const fp = preds.filter(p => p.predicted === it && p.actual !== it).length;
    const fn = preds.filter(p => p.predicted !== it && p.actual === it).length;
    const precision = tp + fp ? tp / (tp + fp) : 0;
    const recall = tp + fn ? tp / (tp + fn) : 0;
    const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
    perIntent[it] = { precision, recall, f1, support: tp + fn };
  }
  const macroF1 = intents.reduce((s, it) => s + perIntent[it].f1, 0) / intents.length;
  const accepted = preds.filter(p => p.predicted !== 'None' && p.score >= CONFIDENCE_THRESHOLD);
  const acceptedCorrect = accepted.filter(p => p.predicted === p.actual).length;
  return {
    n, accuracy: correct / n, macroF1, perIntent,
    coverage: accepted.length / n,
    precisionAtThreshold: accepted.length ? acceptedCorrect / accepted.length : 0,
    misroutedAtThreshold: accepted.length - acceptedCorrect
  };
};

const pct = (x) => `${(x * 100).toFixed(1)}%`;

(async () => {
  const origLog = console.log;
  console.log = (...a) => { if (typeof a[0] === 'string' && /^\[|^✅/.test(a[0])) return; origLog(...a); };

  const data = JSON.parse(fs.readFileSync(DATASET_PATH, 'utf8'));
  const test = JSON.parse(fs.readFileSync(TEST_PATH, 'utf8'));
  const intents = [...new Set(data.map(d => d.intent))].sort();

  // Chốt chặn rò rỉ: câu TEST không được xuất hiện trong dữ liệu train
  const norm = (s) => s.toLowerCase().normalize('NFC').replace(/\s+/g, ' ').trim();
  const trainSet = new Set(data.map(d => norm(d.text)));
  const leaked = test.filter(t => trainSet.has(norm(t.text)));
  if (leaked.length) {
    origLog(`❌ ${leaked.length} câu của bộ TEST khoá nằm trong dữ liệu train — dừng.`, leaked.map(l => l.text));
    process.exit(1);
  }

  origLog(`Dataset: ${path.relative(process.cwd(), DATASET_PATH)} — ${data.length} câu, ${intents.length} ý định`);
  origLog('  ' + intents.map(it => `${it}: ${data.filter(d => d.intent === it).length}`).join(' | '));

  // ---- 1. K-fold phân tầng ----
  const rand = rng(SEED);
  const folds = Array.from({ length: K }, () => []);
  for (const it of intents) {
    shuffle(data.filter(d => d.intent === it), rand).forEach((s, i) => folds[i % K].push(s));
  }
  const allPreds = [];
  for (let k = 0; k < K; k++) {
    const trainData = folds.filter((_, i) => i !== k).flat();
    const manager = await train(trainData);
    allPreds.push(...await predict(manager, folds[k]));
  }
  const cv = metrics(allPreds, intents);
  origLog(`\n===== ${K}-FOLD CROSS-VALIDATION (${cv.n} dự đoán) =====`);
  origLog(`  Accuracy ${pct(cv.accuracy)} | Macro-F1 ${pct(cv.macroF1)} | Coverage@0.70 ${pct(cv.coverage)} | Precision@0.70 ${pct(cv.precisionAtThreshold)}`);

  // Đường cong ngưỡng — tính trên dữ liệu CROSS-VALIDATION (không dùng bộ TEST) để
  // chọn ngưỡng tin cậy cho controller: ngưỡng cao hơn → ít định tuyến nhầm hơn
  // nhưng nhiều câu phải đi tiếp xuống tầng sau hơn.
  origLog('  Ngưỡng | Coverage | Precision | Nhầm  (trên CV)');
  for (const th of [0.5, 0.6, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95]) {
    const acc = allPreds.filter(p => p.predicted !== 'None' && p.score >= th);
    const ok = acc.filter(p => p.predicted === p.actual).length;
    origLog(`   ${th.toFixed(2)}  |  ${pct(acc.length / allPreds.length).padStart(6)}  |  ${pct(acc.length ? ok / acc.length : 0).padStart(6)}   | ${acc.length - ok}`);
  }

  // Lỗi trên CV (dùng để quyết định bổ sung dữ liệu — KHÔNG dùng lỗi của bộ TEST)
  if (args.includes('--cv-errors')) {
    const pairs = {};
    allPreds.filter(p => p.predicted !== p.actual).forEach(p => {
      const k = `${p.actual} → ${p.predicted}`;
      (pairs[k] = pairs[k] || []).push(`"${p.text}" (${p.score.toFixed(2)})`);
    });
    origLog('  Lỗi CV theo cặp (thật → dự đoán):');
    Object.entries(pairs).sort((a, b) => b[1].length - a[1].length).forEach(([k, v]) => origLog(`    ${v.length}x ${k}: ${v.slice(0, 4).join(', ')}`));
    process.exit(0);
  }

  // ---- 2. Train toàn bộ → đo trên TEST khoá ----
  const full = await train(data);
  const testPreds = await predict(full, test);
  const tm = metrics(testPreds, intents);
  origLog(`\n===== BỘ TEST KHOÁ (${tm.n} câu, không nằm trong dữ liệu train) =====`);
  origLog(`  Accuracy ${pct(tm.accuracy)} | Macro-F1 ${pct(tm.macroF1)} | Coverage@0.70 ${pct(tm.coverage)} | Precision@0.70 ${pct(tm.precisionAtThreshold)} (định tuyến nhầm: ${tm.misroutedAtThreshold})`);
  origLog('  Theo ý định (P / R / F1):');
  for (const it of intents) {
    const m = tm.perIntent[it];
    origLog(`    ${it.padEnd(17)} ${pct(m.precision).padStart(6)} / ${pct(m.recall).padStart(6)} / ${pct(m.f1).padStart(6)}  (n=${m.support})`);
  }
  // Ma trận nhầm lẫn
  const labels = [...intents, 'None'];
  const short = (s) => s.replace(/_/g, '').slice(0, 6);
  origLog('\n  Ma trận nhầm lẫn (hàng = thật, cột = dự đoán):');
  origLog('    ' + ''.padEnd(17) + labels.map(l => short(l).padStart(7)).join(''));
  for (const a of intents) {
    origLog('    ' + a.padEnd(17) + labels.map(p => String(testPreds.filter(x => x.actual === a && x.predicted === p).length).padStart(7)).join(''));
  }
  const wrong = testPreds.filter(p => p.predicted !== p.actual);
  if (wrong.length) {
    origLog('\n  Câu sai:');
    wrong.forEach(w => origLog(`    "${w.text}" → ${w.predicted} (${w.score.toFixed(2)}) | đúng: ${w.actual}`));
  }

  if (args.includes('--save')) {
    full.save(MODEL_PATH);
    origLog(`\n💾 Đã lưu mô hình (train trên toàn bộ ${data.length} câu) → ${path.relative(process.cwd(), MODEL_PATH)}`);
  }
  process.exit(0);
})();
