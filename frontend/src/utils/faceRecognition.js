// Nhận diện khuôn mặt chạy hoàn toàn trên trình duyệt bằng face-api.js (bản @vladmandic, TensorFlow.js).
// Trình duyệt chỉ trích xuất vector đặc trưng 128 chiều; việc SO KHỚP với khuôn mặt đã đăng ký
// do backend thực hiện (hr.routes.js) nên client không thể tự khẳng định "đã khớp".
//
// Thư viện và model (~7MB) được tải từ CDN ở lần dùng đầu tiên rồi được trình duyệt cache lại.
// Có thể trỏ sang bản tự host bằng biến môi trường VITE_FACE_API_URL / VITE_FACE_MODEL_URL.

const FACE_API_VERSION = '1.7.15';
const LIB_URL = import.meta.env.VITE_FACE_API_URL || `https://cdn.jsdelivr.net/npm/@vladmandic/face-api@${FACE_API_VERSION}/dist/face-api.js`;
const MODEL_URL = import.meta.env.VITE_FACE_MODEL_URL || `https://cdn.jsdelivr.net/npm/@vladmandic/face-api@${FACE_API_VERSION}/model/`;

let loadingPromise = null;

// Cấu hình phát hiện mặt: thử inputSize nhỏ trước (nhanh, bắt tốt mặt ở gần webcam) rồi tới lớn hơn.
const DETECT_SIZES = [160, 224, 320];
const DETECT_THRESHOLD = 0.4;

const loadScript = (src) => new Promise((resolve, reject) => {
  if (window.faceapi) return resolve(window.faceapi);
  const el = document.createElement('script');
  el.src = src;
  el.async = true;
  el.onload = () => (window.faceapi ? resolve(window.faceapi) : reject(new Error('Không khởi tạo được thư viện nhận diện khuôn mặt.')));
  el.onerror = () => reject(new Error('Không tải được thư viện nhận diện khuôn mặt. Kiểm tra kết nối Internet.'));
  document.head.appendChild(el);
});

/** Tải thư viện + 3 model cần thiết (phát hiện mặt, 68 điểm mốc, trích đặc trưng). Gọi nhiều lần vẫn chỉ tải 1 lần. */
export const loadFaceModels = () => {
  if (!loadingPromise) {
    loadingPromise = (async () => {
      const faceapi = await loadScript(LIB_URL);
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
      ]);
      // Chạy thử mỗi mạng một lần trên ảnh trống: trình duyệt biên dịch shader WebGL ngay lúc này,
      // tránh để khung hình đầu tiên khi người dùng đã nhìn vào camera bị chậm 1–2 giây.
      try {
        const blank = document.createElement('canvas');
        blank.width = 160;
        blank.height = 160;
        for (const inputSize of DETECT_SIZES) await faceapi.detectAllFaces(blank, new faceapi.TinyFaceDetectorOptions({ inputSize }));
        await faceapi.detectFaceLandmarks(blank);
        await faceapi.computeFaceDescriptor(blank);
      } catch { /* chỉ là bước làm nóng, lỗi ở đây không ảnh hưởng */ }
      return faceapi;
    })().catch(err => {
      loadingPromise = null; // cho phép thử lại
      throw err;
    });
  }
  return loadingPromise;
};

/**
 * Phát hiện đúng 1 khuôn mặt trong khung hình. Trả về null nếu không có mặt nào;
 * { multiple: true } nếu có nhiều hơn 1 người (không cho chấm công hộ khi đứng chung khung).
 */
export const detectFace = async (input) => {
  const faceapi = window.faceapi;
  if (!faceapi) throw new Error('Thư viện nhận diện chưa sẵn sàng.');
  // TinyFaceDetector nhạy theo kích thước mặt: mặt ngồi sát webcam (chiếm 40–60% khung hình) được bắt tốt
  // nhất ở inputSize nhỏ, mặt ở xa cần inputSize lớn hơn — thử lần lượt cho tới khi thấy mặt.
  let results = [];
  for (const inputSize of DETECT_SIZES) {
    const options = new faceapi.TinyFaceDetectorOptions({ inputSize, scoreThreshold: DETECT_THRESHOLD });
    results = await faceapi.detectAllFaces(input, options).withFaceLandmarks().withFaceDescriptors();
    if (results && results.length) break;
  }
  if (!results || results.length === 0) return null;
  if (results.length > 1) return { multiple: true, count: results.length };
  const r = results[0];
  return {
    descriptor: Array.from(r.descriptor),
    score: r.detection.score,
    box: r.detection.box,
    landmarks: r.landmarks
  };
};

/**
 * Bám theo khuôn mặt để đo độ mở mắt thật nhanh trong lúc chờ nháy mắt.
 * Bước phát hiện mặt (chậm nhất) chỉ chạy định kỳ để cập nhật vị trí và kiểm tra có người thứ hai;
 * các khung ở giữa chỉ chạy mô hình 68 điểm mốc trên vùng mặt đã cắt sẵn — nhanh gấp ~3 lần,
 * nên kể cả máy yếu vẫn quét đủ dày để bắt được cái nháy mắt.
 */
