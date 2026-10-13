const { as } = require('./api');
const HR = as('hr'), CEO = as('ceo'), ACC = as('accounting');
const show = (k, r) => { console.log(`${k} [${r.status}] ${r.message || ''}`); if (r.status >= 400) throw new Error(k); return r.data; };
(async () => {
  for (const period of ['2026-06', '2026-07', '2026-08', '2026-09']) {
    if (period !== '2026-06') {
      const rows = show(`${period} HR tính lương`, await HR.post('/hr/payrolls', { period }));
      const sum = (k) => rows.reduce((s, p) => s + (Number(p[k]) || 0), 0);
      console.log(`   ${rows.length} phiếu | gross ${sum('grossSalary')} | BH NLĐ ${sum('employeeInsurance')} | BH DN ${sum('employerInsurance')} | TNCN ${sum('personalIncomeTax')} | thực lĩnh ${sum('netSalary')}`);
      show(`${period} HR trình duyệt`, await HR.post('/hr/payrolls/submit', { period }));
    }
    show(`${period} CEO duyệt`, await CEO.patch('/hr/payrolls/approve-ceo', { period }));
    show(`${period} Kế toán giải ngân`, await ACC.post('/hr/payrolls/disburse-all', {}));
  }
})().catch(e => console.error('STOP', e.message));
