// Ghi nhận doanh thu — quy ước chung cho Kế Toán, Dashboard và Bán Hàng.
//
// Một đơn được tính doanh thu khi hàng đã xuất kho cho khách: đúng thời điểm máy chủ trừ tồn
// và ghi bút toán giá vốn (COGS) — xem backend/src/services/orderFulfillment.js. Như vậy
// doanh thu và giá vốn của cùng một đơn luôn nằm cùng kỳ, lợi nhuận gộp không bị lệch.
//  - Đơn chưa xuất kho (chờ duyệt, chờ thanh toán, chờ hàng) chưa có doanh thu.
//  - Đơn huỷ (kể cả kiện giao thất bại đã hoàn về kho) bị loại cùng với giá vốn đã đảo.
//  - Đơn trả hàng hoàn tiền vẫn giữ doanh thu gốc; số tiền hoàn cho khách là khoản "hàng bán
//    bị trả lại" (giảm trừ doanh thu) lấy từ bút toán REFUND.
const NOT_YET_REVENUE = ['PENDING', 'WAITING_PAYMENT', 'AWAITING_STOCK', 'CANCELLED'];

export const isRevenueOrder = (order) => !!order && !NOT_YET_REVENUE.includes(order.status);

// Chi phí nhân sự thật của 1 phiếu lương đã chi = lương thực lĩnh + BH phần NLĐ đã khấu trừ + thuế TNCN
// khấu trừ (đều là tiền doanh nghiệp nộp thay) + BH phần doanh nghiệp đóng (21,5%). Phiếu lương cũ chưa
// có chi tiết bảo hiểm/thuế thì chỉ có lương thực lĩnh.
export const payrollCostOf = (p) => (Number(p?.netSalary) || 0)
  + (Number(p?.employeeInsurance) || 0)
  + (Number(p?.personalIncomeTax) || 0)
  + (Number(p?.employerInsurance) || 0);
