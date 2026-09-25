// In một chứng từ (phiếu đề xuất, phiếu báo giá, PO, phiếu nhập, biên bản QC, hoá đơn...) cân
// đối trên đúng 1 trang A4 dọc.
//
// Trước đây mỗi màn hình tự gọi window.print() kèm CSS "ẩn cả trang, position:fixed phiếu" —
// phiếu nằm trong modal có max-height 90vh + overflow nên bản in bị cắt, dồn về góc trái với bề
// rộng của modal (640–720px) và tràn sang trang 2. Hàm này chép phiếu sang một iframe riêng, bỏ
// mọi giới hạn cuộn/khung modal, trải phiếu hết bề ngang vùng in A4 và tự thu nhỏ (zoom) khi phiếu
// dài hơn 1 trang.
//
// Quy ước trong phiếu: phần tử có class `aetherpc-no-print` (nút Đóng/In...) bị ẩn khi in; phần tử
// `aetherpc-print-only` (ẩn trên màn hình) được hiện khi in.

const PAGE_MARGIN_MM = 12;
const MM_TO_PX = 96 / 25.4;
// @page margin = 0 nên vùng in = toàn bộ tờ A4; lề thực nằm trong body padding
const PRINTABLE_WIDTH_PX = (210 - PAGE_MARGIN_MM * 2) * MM_TO_PX;
const PRINTABLE_HEIGHT_PX = (297 - PAGE_MARGIN_MM * 2) * MM_TO_PX;
// Phiếu cần thu nhỏ quá mức này thì để tràn nhiều trang thay vì in chữ quá bé không đọc được.
const MIN_FIT_SCALE = 0.55;

const PRINT_CSS = `
  /* margin: 0 => browser không có vùng margin để vẽ header/footer (ngày, URL, tiêu đề) */
  @page { size: A4 portrait; margin: 0; }
  html { margin: 0 !important; padding: 0 !important; background: #ffffff !important; }
  body {
    margin: 0 !important;
    /* Lề thực thay thế cho @page margin — nằm trong nội dung, không phải vùng header/footer */
    padding: ${PAGE_MARGIN_MM}mm !important;
    background: #ffffff !important;
    height: auto !important;
    overflow: visible !important;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #0f172a;
  }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; box-sizing: border-box; }
  .aetherpc-print-root { width: ${PRINTABLE_WIDTH_PX}px; margin: 0 auto; transform-origin: top center; }
  .aetherpc-print-root > * {
    width: 100% !important; max-width: none !important; margin: 0 !important;
    border: none !important; border-radius: 0 !important; box-shadow: none !important;
  }
  /* Bảo vệ grid/flex/table bên trong: không override width con cháu, chỉ reset wrapper ngoài cùng */
  .aetherpc-print-root > * > * { width: auto !important; max-width: none !important; }
  .aetherpc-print-root table { width: 100% !important; border-collapse: collapse; }
  .aetherpc-print-root table, .aetherpc-print-root table * { max-width: none !important; }
  .aetherpc-print-root td, .aetherpc-print-root th { box-sizing: border-box; }
  .aetherpc-print-root, .aetherpc-print-root * { max-height: none !important; overflow: visible !important; }
  .aetherpc-print-root [style*="position: fixed"], .aetherpc-print-root [style*="position: sticky"] { position: static !important; }
  .aetherpc-print-root table { page-break-inside: auto; }
  .aetherpc-print-root tr { page-break-inside: avoid; }
  .aetherpc-no-print, .aetherpc-print-root button { display: none !important; }
  .aetherpc-print-only { display: block !important; }
`;