export const createFaceTracker = ({ redetectEvery = 6 } = {}) => {
  const crop = document.createElement('canvas');
  crop.width = 192;
  crop.height = 192;
  const ctx = crop.getContext('2d', { willReadFrequently: true });
  let box = null;
  let frame = 0;
  return {
    reset() { box = null; frame = 0; },
    async next(video) {
      const faceapi = window.faceapi;
      if (!faceapi) throw new Error('Thư viện nhận diện chưa sẵn sàng.');
      frame += 1;
      if (!box || frame % redetectEvery === 0) {
        let results = [];
        for (const inputSize of DETECT_SIZES) {
          results = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize, scoreThreshold: DETECT_THRESHOLD }));
          if (results && results.length) break;
        }
        if (!results || results.length === 0) { box = null; return { status: 'none' }; }
        if (results.length > 1) { box = null; return { status: 'multiple', count: results.length }; }
        const b = results[0].box;
        // Nới vùng cắt 25% quanh khung mặt để điểm mốc không bị cụt khi người dùng hơi dịch chuyển.
        const side = Math.max(b.width, b.height) * 1.25;
        box = { x: b.x + b.width / 2 - side / 2, y: b.y + b.height / 2 - side / 2, side, width: b.width };
      }
      // Mọi khung đều đo trên cùng một kiểu vùng cắt để các số đo so sánh được với nhau.
      ctx.clearRect(0, 0, crop.width, crop.height);
      ctx.drawImage(video, box.x, box.y, box.side, box.side, 0, 0, crop.width, crop.height);
      const landmarks = await faceapi.detectFaceLandmarks(crop);
      return { status: 'ok', width: box.width, landmarks, eyes: { ear: eyeAspectRatio(landmarks), contrast: eyeContrast(ctx, landmarks), yaw: headYaw(landmarks) } };
    }
  };
};

// Tỉ lệ mở mắt (Eye Aspect Ratio) tính từ 6 điểm mốc quanh mỗi mắt.
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const ear = (eye) => (dist(eye[1], eye[5]) + dist(eye[2], eye[4])) / (2 * dist(eye[0], eye[3]));
export const eyeAspectRatio = (landmarks) => {
  if (!landmarks) return null;
  return (ear(landmarks.getLeftEye()) + ear(landmarks.getRightEye())) / 2;
};

/**
 * Độ tương phản điểm ảnh vùng mắt (độ lệch chuẩn mức xám). Mắt mở có lòng trắng sáng và tròng đen tối
 * nên tương phản cao; khi nhắm, mí mắt màu da che kín nên vùng mắt gần như đồng màu. Thước đo này nhạy
 * hơn EAR nhiều vì mô hình 68 điểm mốc của face-api thường vẫn "đoán" mắt đang mở khi mắt đã khép.
 * Vùng đo có kích thước cố định theo bề ngang mắt, không phụ thuộc vị trí mí mắt mà mô hình dự đoán.
 */
export const eyeContrast = (ctx, landmarks) => {
  if (!landmarks) return null;
  let total = 0;
  for (const eye of [landmarks.getLeftEye(), landmarks.getRightEye()]) {
    const cx = eye.reduce((s, p) => s + p.x, 0) / eye.length;
    const cy = eye.reduce((s, p) => s + p.y, 0) / eye.length;
    const w = Math.max(6, dist(eye[0], eye[3]) * 1.1);
    const h = Math.max(4, w * 0.5);
    const x0 = Math.max(0, Math.round(cx - w / 2));
    const y0 = Math.max(0, Math.round(cy - h / 2));
    const data = ctx.getImageData(x0, y0, Math.max(1, Math.round(w)), Math.max(1, Math.round(h))).data;
    let sum = 0, sum2 = 0;
    const n = data.length / 4;
    for (let i = 0; i < data.length; i += 4) {
      const g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      sum += g;
      sum2 += g * g;
    }
    total += Math.sqrt(Math.max(0, sum2 / n - (sum / n) ** 2));
  }
  return total / 2;
};

/**
 * Độ quay đầu trái/phải: vị trí đầu mũi giữa hai mép mặt (điểm mốc 0 và 16 ngang tầm mắt), quy về −0,5…0,5.
 * Mặt thật quay đi thì mũi (nhô ra phía trước) lệch rõ về một bên; còn ảnh in/ảnh trên điện thoại dù bị xoay
 * nghiêng thì mọi điểm co giãn cùng tỉ lệ nên giá trị này gần như không đổi — dùng làm thử thách người thật.
 */
export const headYaw = (landmarks) => {
  if (!landmarks) return null;
  const jaw = landmarks.getJawOutline();
  const nose = landmarks.getNose()[3];
  // Chiếu đầu mũi lên trục nối hai mép mặt (thay vì lấy toạ độ x) để nghiêng đầu/xoay ảnh không làm sai số đo.
  const ax = jaw[16].x - jaw[0].x;
  const ay = jaw[16].y - jaw[0].y;
  const len2 = ax * ax + ay * ay;
  if (len2 < 1) return null;
  return ((nose.x - jaw[0].x) * ax + (nose.y - jaw[0].y) * ay) / len2 - 0.5;
};

