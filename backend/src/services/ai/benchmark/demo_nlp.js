/**
 * DEMO phân loại ý định bằng mô hình node-nlp ĐANG CHẠY THẬT (model.nlp).
 *
 *   npm run ai:demo                         # chạy bộ câu demo_cases.json
 *   npm run ai:demo -- "câu hỏi bất kỳ"     # thử 1 câu tự gõ
 *
 * Dùng khi trình bày: cùng bộ câu này chạy trên PhoBERT bằng cell DEMO trong notebook Colab
 * để so sánh hai mô hình trên các câu mới (không có trong dữ liệu train).
 */
const fs = require('fs');
const path = require('path');
const { NlpManager } = require('node-nlp');

const MODEL_PATH = path.join(__dirname, '..', 'model.nlp');
const CASES_PATH = path.join(__dirname, 'demo_cases.json');
const DATASET_PATH = path.join(__dirname, '..', 'data', 'dataset_intent.json');
const THRESHOLD = 0.70;

(async () => {
  const manager = new NlpManager({ languages: ['vi', 'en'], nlu: { log: false }, autoSave: false });
  manager.load(MODEL_PATH);

  const custom = process.argv.slice(2).filter(a => !a.startsWith('--')).join(' ').trim();
  const cases = custom ? [{ group: 'Câu tự gõ', text: custom, intent: null }] : JSON.parse(fs.readFileSync(CASES_PATH, 'utf8'));

  // Câu demo phải là câu MỚI — không nằm trong dữ liệu train
  const norm = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  const trained = new Set(JSON.parse(fs.readFileSync(DATASET_PATH, 'utf8')).map(d => norm(d.text)));

  let group = null, correct = 0, scored = 0;
  for (const c of cases) {
    if (c.group !== group) { group = c.group; console.log(`\n${group}`); }
    const r = await manager.process('vi', c.text);
    const pred = r.intent && r.intent !== 'None' ? r.intent : 'None';
    const conf = Number(r.score || 0);
    const used = pred !== 'None' && conf >= THRESHOLD;
    let mark = '  ';
    if (c.intent) { scored++; if (pred === c.intent) { correct++; mark = '✅'; } else mark = '❌'; }
    const seen = trained.has(norm(c.text)) ? ' [CÓ TRONG DỮ LIỆU TRAIN]' : '';
    console.log(`  ${mark} "${c.text}"${seen}`);
    console.log(`       → ${pred} (độ tin cậy ${conf.toFixed(2)}${used ? '' : ', dưới 0,70 → chuyển tầng sau'})${c.intent && pred !== c.intent ? ` | đúng: ${c.intent}` : ''}`);
  }
  if (scored) console.log(`\nnode-nlp: đúng ${correct}/${scored} câu`);
})();