// cloneNode không mang theo giá trị đang nhập của input/textarea/select do React điều khiển.
const copyFormValues = (src, dst) => {
  const srcFields = src.querySelectorAll('input, textarea, select');
  const dstFields = dst.querySelectorAll('input, textarea, select');
  srcFields.forEach((field, i) => {
    const target = dstFields[i];
    if (!target) return;
    if (field.tagName === 'TEXTAREA') target.textContent = field.value;
    else if (field.tagName === 'SELECT') {
      Array.from(target.options).forEach((opt, j) => { if (field.options[j]?.selected) opt.setAttribute('selected', 'selected'); });
    } else if (field.type === 'checkbox' || field.type === 'radio') {
      if (field.checked) target.setAttribute('checked', 'checked');
    } else target.setAttribute('value', field.value);
  });
};

/**
 * @param {Element|string} target  phần tử (hoặc CSS selector) bao trọn chứng từ cần in
 * @param {{ title?: string, fitOnePage?: boolean }} [options]
 */
export function printDocument(target, { title = 'AetherPC', fitOnePage = true } = {}) {
  const source = typeof target === 'string' ? document.querySelector(target) : target;
  if (!source) {
    window.print();
    return;
  }

  document.getElementById('aetherpc-print-frame')?.remove();
  const iframe = document.createElement('iframe');
  iframe.id = 'aetherpc-print-frame';
  iframe.setAttribute('aria-hidden', 'true');
  Object.assign(iframe.style, { position: 'fixed', right: '0', bottom: '0', width: '210mm', height: '297mm', border: '0', visibility: 'hidden' });
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  // Giữ nguyên stylesheet của ứng dụng (class dùng chung như .badge, font...) rồi phủ CSS in lên sau.
  // Chỉ lấy trong <head>: các <style> nằm trong modal là CSS @media print kiểu cũ (ẩn cả trang,
  // position:fixed phiếu) — chép sang sẽ phá bố cục bản in.
  const appStyles = Array.from(document.head.querySelectorAll('link[rel="stylesheet"], style'))
    .map(node => node.outerHTML).join('\n');
  doc.open();
  doc.write(`<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><title>${title.replace(/</g, '&lt;')}</title>${appStyles}<style>${PRINT_CSS}</style></head><body><div class="aetherpc-print-root"></div></body></html>`);
  doc.close();

  const clone = source.cloneNode(true);
  copyFormValues(source, clone);
  clone.querySelectorAll('style').forEach(node => node.remove());
  clone.removeAttribute('id');
  doc.querySelector('.aetherpc-print-root').appendChild(doc.importNode(clone, true));

  const runPrint = () => {
    const root = doc.querySelector('.aetherpc-print-root');
    if (fitOnePage && root) {
      const height = root.scrollHeight;
      if (height > PRINTABLE_HEIGHT_PX) {
        const scale = PRINTABLE_HEIGHT_PX / height;
        if (scale >= MIN_FIT_SCALE) {
          // zoom thu nhỏ cả bố cục (không chỉ hình ảnh như transform) nên trình duyệt phân
          // trang đúng theo chiều cao sau khi thu — phiếu nằm gọn 1 trang.
          root.style.zoom = String(Math.floor(scale * 1000) / 1000);
        }
      }
    }
    const win = iframe.contentWindow;
    const cleanup = () => setTimeout(() => iframe.remove(), 500);
    win.addEventListener('afterprint', cleanup, { once: true });
    win.focus();
    win.print();
    // Một số trình duyệt không phát afterprint cho iframe.
    setTimeout(() => iframe.isConnected && iframe.remove(), 60000);
  };

  // Chờ stylesheet/ảnh (logo, ảnh chứng từ) tải xong mới đo chiều cao.
  const pending = Array.from(doc.querySelectorAll('link[rel="stylesheet"], img'))
    .filter(el => (el.tagName === 'IMG' ? !el.complete : !el.sheet));
  if (pending.length === 0) {
    setTimeout(runPrint, 50);
    return;
  }
  let left = pending.length;
  const done = () => { left -= 1; if (left === 0) setTimeout(runPrint, 50); };
  pending.forEach(el => {
    el.addEventListener('load', done, { once: true });
    el.addEventListener('error', done, { once: true });
  });
  setTimeout(() => { if (left > 0) { left = 0; runPrint(); } }, 3000);
}
