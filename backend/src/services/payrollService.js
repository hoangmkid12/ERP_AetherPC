const prisma = require('../config/database');
const P = require('./hrPolicy');

const round = (n) => Math.round(Number(n) || 0);
const num = (v, fallback = 0) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
};

const DEFAULT_SETTINGS = {
  workStartTime: '08:00', workEndTime: '17:30', breakMinutes: 90, lateGraceMinutes: 5,
  workOnSaturday: true, attendanceStrictMode: false, faceMatchThreshold: 0.5,
  regionMinimumWage: 5310000, salesCommissionFlat: 1, assemblyBonus: 150000, absencePenalty: 0
};

const getHrSettings = async (db = prisma) => {
  const s = await db.companySettings.findUnique({ where: { id: 1 } });
  if (!s) return { ...DEFAULT_SETTINGS };
  return {
    ...DEFAULT_SETTINGS,
    ...Object.fromEntries(Object.entries(s).filter(([, v]) => v !== null && v !== undefined)),
    faceMatchThreshold: num(s.faceMatchThreshold, 0.5),
    regionMinimumWage: num(s.regionMinimumWage, 5310000),
    // Cột lịch sử tên "Flat" nhưng là %: giá trị > 100 chắc chắn là số tiền cũ còn sót, quy về 1%.
    salesCommissionFlat: num(s.salesCommissionFlat, 1) > 100 ? 1 : num(s.salesCommissionFlat, 1),
    assemblyBonus: num(s.assemblyBonus, 150000),
    absencePenalty: num(s.absencePenalty, 0)
  };
};

/**
 * Nạp toàn bộ dữ liệu cần để tính lương 1 kỳ cho danh sách nhân viên — gom truy vấn
 * theo lô thay vì từng người.
 */
const loadPayrollContext = async (period, employees) => {
  const { start, end } = P.monthRange(period);
  const empIds = employees.map(e => e.id);
  const settings = await getHrSettings();

  const [attendance, leaves, holidays] = await Promise.all([
    prisma.attendance.findMany({
      where: { employeeId: { in: empIds }, date: { gte: start, lt: end } },
      select: { employeeId: true, date: true, status: true, checkIn: true, checkOut: true, overtimeHours: true, workHours: true, lateMinutes: true, earlyLeaveMinutes: true }
    }),
    prisma.leaveRequest.findMany({
      where: { employeeId: { in: empIds }, status: 'APPROVED', startDate: { lt: end }, endDate: { gte: start } }
    }),
    prisma.holiday.findMany({ where: { date: { gte: start, lt: end } } })
  ]);

  const attendanceByEmp = {};
  for (const a of attendance) (attendanceByEmp[a.employeeId] ||= {})[P.isoDate(a.date)] = a;
  const leavesByEmp = {};
  for (const l of leaves) (leavesByEmp[l.employeeId] ||= []).push(l);
  const holidaySet = new Set(holidays.map(h => P.isoDate(h.date)));

  // Hoa hồng: doanh số đơn bán tại quầy (soldById) của Nhân Viên Bán Hàng, trừ đơn hủy/giao thất bại.
  const salesIds = employees.filter(e => e.role === 'SALES').map(e => e.id);
  const revenueByEmp = {};
  if (salesIds.length) {
    const groups = await prisma.order.groupBy({
      by: ['soldById'],
      where: { soldById: { in: salesIds }, createdAt: { gte: start, lt: end }, status: { notIn: ['CANCELLED', 'FAILED_DELIVERY'] } },
      _sum: { totalAmount: true }
    });
    for (const g of groups) revenueByEmp[g.soldById] = num(g._sum.totalAmount);
  }

  // Thưởng lắp ráp: số bộ máy nghiệm thu trong kỳ (WorkOrder cũ + AssemblyJob khớp theo email/mã NV).
  const assemblyEmps = employees.filter(e => e.role === 'ASSEMBLY');
  const assembledByEmp = {};
  if (assemblyEmps.length) {
    const woGroups = await prisma.workOrder.groupBy({
      by: ['employeeId'],
      where: { employeeId: { in: assemblyEmps.map(e => e.id) }, status: 'COMPLETED', completedAt: { gte: start, lt: end } },
      _count: { id: true }
    });
    for (const g of woGroups) assembledByEmp[g.employeeId] = g._count.id;
    const keyToEmp = {};
    for (const e of assemblyEmps) {
      if (e.email) keyToEmp[e.email.toLowerCase()] = e.id;
      if (e.employeeCode) keyToEmp[e.employeeCode.toLowerCase()] = e.id;
    }
    const jobGroups = await prisma.assemblyJob.groupBy({
      by: ['completedBy'],
      where: { status: 'COMPLETED', completedBy: { not: null }, completedAt: { gte: start, lt: end } },
      _count: { jobCode: true }
    });
    for (const g of jobGroups) {
      const empId = keyToEmp[String(g.completedBy).toLowerCase()];
      if (empId) assembledByEmp[empId] = (assembledByEmp[empId] || 0) + g._count.jobCode;
    }
  }

  return { period, start, end, settings, attendanceByEmp, leavesByEmp, holidaySet, revenueByEmp, assembledByEmp };
};