/**
 * Bộ phát hiện nháy mắt thích ứng, dùng hai thước đo độc lập: EAR (hình dạng mắt theo điểm mốc) và độ
 * tương phản vùng mắt. Không dùng ngưỡng tuyệt đối vì mắt mỗi người, kính, ánh sáng, webcam đều khác nhau;
 * thay vào đó so với mức nền khi mắt mở của chính người đó. Nháy mắt được ghi nhận khi một trong hai
 * thước đo tụt rõ rệt (EAR dưới 85% hoặc tương phản dưới 75% mức nền) rồi hồi lại gần mức nền.
 * Ngoài ra chấp nhận thử thách quay nhẹ đầu sang một bên rồi nhìn thẳng lại (xem headYaw), cho người có mắt
 * nhỏ hoặc webcam kém mà nháy mắt khó đo.
 * Ảnh in hay ảnh trên điện thoại đứng yên thì cả hai thước đo đều không đổi nên không qua được.
 */
const CHANNELS = { ear: { drop: 0.85, recover: 0.93 }, contrast: { drop: 0.75, recover: 0.88 } };
const YAW_TURN = 0.12;
const YAW_BACK = 0.06;
export const createBlinkDetector = () => {
  const base = { ear: null, contrast: null, yaw: null };
  let warmup = [];
  let closedSince = null;
  let turned = false;
  return {
    /** m = { ear, contrast, yaw } của khung hiện tại; trả về 'calibrating' | 'open' | 'closing' | 'turning' | 'blink'. */
    update(m) {
      if (!m || !Number.isFinite(m.ear) || !Number.isFinite(m.contrast)) return 'calibrating';
      if (base.ear == null) {
        warmup.push(m);
        if (warmup.length < 5) return 'calibrating';
        for (const k of [...Object.keys(CHANNELS), 'yaw']) base[k] = warmup.map(x => x[k]).sort((a, b) => a - b)[Math.floor(warmup.length / 2)];
        warmup = [];
      }
      // Thử thách thay thế: quay đầu sang một bên (lệch > 0,12) rồi quay lại nhìn thẳng (lệch < 0,06).
      if (Number.isFinite(m.yaw) && Number.isFinite(base.yaw)) {
        const dy = Math.abs(m.yaw - base.yaw);
        if (!turned && dy > YAW_TURN) { turned = true; return 'turning'; }
        if (turned) {
          if (dy < YAW_BACK) { turned = false; return 'blink'; }
          return 'turning';
        }
      }
      const ratio = (k) => (base[k] > 0 ? m[k] / base[k] : 1);
      const isClosed = Object.keys(CHANNELS).some(k => ratio(k) < CHANNELS[k].drop);
      const isRecovered = Object.keys(CHANNELS).every(k => ratio(k) > CHANNELS[k].recover);
      if (closedSince == null && isClosed) { closedSince = Date.now(); return 'closing'; }
      if (closedSince != null) {
        if (isRecovered) { closedSince = null; return 'blink'; }
        // Nhắm quá 2 giây thì không phải nháy mắt (cúi đầu, che camera...): đo lại mức nền.
        if (Date.now() - closedSince > 2000) { closedSince = null; base.ear = null; base.contrast = null; base.yaw = null; return 'calibrating'; }
        return 'closing';
      }
      // Mắt đang mở: cho mức nền bám theo thay đổi chậm (khoảng cách tới camera, ánh sáng tự động).
      for (const k of Object.keys(CHANNELS)) if (ratio(k) > 0.9) base[k] = base[k] * 0.9 + m[k] * 0.1;
      return 'open';
    },
    /** Mắt đang mở rõ (để lấy mẫu vector khuôn mặt ổn định) hay không. */
    isOpen(m) {
      if (base.ear == null || !m) return false;
      return m.ear >= base.ear * 0.85 && (!Number.isFinite(m.contrast) || m.contrast >= base.contrast * 0.75);
    }
  };
};

/** Chụp 1 khung hình từ video thành ảnh JPEG nhỏ (làm bằng chứng chấm công, ~20–40KB). */
export const snapshot = (video, maxWidth = 320) => {
  const ratio = Math.min(1, maxWidth / (video.videoWidth || maxWidth));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round((video.videoWidth || maxWidth) * ratio);
  canvas.height = Math.round((video.videoHeight || maxWidth * 0.75) * ratio);
  const ctx = canvas.getContext('2d');
  // Lật ngang cho khớp với hình người dùng thấy trên màn hình (camera trước dạng gương).
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.75);
};

/** Trung bình nhiều vector để đăng ký ổn định hơn 1 khung hình đơn lẻ. */
export const averageDescriptors = (list) => {
  const n = list.length;
  return list[0].map((_, i) => list.reduce((s, d) => s + d[i], 0) / n);
};
