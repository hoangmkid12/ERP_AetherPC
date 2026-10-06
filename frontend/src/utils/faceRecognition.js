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
 * Bám theo khuôn mặt để đo hướng đầu thật nhanh trong lúc làm thử thách quay trái/phải.
 * Bước phát hiện mặt (chậm nhất) chỉ chạy định kỳ để cập nhật vị trí và kiểm tra có người thứ hai;
 * các khung ở giữa chỉ chạy mô hình 68 điểm mốc trên vùng mặt đã cắt sẵn — nhanh gấp ~3 lần.
 */
export const createFaceTracker = ({ redetectEvery = 4 } = {}) => {
  const crop = document.createElement('canvas');
  crop.width = 192;
  crop.height = 192;
  const ctx = crop.getContext('2d');
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
        // Nới vùng cắt 30% quanh khung mặt để điểm mốc không bị cụt khi người dùng quay đầu.
        const side = Math.max(b.width, b.height) * 1.3;
        box = { x: b.x + b.width / 2 - side / 2, y: b.y + b.height / 2 - side / 2, side, width: b.width };
      }
      ctx.clearRect(0, 0, crop.width, crop.height);
      ctx.drawImage(video, box.x, box.y, box.side, box.side, 0, 0, crop.width, crop.height);
      const landmarks = await faceapi.detectFaceLandmarks(crop);
      return { status: 'ok', width: box.width, yaw: headYaw(landmarks) };
    }
  };
};

/**
 * Độ quay đầu trái/phải: vị trí đầu mũi chiếu lên trục nối hai mép mặt (điểm mốc 0 và 16), quy về
 * −0,5…0,5 (0 ≈ nhìn thẳng). Mặt thật quay đi thì mũi — nhô ra phía trước — lệch rõ về một bên; còn ảnh
 * in hay ảnh trên điện thoại dù bị xoay, nghiêng thì mọi điểm co giãn cùng tỉ lệ nên giá trị gần như không đổi.
 */
export const headYaw = (landmarks) => {
  if (!landmarks) return null;
  const jaw = landmarks.getJawOutline();
  const nose = landmarks.getNose()[3];
  const ax = jaw[16].x - jaw[0].x;
  const ay = jaw[16].y - jaw[0].y;
  const len2 = ax * ax + ay * ay;
  if (len2 < 1) return null;
  return ((nose.x - jaw[0].x) * ax + (nose.y - jaw[0].y) * ay) / len2 - 0.5;
};

/**
 * Thử thách xác nhận người thật: nhìn thẳng → quay đầu sang TRÁI → quay sang PHẢI → nhìn thẳng lại.
 * Độ lệch được so với tư thế nhìn thẳng của chính người dùng (đo trong vài khung đầu). Khung hình đưa vào
 * nhận diện là ảnh gốc từ camera (chỉ phần hiển thị mới lật gương), trên đó người dùng quay sang trái của họ
 * thì đầu mũi lệch về phía phải ảnh, tức headYaw TĂNG; quay sang phải thì headYaw GIẢM.
 */
const TURN = 0.12;   // lệch tối thiểu so với tư thế nhìn thẳng để tính là đã quay đầu
const FRONT = 0.06;  // lệch tối đa để tính là đang nhìn thẳng
export const createHeadTurnChallenge = () => {
  let base = null;
  let warmup = [];
  let step = 'calibrating'; // calibrating | left | right | front | done
  let wrongWay = false;
  return {
    get step() { return step; },
    /** true nếu khung gần nhất đang quay sai hướng so với yêu cầu (để nhắc người dùng). */
    get wrongWay() { return wrongWay; },
    /** Đưa vào độ quay đầu của khung hiện tại; trả về bước hiện tại sau khi cập nhật. */
    update(yaw) {
      if (yaw == null || !Number.isFinite(yaw)) return step;
      if (step === 'calibrating') {
        warmup.push(yaw);
        if (warmup.length > 5) warmup.shift();
        // Chỉ lấy mốc khi người dùng giữ đầu ổn định (5 khung liên tiếp lệch nhau không quá FRONT).
        if (warmup.length === 5 && Math.max(...warmup) - Math.min(...warmup) < FRONT) {
          base = [...warmup].sort((a, b) => a - b)[2];
          step = 'left';
        }
        return step;
      }
      const d = yaw - base;
      // Ở bước 'right' người dùng vẫn đang quay trái là bình thường (đang quay về), nên chỉ nhắc ở bước 'left'.
      wrongWay = step === 'left' && d < -TURN;
      if (step === 'left' && d > TURN) step = 'right';
      else if (step === 'right' && d < -TURN) step = 'front';
      else if (step === 'front' && Math.abs(d) < FRONT) step = 'done';
      return step;
    },
    /** Đang nhìn thẳng (để lấy mẫu vector khuôn mặt ổn định) hay không. */
    isFacingFront(yaw) { return base != null && Number.isFinite(yaw) && Math.abs(yaw - base) < FRONT; }
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
