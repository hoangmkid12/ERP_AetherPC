// Định dạng mô tả sản phẩm cho trang chi tiết.
//
// Mô tả gốc được thu thập từ nhà phân phối có dạng một chuỗi liền:
//   [chính sách / khuyến mãi của nơi khác] ## [thông số kỹ thuật dồn thành một khối]
//   Đánh giá chi tiết <tên SP> <bài viết với tiêu đề con dính liền vào câu>
// và thường bị cắt ở 1.000 ký tự. Hàm dưới đây giữ lại phần bài viết, tách tiêu đề con,
// chia đoạn dễ đọc; thông số đã có bảng riêng nên không lặp lại ở đây.

const SPEC_START = /^(Thông số (kỹ thuật|kĩ thuật|sản phẩm)|Thông tin (chung|sản phẩm))\s*:?/i;
const REVIEW_START = /(Đánh giá chi tiết|Khám phá|Giới thiệu|Tổng quan)\b/;
const NOISE = [
  /\(\s*Xem chi tiết\s*\)/gi,
  /https?:\/\/\S+/gi,
  /⭐[^⭐]*⭐?/g,
  /QUÀ TẶNG KHÔNG BÁN[^.]*?(bảo hành)/gi,
  /Hỗ trợ trả góp[^.]*\./gi,
  /Hỗ trợ đổi mới trong \d+ ngày\.?/gi,
  /Đã hết hàng\.[^.]*?(tại đây:?)/gi,
  /Sản phẩm chỉ bán (cùng|kèm)[^.#]*/gi, // điều kiện bán của nhà phân phối gốc
];

// Kiểm tra hoa/thường theo ký tự đầu (dải À-Ỹ của Unicode chứa cả chữ thường nên không dùng regex dải)
const firstLetter = (w) => (w.match(/\p{L}/u) || [''])[0];
const isUpper = (w) => { const c = firstLetter(w); return !!c && w[0] === c && c !== c.toLowerCase(); };
const isLowerWord = (w) => { const c = w[0]; return !!c && (c === c.toLowerCase() || /[0-9(\-–/&]/.test(c)); };
// Câu bắt đầu bằng liên từ/đại từ là câu thường, không phải tiêu đề con
const NOT_HEADING_START = new Set(['Và', 'Với', 'Nhờ', 'Ngoài', 'Bên', 'Trong', 'Khi', 'Nếu', 'Đây', 'Đó', 'Bạn', 'Chính', 'Cùng', 'Hãy', 'Tuy', 'Nhưng', 'Do', 'Vì', 'Để', 'Từ', 'Theo', 'Sau', 'Trước', 'Hơn', 'Ngay', 'Nó', 'Chiếc', 'Sản', 'Đặc']);

function cleanup(t) {
  let s = String(t || '').replace(/GEARVN|GearVN|Gearvn/g, 'AetherPC');
  NOISE.forEach(re => { s = s.replace(re, ' '); });
  return s.replace(/\s+/g, ' ').replace(/\s+([,.!?;:])/g, '$1').trim();
}

// Lấy phần bài viết: bỏ khối "Thông tin chung" và "Thông số kỹ thuật" (danh sách khóa–giá trị dồn liền)
function articlePart(text) {
  const parts = text.split(/##/).map(x => x.trim()).filter(Boolean);
  const out = [];
  for (const part of parts) {
    if (SPEC_START.test(part) || /^-\s*Nhà sản xuất/i.test(part) || /^Nhà sản xuất/i.test(part)) {
      // Khối thông số: chỉ giữ phần bài viết nếu nó nằm ở cuối khối ("... Đánh giá chi tiết ...")
      const m = part.match(REVIEW_START);
      if (m && m.index > 0) out.push(part.slice(m.index));
      continue;
    }
    out.push(part);
  }
  return out.join(' ').trim();
}

// Tách câu tiếng Việt (giữ dấu câu)
function sentences(text) {
  return text.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g)?.map(s => s.trim()).filter(Boolean) || [];
}

/**
 * Tách tiêu đề con dính liền ở đầu câu: "Hiệu năng hiển thị mượt mà Tần số quét 144Hz ..."
 * → tiêu đề "Hiệu năng hiển thị mượt mà" + câu "Tần số quét 144Hz ...".
 * Chỉ nhận khi cụm đầu có 3–9 từ, chỉ từ đầu viết hoa, từ kế tiếp viết hoa, và cụm đó không
 * phải phần đầu của tên sản phẩm (tránh cắt nhầm "Chuột gaming không dây | Predator ...").
 */
function splitHeading(sentence, nameLower) {
  const words = sentence.split(' ');
  if (words.length < 8 || !isUpper(words[0]) || NOT_HEADING_START.has(words[0])) return null;
  for (let k = 3; k <= Math.min(9, words.length - 4); k++) {
    const head = words.slice(0, k);
    if (!head.slice(1).every(isLowerWord)) return null;
    const next = words[k];
    if (isUpper(next) && !/^[A-Z0-9]{2,}$/.test(next)) {
      if (/[,;]$/.test(head[head.length - 1])) return null; // cụm kết thúc bằng dấu phẩy là mệnh đề, không phải tiêu đề
      const phrase = head.join(' ').replace(/:$/, '');
      const probe = (phrase + ' ' + next).toLowerCase();
      if (nameLower.includes(probe) || nameLower.includes(phrase.toLowerCase())) return null;
      return { head: phrase, rest: words.slice(k).join(' ') };
    }
  }
  return null;
}

/**
 * @returns {Array<{type: 'h' | 'p', text: string}>}
 */
export function formatDescription(raw, name = '') {
  const text = articlePart(cleanup(raw));
  if (!text) return [];
  const nameLower = String(name).toLowerCase();
  let body = text;
  const blocks = [];

  // Tiêu đề đầu bài: "Đánh giá chi tiết <tên>" / "Khám phá <tên>"
  const firstHead = body.match(REVIEW_START);
  if (firstHead && firstHead.index < 5) {
    const at = name ? body.toLowerCase().indexOf(nameLower.slice(0, 25)) : -1;
    if (at > -1 && at < 60) {
      const end = at + name.length;
      blocks.push({ type: 'h', text: body.slice(0, end).trim() });
      body = body.slice(end).trim();
    }
  }

  let sents = sentences(body);
  // Bỏ câu cuối bị cắt dở (bản ghi gốc giới hạn 1.000 ký tự)
  if (sents.length > 1 && !/[.!?]$/.test(sents[sents.length - 1])) sents = sents.slice(0, -1);

  let para = [];
  const flush = () => { if (para.length) { blocks.push({ type: 'p', text: para.join(' ') }); para = []; } };
  for (const raw of sents) {
    const s = raw.replace(/^[^\p{L}]+/u, ''); // bỏ ký tự rác đầu câu (vd. "0 Bạn có thể...")
    if (!s) continue;
    const h = splitHeading(s, nameLower);
    if (h) {
      flush();
      blocks.push({ type: 'h', text: h.head });
      para.push(h.rest);
      continue;
    }
    para.push(s);
    if (para.length >= 3 || para.join(' ').length > 380) flush();
  }
  flush();
  // Gộp đoạn quá ngắn vào đoạn trước cho cân đối
  const merged = [];
  for (const b of blocks) {
    const last = merged[merged.length - 1];
    if (b.type === 'p' && last?.type === 'p' && b.text.length < 90) last.text += ' ' + b.text;
    else merged.push({ ...b });
  }
  // Tiêu đề cuối không có nội dung theo sau thì bỏ
  while (merged.length && merged[merged.length - 1].type === 'h') merged.pop();
  return merged;
}

export function proseLength(blocks) {
  return blocks.filter(b => b.type === 'p').reduce((n, b) => n + b.text.length, 0);
}

/**
 * Phần giới thiệu dựng từ dữ liệu sản phẩm khi mô tả gốc không còn bài viết dùng được.
 * @returns {{ intro: string, highlights: Array<[string, string]> }}
 */
// Danh từ tự nhiên cho câu giới thiệu theo mã danh mục
const CATEGORY_NOUN = {
  CPU: 'bộ vi xử lý', VGA: 'card màn hình', MAINBOARD: 'bo mạch chủ', RAM: 'bộ nhớ RAM', STORAGE: 'ổ cứng',
  PSU: 'nguồn máy tính', CASE: 'vỏ máy tính', COOLER: 'tản nhiệt', MONITOR: 'màn hình', MOUSE: 'chuột', KEYBOARD: 'bàn phím',
};

export function fallbackOverview(product, { warranty = '', specEntries = [], specLabel = (k) => k } = {}) {
  const brand = product.brand && product.brand !== 'Khác' ? product.brand : '';
  const cat = CATEGORY_NOUN[product.category] || 'linh kiện';
  const highlights = specEntries.slice(0, 6).map(([k, v]) => [specLabel(k), Array.isArray(v) ? v.join(', ') : String(v)]);
  const intro = `${product.name} là ${cat}${brand ? ` chính hãng ${brand}` : ' chính hãng'}, được AetherPC phân phối kèm hóa đơn`
    + `${warranty ? ` và bảo hành ${warranty}` : ''}. Mỗi sản phẩm được ghi nhận số Serial khi xuất kho để thuận tiện tra cứu bảo hành.`;
  return { intro, highlights };
}
