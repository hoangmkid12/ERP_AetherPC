/**
 * Tên model Gemini dùng chung cho mọi nơi gọi Gemini.
 *
 * Đặt qua biến môi trường GEMINI_MODEL để đổi model mà không cần sửa code. Trước đây
 * tên model được gõ cứng ở 11 chỗ ('gemini-2.5-flash'); khi Google ngừng mở model đó
 * cho tài khoản mới, toàn bộ phần Gemini lỗi 404 mà không đổi được nhanh.
 */
// Mặc định dùng bản "flash-lite": đo ngày 2026-10-12, gemini-3.5-flash-lite trả lời trong
// ~1–2 giây và viết SQL đúng, trong khi gemini-3.8-flash mất 5–15 giây và hết hạn mức
// miễn phí nhanh (lỗi 429). Hạn mức miễn phí tính riêng theo từng model.
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';

module.exports = { GEMINI_MODEL };
