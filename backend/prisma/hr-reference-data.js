// Dữ liệu tham chiếu nhân sự dùng chung cho seed.js (DB mới) và upgrade-hr-module.js (DB đang chạy).

// Khung lương theo vai trò — mặt bằng doanh nghiệp bán lẻ/lắp ráp máy tính quy mô vừa tại
// TP.HCM năm 2026, mọi mức lương cơ bản đều cao hơn lương tối thiểu vùng I (5.310.000đ).
//  - baseSalary: lương cơ bản theo hợp đồng (đóng BHXH)
//  - responsibilityAllowance: phụ cấp chức vụ/trách nhiệm (đóng BHXH)
//  - allowance: phụ cấp ăn trưa 730.000đ + xăng xe/điện thoại tùy vị trí (không đóng BHXH)
// Thu nhập biến đổi (hoa hồng bán hàng, thưởng lắp ráp, tăng ca) do hệ thống tính thêm mỗi kỳ.
const SALARY_GRID = {
  CEO:               { baseSalary: 40000000, responsibilityAllowance: 5000000, allowance: 2730000, jobTitle: 'Giám đốc điều hành' },
  ADMIN:             { baseSalary: 20000000, responsibilityAllowance: 1000000, allowance: 1230000, jobTitle: 'Quản trị hệ thống' },
  HR:                { baseSalary: 13000000, responsibilityAllowance: 0,       allowance: 930000,  jobTitle: 'Chuyên viên nhân sự' },
  ACCOUNTANT:        { baseSalary: 14000000, responsibilityAllowance: 0,       allowance: 930000,  jobTitle: 'Kế toán tổng hợp' },
  SALES_MANAGER:     { baseSalary: 18000000, responsibilityAllowance: 2000000, allowance: 1230000, jobTitle: 'Trưởng phòng kinh doanh' },
  SALES:             { baseSalary: 8500000,  responsibilityAllowance: 0,       allowance: 1230000, jobTitle: 'Nhân viên bán hàng' },
  WAREHOUSE_MANAGER: { baseSalary: 16000000, responsibilityAllowance: 1500000, allowance: 1030000, jobTitle: 'Trưởng kho' },
  WAREHOUSE:         { baseSalary: 9000000,  responsibilityAllowance: 0,       allowance: 930000,  jobTitle: 'Thủ kho' },
  PURCHASING:        { baseSalary: 12000000, responsibilityAllowance: 0,       allowance: 1030000, jobTitle: 'Chuyên viên mua hàng' },
  QC:                { baseSalary: 11000000, responsibilityAllowance: 0,       allowance: 930000,  jobTitle: 'Kỹ thuật viên kiểm định' },
  QA:                { baseSalary: 11000000, responsibilityAllowance: 0,       allowance: 930000,  jobTitle: 'Kỹ thuật viên kiểm định' },
  QUALITY_CONTROL:   { baseSalary: 11000000, responsibilityAllowance: 0,       allowance: 930000,  jobTitle: 'Kỹ thuật viên kiểm định' },
  ASSEMBLY:          { baseSalary: 10000000, responsibilityAllowance: 0,       allowance: 930000,  jobTitle: 'Kỹ thuật viên lắp ráp' },
  CSKH:              { baseSalary: 9000000,  responsibilityAllowance: 0,       allowance: 1030000, jobTitle: 'Chuyên viên chăm sóc khách hàng' },
  DELIVERY:          { baseSalary: 7500000,  responsibilityAllowance: 0,       allowance: 1730000, jobTitle: 'Nhân viên giao hàng' },
  EMPLOYEE:          { baseSalary: 8000000,  responsibilityAllowance: 0,       allowance: 930000,  jobTitle: 'Nhân viên' }
};

// Tài khoản nhân viên chung: đăng nhập "nhanvien" / "123456".
const GENERAL_EMPLOYEE = {
  code: 'nhanvien',
  name: 'Nguyễn Thị Hạnh (Nhân Viên)',
  email: 'nhanvien@kltn-erp.vn',
  dept: 'Hành Chính',
  role: 'EMPLOYEE',
  phone: '0901234567'
};

// Ngày nghỉ lễ, Tết hưởng nguyên lương (BLLĐ 2019 Điều 112). Tết Âm lịch và Giỗ Tổ đổi theo năm;
// HR cập nhật lại theo thông báo chính thức hằng năm trong tab "Cấu Hình Công & Lương".
const HOLIDAYS = [
  ['2026-01-01', 'Tết Dương lịch'],
  ['2026-02-16', 'Tết Nguyên đán (29 Tết)'],
  ['2026-02-17', 'Tết Nguyên đán (Mùng 1)'],
  ['2026-02-18', 'Tết Nguyên đán (Mùng 2)'],
  ['2026-02-19', 'Tết Nguyên đán (Mùng 3)'],
  ['2026-02-20', 'Tết Nguyên đán (Mùng 4)'],
  ['2026-04-27', 'Giỗ Tổ Hùng Vương (nghỉ bù)'],
  ['2026-04-30', 'Ngày Giải phóng miền Nam'],
  ['2026-05-01', 'Quốc tế Lao động'],
  ['2026-09-01', 'Quốc khánh'],
  ['2026-09-02', 'Quốc khánh'],
  ['2027-01-01', 'Tết Dương lịch']
];

const gridFor = (role) => SALARY_GRID[role] || SALARY_GRID.EMPLOYEE;

module.exports = { SALARY_GRID, GENERAL_EMPLOYEE, HOLIDAYS, gridFor };