/**
 * Tính phiếu lương của 1 nhân viên trong kỳ. Hàm thuần (không truy vấn DB) để kiểm thử được.
 * adjustments: { otherBonus, otherDeductions, note } do HR nhập tay trước khi trình duyệt.
 */
const computePayslip = (emp, ctx, adjustments = {}) => {
  const { settings, period } = ctx;
  const days = P.eachDay(ctx.start, ctx.end);
  const att = ctx.attendanceByEmp[emp.id] || {};
  const leaves = ctx.leavesByEmp[emp.id] || [];
  const hireDate = emp.hireDate ? new Date(emp.hireDate) : null;

  const leaveOn = (d) => leaves.find(l => d >= new Date(l.startDate) && d <= new Date(l.endDate));

  let standardDays = 0;
  let workDays = 0;
  let paidLeaveDays = 0;
  let unpaidDays = 0;
  let absentWithoutLeave = 0;
  let lateMinutes = 0;
  const ot = { WEEKDAY: 0, REST_DAY: 0, HOLIDAY: 0 };

  for (const d of days) {
    const key = P.isoDate(d);
    const rec = att[key];
    const worked = rec && ['PRESENT', 'LATE'].includes(rec.status);
    const holiday = ctx.holidaySet.has(key);
    const scheduled = P.isScheduledWorkday(d, settings);

    if (!scheduled) {
      // Đi làm vào ngày nghỉ hằng tuần: toàn bộ giờ làm là tăng ca.
      if (worked) ot[holiday ? 'HOLIDAY' : 'REST_DAY'] += num(rec.workHours) || P.standardHoursPerDay(settings);
      continue;
    }
    standardDays += 1;
    // Chưa vào làm thì những ngày trước ngày nhận việc không tính công, cũng không tính vắng.
    if (hireDate && d < hireDate) { unpaidDays += 1; continue; }

    if (holiday) {
      paidLeaveDays += 1; // nghỉ lễ hưởng nguyên lương
      if (worked) ot.HOLIDAY += num(rec.workHours) || P.standardHoursPerDay(settings);
      continue;
    }
    if (worked) {
      workDays += 1;
      lateMinutes += (rec.lateMinutes || 0) + (rec.earlyLeaveMinutes || 0);
      ot.WEEKDAY += num(rec.overtimeHours);
      continue;
    }
    const leave = leaveOn(d);
    if (leave) {
      if (P.UNPAID_LEAVE_TYPES.includes(leave.type)) unpaidDays += 1;
      else paidLeaveDays += 1;
      continue;
    }
    if (rec && rec.status === 'ABSENT') {
      unpaidDays += 1;
      absentWithoutLeave += 1;
      continue;
    }
    // Không có dữ liệu chấm công cho ngày làm việc này.
    if (settings.attendanceStrictMode) unpaidDays += 1;
    else workDays += 1;
  }

  const contractSalary = num(emp.baseSalary) + num(emp.responsibilityAllowance);
  const paidDays = workDays + paidLeaveDays;
  const timeSalary = standardDays > 0 ? round(contractSalary * paidDays / standardDays) : 0;
  const allowancePaid = standardDays > 0 ? round(num(emp.allowance) * workDays / standardDays) : 0;

  const hourlyRate = standardDays > 0 ? contractSalary / standardDays / P.standardHoursPerDay(settings) : 0;
  const overtimeHours = ot.WEEKDAY + ot.REST_DAY + ot.HOLIDAY;
  const overtimeBase = hourlyRate * overtimeHours; // phần lương giờ làm như ngày thường
  const overtimePay = round(
    hourlyRate * (ot.WEEKDAY * P.OT_RATE.WEEKDAY + ot.REST_DAY * P.OT_RATE.REST_DAY + ot.HOLIDAY * P.OT_RATE.HOLIDAY)
  );

  const commission = emp.role === 'SALES'
    ? round((ctx.revenueByEmp[emp.id] || 0) * settings.salesCommissionFlat / 100) : 0;
  const assemblyBonus = emp.role === 'ASSEMBLY' ? (ctx.assembledByEmp[emp.id] || 0) * settings.assemblyBonus : 0;
  const otherBonus = round(adjustments.otherBonus);
  const grossSalary = timeSalary + allowancePaid + overtimePay + commission + assemblyBonus + otherBonus;

  // Khấu trừ chuyên cần = trừ theo phút đi muộn/về sớm + tiền phạt mỗi ngày vắng không phép.
  const latePenalty = round(lateMinutes * hourlyRate / 60) + round(absentWithoutLeave * settings.absencePenalty);
  const otherDeductions = round(adjustments.otherDeductions); // chỉ gồm khoản HR nhập tay

  // Bảo hiểm bắt buộc tính trên lương hợp đồng (đã gồm phụ cấp chức vụ), có áp trần.
  const insuranceEligible = unpaidDays < P.NO_INSURANCE_UNPAID_DAYS && contractSalary > 0;
  const insuranceSalary = insuranceEligible ? Math.min(contractSalary, P.INSURANCE_CAP) : 0;
  const bhtnCap = 20 * num(settings.regionMinimumWage, 5310000);
  const bhtnBase = insuranceEligible ? Math.min(contractSalary, bhtnCap) : 0;
  const employeeInsurance = round(insuranceSalary * P.EMPLOYEE_RATES.bhxh) + round(insuranceSalary * P.EMPLOYEE_RATES.bhyt) + round(bhtnBase * P.EMPLOYEE_RATES.bhtn);
  const employerInsurance = round(insuranceSalary * P.EMPLOYER_RATES.bhxh) + round(insuranceSalary * P.EMPLOYER_RATES.bhyt) + round(bhtnBase * P.EMPLOYER_RATES.bhtn);

  // Thuế TNCN: tiền tăng ca được miễn (toàn bộ từ kỳ tính thuế 2026, trước đó chỉ phần trả cao hơn
  // giờ làm bình thường) và tiền ăn trưa được miễn tối đa 730.000đ.
  const fd = P.familyDeduction(period);
  const overtimeExempt = P.overtimeFullyExempt(period) ? overtimePay : Math.max(0, overtimePay - round(overtimeBase));
  const nonTaxable = overtimeExempt + Math.min(allowancePaid, P.MEAL_ALLOWANCE_TAX_FREE);
  const taxableIncome = Math.max(0, round(
    grossSalary - nonTaxable - employeeInsurance - latePenalty
    - fd.self - (emp.dependents || 0) * fd.dependent
  ));
  const personalIncomeTax = P.progressiveTax(taxableIncome, period);

  const totalDeductions = employeeInsurance + personalIncomeTax + latePenalty + otherDeductions;
  const netSalary = grossSalary - totalDeductions;

  return {
    employeeId: emp.id,
    period,
    // Cột tổng hợp giữ tương thích với màn hình Kế Toán/Dashboard.
    baseSalary: timeSalary,
    allowances: allowancePaid,
    bonuses: overtimePay + commission + assemblyBonus + otherBonus,
    deductions: totalDeductions,
    netSalary,
    // Chi tiết
    contractSalary,
    standardDays,
    workDays,
    paidLeaveDays,
    unpaidDays,
    lateMinutes,
    overtimeHours,
    overtimePay,
    commission,
    assemblyBonus,
    otherBonus,
    grossSalary,
    insuranceSalary,
    employeeInsurance,
    employerInsurance,
    taxableIncome,
    personalIncomeTax,
    latePenalty,
    otherDeductions,
    note: adjustments.note ?? null
  };
};

// Diễn giải phiếu lương thành các dòng để hiển thị/in (dùng chung cho HR, Kế Toán, nhân viên).
const describePayslip = (p, period) => {
  const fd = P.familyDeduction(period || p.period);
  return {
    period: p.period,
    familyDeduction: fd,
    taxBrackets: P.taxBrackets(p.period).map(([upper, rate]) => ({ upper: upper === Infinity ? null : upper, rate })),
    insuranceRates: { employee: P.EMPLOYEE_RATES, employer: P.EMPLOYER_RATES, cap: P.INSURANCE_CAP },
    otRates: P.OT_RATE
  };
};

module.exports = { getHrSettings, loadPayrollContext, computePayslip, describePayslip, DEFAULT_SETTINGS };
