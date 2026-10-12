/**
 * Đánh giá tầng hiểu câu hỏi offline (executeActorIntent) trên bộ câu hỏi held-out.
 *
 *   node src/services/ai/benchmark/heldout_eval.js          # cả DEV và TEST
 *   node src/services/ai/benchmark/heldout_eval.js TEST -v  # chỉ TEST, in từng câu
 *
 * Chạy 100% offline: Prisma giả trả về rỗng (chỉ đo khâu CHỌN ĐÚNG KỸ NĂNG, không
 * đo dữ liệu), không gọi Gemini.
 *
 * Chỉ số:
 *   - Đúng:            chọn đúng kỹ năng (hoặc từ chối đúng với câu DENY / ABSTAIN)
 *   - Sai tự tin:      trả SUCCESS nhưng sai kỹ năng, hoặc trả SUCCESS cho câu
 *                      lẽ ra phải từ chối — loại lỗi nguy hiểm nhất (hiện số sai)
 *   - Từ chối thừa:    câu trả lời được nhưng hệ thống lại báo chưa chắc / hỏi lại
 */
process.env.GEMINI_API_KEY = '';
const { executeActorIntent } = require('../actors');
const { TEST, DEV } = require('./heldout_cases');

const emptyResult = (method) => {
  if (/^(findUnique|findFirst)/.test(method)) return null;
  if (/count/i.test(method)) return 0;
  if (/aggregate/.test(method)) return { _sum: {}, _count: 0, _avg: {}, _max: {}, _min: {} };
  if (/groupBy/.test(method)) return [];
  return [];
};
const mockPrisma = new Proxy({}, {
  get: (_, model) => {
    if (typeof model !== 'string') return undefined;
    if (model.startsWith('$')) return async () => [];
    return new Proxy({}, { get: (__, method) => async () => emptyResult(String(method)) });
  }
});

const DENY_STATUSES = ['FORBIDDEN', 'ACCESS_DENIED'];
const ABSTAIN_STATUSES = ['UNCERTAIN', 'CLARIFICATION_REQUIRED', 'NOT_FOUND', 'NONE'];

function grade(expect, r) {
  const status = r?.status || 'NONE';
  const skill = r?.skillId || r?.intent || null;
  const answered = status === 'SUCCESS';

  if (expect === 'ABSTAIN') {
    return answered ? 'CONFIDENT_WRONG' : 'CORRECT';
  }
  if (expect === 'DENY') {
    if (answered) return 'CONFIDENT_WRONG';
    return 'CORRECT'; // FORBIDDEN / ACCESS_DENIED / không trả lời đều an toàn
  }
  if (Array.isArray(expect)) {
    if (expect.includes(skill) && (answered || status === 'CLARIFICATION_REQUIRED')) return 'CORRECT';
    if (answered) return 'CONFIDENT_WRONG';
    if (DENY_STATUSES.includes(status)) return 'WRONG_DENY';
    return 'OVER_ABSTAIN';
  }
  return 'INVALID_CASE';
}

async function runSet(name, cases, verbose) {
  const tally = { CORRECT: 0, CONFIDENT_WRONG: 0, OVER_ABSTAIN: 0, WRONG_DENY: 0, INVALID_CASE: 0 };
  const failures = [];
  for (let i = 0; i < cases.length; i++) {
    const [role, prompt, expect] = cases[i];
    let r;
    try {
      r = await executeActorIntent(prompt, role, mockPrisma, { id: 7, role, name: 'Eval' }, { sessionId: `eval_${name}_${i}`, skipCache: true });
    } catch (e) {
      r = { status: 'THROW', message: e.message };
    }
    const g = grade(expect, r);
    tally[g]++;
    const line = `${g.padEnd(15)} | (${role}) "${prompt}" → ${r?.status || 'NONE'} ${r?.skillId || r?.intent || '-'}` +
      ` (score=${r?.matchScore != null ? Number(r.matchScore).toFixed(2) : '-'}, src=${r?.matchSource || '-'})` +
      `  | mong đợi: ${Array.isArray(expect) ? expect.join('/') : expect}`;
    if (g !== 'CORRECT') failures.push(line);
    if (verbose) console.log(line);
  }
  const n = cases.length;
  const pct = (x) => `${((x / n) * 100).toFixed(1)}%`;
  console.log(`\n===== ${name} (${n} câu) =====`);
  console.log(`  Đúng:           ${tally.CORRECT}/${n} (${pct(tally.CORRECT)})`);
  console.log(`  Sai tự tin:     ${tally.CONFIDENT_WRONG}/${n} (${pct(tally.CONFIDENT_WRONG)})`);
  console.log(`  Từ chối thừa:   ${tally.OVER_ABSTAIN}/${n} (${pct(tally.OVER_ABSTAIN)})`);
  console.log(`  Chặn quyền sai: ${tally.WRONG_DENY}/${n} (${pct(tally.WRONG_DENY)})`);
  if (!verbose && failures.length) {
    console.log('  --- Các câu chưa đúng ---');
    failures.forEach(f => console.log('  ' + f));
  }
  return tally;
}

(async () => {
  const args = process.argv.slice(2);
  const verbose = args.includes('-v');
  const only = args.find(a => a === 'TEST' || a === 'DEV');
  // Tắt log nội bộ để báo cáo gọn
  const origLog = console.log;
  // Chỉ chặn log nội bộ dạng "[TenModule] ..." / "✅ [SelfTrainedAI] ..."
  const quiet = (...a) => { if (typeof a[0] === 'string' && /^(\[[A-Za-z][\w ]*\]|✅ \[SelfTrained)/.test(a[0])) return; origLog(...a); };
  console.log = quiet;
  console.warn = () => {};
  console.error = () => {};
  if (!only || only === 'DEV') await runSet('DEV', DEV, verbose);
  if (!only || only === 'TEST') await runSet('TEST (khoá, không dùng để tinh chỉnh)', TEST, verbose);
  process.exit(0);
})();
