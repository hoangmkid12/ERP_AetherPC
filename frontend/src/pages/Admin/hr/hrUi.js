// Style và hằng số dùng chung cho các panel của phân hệ Nhân Sự.
export const card = { backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem' };
export const input = { width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' };
export const label = { display: 'block', fontWeight: 700, color: '#0f172a', marginBottom: '0.3rem', fontSize: '0.78rem' };
export const th = { padding: '0.6rem 0.75rem', textAlign: 'left', whiteSpace: 'nowrap' };
export const td = { padding: '0.6rem 0.75rem', borderTop: '1px solid #f1f5f9' };
export const theadRow = { backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569', fontSize: '0.76rem' };
export const btn = (bg, color = '#ffffff', extra = {}) => ({
  display: 'inline-flex', alignItems: 'center', gap: '0.35rem', backgroundColor: bg, color,
  border: bg === '#ffffff' ? '1px solid #cbd5e1' : 'none', borderRadius: '6px', padding: '0.45rem 0.95rem',
  fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer', ...extra
});
export const smallBtn = (color, border) => ({
  backgroundColor: '#ffffff', color, border: `1px solid ${border}`, borderRadius: '4px',
  padding: '0.28rem 0.5rem', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer'
});
export const overlay = { position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' };
export const modal = (maxWidth = 520) => ({ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', width: '100%', maxWidth, padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto' });

export const fmtMoney = (n) => new Intl.NumberFormat('vi-VN').format(Math.round(Number(n) || 0));
export const currentPeriod = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }).slice(0, 7);
export const previousPeriod = () => {
  const [y, m] = currentPeriod().split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
};

// Tải file CSV (UTF-8 có BOM để Excel đọc đúng tiếng Việt).
export const downloadCsv = (filename, header, rows) => {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = '﻿' + [header, ...rows].map(r => r.map(esc).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const ROLE_OPTIONS = [
  ['EMPLOYEE', 'Nhân viên (tài khoản chung)'],
  ['SALES', 'Nhân viên bán hàng'], ['SALES_MANAGER', 'Quản lý bán hàng'],
  ['WAREHOUSE', 'Thủ kho'], ['WAREHOUSE_MANAGER', 'Quản lý kho'],
  ['PURCHASING', 'Nhân viên mua hàng'], ['QC', 'Kiểm định chất lượng'],
  ['ASSEMBLY', 'Kỹ thuật lắp ráp'], ['DELIVERY', 'Nhân viên giao hàng'],
  ['CSKH', 'Chăm sóc khách hàng'], ['ACCOUNTANT', 'Kế toán'], ['HR', 'Nhân sự'],
  ['CEO', 'Ban giám đốc'], ['ADMIN', 'Quản trị hệ thống']
];

export const DEPARTMENTS = [
  'Ban Giám Đốc', 'Hành Chính', 'Kinh Doanh', 'Kho Vận', 'Mua Hàng', 'Kiểm Định QA/QC',
  'Kỹ Thuật Lắp Ráp', 'Nhân Sự', 'Kế Toán', 'Chăm Sóc KH', 'Giao Vận', 'IT'
];

export const DEFAULT_DEPT_BY_ROLE = {
  EMPLOYEE: 'Hành Chính', SALES: 'Kinh Doanh', SALES_MANAGER: 'Kinh Doanh', WAREHOUSE: 'Kho Vận', WAREHOUSE_MANAGER: 'Kho Vận',
  PURCHASING: 'Mua Hàng', QC: 'Kiểm Định QA/QC', ASSEMBLY: 'Kỹ Thuật Lắp Ráp', DELIVERY: 'Giao Vận', CSKH: 'Chăm Sóc KH',
  ACCOUNTANT: 'Kế Toán', HR: 'Nhân Sự', CEO: 'Ban Giám Đốc', ADMIN: 'IT'
};

// Gợi ý khung lương khi HR chọn chức danh (khớp backend prisma/hr-reference-data.js).
export const SALARY_SUGGESTION = {
  CEO: [40000000, 5000000, 2730000], ADMIN: [20000000, 1000000, 1230000], HR: [13000000, 0, 930000],
  ACCOUNTANT: [14000000, 0, 930000], SALES_MANAGER: [18000000, 2000000, 1230000], SALES: [8500000, 0, 1230000],
  WAREHOUSE_MANAGER: [16000000, 1500000, 1030000], WAREHOUSE: [9000000, 0, 930000], PURCHASING: [12000000, 0, 1030000],
  QC: [11000000, 0, 930000], ASSEMBLY: [10000000, 0, 930000], CSKH: [9000000, 0, 1030000],
  DELIVERY: [7500000, 0, 1730000], EMPLOYEE: [8000000, 0, 930000]
};
