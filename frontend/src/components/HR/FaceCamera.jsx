import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, RefreshCw, CheckCircle2, AlertTriangle, Loader2, ScanFace, Eye, UserCheck } from 'lucide-react';
import {
  loadFaceModels, detectFace, createFaceTracker, createBlinkDetector, snapshot, averageDescriptors
} from '../../utils/faceRecognition';

const REGISTER_SAMPLES = 5;
const FAST_INTERVAL = 15;   // ms nghỉ giữa hai lần quét khi chờ nháy mắt (bám mặt + điểm mốc)
const SLOW_HINT_AFTER = 6000; // ms: chưa thấy nháy mắt thì nhắc nháy chậm, rõ hơn

const STEPS = [
  { key: 'face', label: 'Nhìn thẳng camera', icon: ScanFace },
  { key: 'blink', label: 'Nháy mắt / quay đầu', icon: Eye },
  { key: 'verify', label: 'Xác thực', icon: UserCheck }
];

/**
 * Khung camera chấm công / đăng ký khuôn mặt, có kiểm tra người thật (yêu cầu nháy mắt).
 * - mode="verify": chụp 1 mẫu sau khi nháy mắt rồi gọi onCapture({ descriptor, image }).
 * - mode="register": gom REGISTER_SAMPLES mẫu, lấy trung bình để vector ổn định hơn.
 * onCapture trả Promise; nếu reject, thông báo lỗi hiển thị và cho thử lại.
 */
export default function FaceCamera({ mode = 'verify', onCapture, submitLabel, compact = false }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const stateRef = useRef(null);
  const [phase, setPhase] = useState('loading'); // loading | scanning | submitting | done | error
  const [step, setStep] = useState('face');      // face | blink | verify
  const [hint, setHint] = useState('Đang tải mô hình nhận diện khuôn mặt...');
  const [tone, setTone] = useState('info');      // info | warn | ok | error
  const [result, setResult] = useState(null);

  const freshState = () => ({ blink: createBlinkDetector(), tracker: createFaceTracker(), live: false, samples: [], busy: false, startedAt: Date.now() });

  const stopCamera = useCallback(() => {
    clearTimeout(timerRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  const say = (t, h) => { setTone(t); setHint(h); };

  const finish = useCallback(async (descriptor, image) => {
    setPhase('submitting');
    setStep('verify');
    say('info', 'Đang xác thực với máy chủ...');
    try {
      const res = await onCapture({ descriptor, image });
      setResult(res);
      setPhase('done');
      say('ok', res?.message || 'Thành công.');
    } catch (err) {
      setPhase('error');
      say('error', err?.message || 'Xác thực thất bại, vui lòng thử lại.');
    } finally {
      stopCamera();
    }
  }, [onCapture, stopCamera]);

  const tick = useCallback(async () => {
    const video = videoRef.current;
    const st = stateRef.current;
    if (!video || !streamRef.current || !st || st.busy) return;
    st.busy = true;
    let delay = FAST_INTERVAL;
    try {
      if (video.readyState < 2) return;

      if (!st.live) {
        // Giai đoạn 1: chờ nháy mắt — bám theo khuôn mặt, chỉ đo điểm mốc mắt cho nhanh.
        const face = await st.tracker.next(video);
        if (face.status === 'none') { st.blink = createBlinkDetector(); setStep('face'); say('warn', 'Không thấy khuôn mặt — hãy nhìn thẳng vào camera.'); return; }
        if (face.status === 'multiple') { st.blink = createBlinkDetector(); setStep('face'); say('warn', `Có ${face.count} người trong khung hình — chỉ một người được đứng trước camera.`); return; }
        if (face.width < video.videoWidth * 0.2) { st.blink = createBlinkDetector(); setStep('face'); say('warn', 'Hãy đưa mặt lại gần camera hơn.'); return; }

        const state = st.blink.update(face.eyes);
        setStep('blink');
        if (state === 'calibrating') { say('info', 'Đã thấy khuôn mặt, giữ yên một chút...'); return; }
        if (state === 'closing') { say('info', 'Tốt, giờ mở mắt ra...'); return; }
        if (state === 'turning') { say('info', 'Tốt, giờ quay lại nhìn thẳng camera...'); return; }
        if (state === 'blink') {
          st.live = true;
          setStep('verify');
          say('ok', 'Đã xác nhận người thật. Đang nhận diện khuôn mặt...');
          delay = 60;
          return;
        }
        const slow = Date.now() - st.startedAt > SLOW_HINT_AFTER;
        say('info', slow
          ? 'Chưa nhận được — hãy QUAY NHẸ ĐẦU sang trái (hoặc phải) rồi nhìn thẳng lại, hoặc nhắm hẳn mắt nửa giây rồi mở ra.'
          : 'Hãy NHÁY MẮT hoặc QUAY NHẸ ĐẦU sang một bên rồi nhìn thẳng lại để xác nhận người thật.');
        return;
      }

      // Giai đoạn 2: đã qua kiểm tra người thật — trích vector khi mắt mở.
      delay = 120;
      // Chỉ lấy mẫu khi mắt đã mở lại (đo bằng cùng cách với lúc phát hiện nháy mắt).
      const tracked = await st.tracker.next(video);
      if (tracked.status !== 'ok') { say('warn', 'Giữ khuôn mặt trong khung hình...'); return; }
      if (!st.blink.isOpen(tracked.eyes)) return;
      const face = await detectFace(video);
      if (!face || face.multiple) { say('warn', 'Giữ khuôn mặt trong khung hình...'); return; }
      if (mode === 'register') {
        st.samples.push(face.descriptor);
        say('ok', `Đang lấy mẫu khuôn mặt ${st.samples.length}/${REGISTER_SAMPLES} — giữ yên, hơi xoay nhẹ đầu...`);
        if (st.samples.length >= REGISTER_SAMPLES) {
          await finish(averageDescriptors(st.samples), snapshot(video));
        }
      } else {
        await finish(face.descriptor, snapshot(video));
      }
    } catch (err) {
      say('error', err.message || 'Lỗi nhận diện.');
    } finally {
      st.busy = false;
      if (streamRef.current) timerRef.current = setTimeout(tick, delay);
    }
  }, [finish, mode]);

  const start = useCallback(async () => {
    stopCamera();
    stateRef.current = freshState();
    setResult(null);
    setPhase('loading');
    setStep('face');
    say('info', 'Đang chuẩn bị camera...');
    if (!navigator.mediaDevices?.getUserMedia) {
      setPhase('error');
      say('error', 'Trình duyệt không cho phép dùng camera. Camera chỉ hoạt động trên HTTPS hoặc localhost.');
      return;
    }
    try {
      say('info', 'Đang tải mô hình nhận diện khuôn mặt (lần đầu khoảng 7MB)...');
      await loadFaceModels();
      say('info', 'Đang mở camera...');
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      stateRef.current = freshState();
      setPhase('scanning');
      say('info', 'Đặt khuôn mặt vào giữa khung hình.');
      timerRef.current = setTimeout(tick, 300);
    } catch (err) {
      stopCamera();
      setPhase('error');
      const CAMERA_ERRORS = {
        NotAllowedError: 'Bạn đã chặn quyền truy cập camera. Hãy cho phép camera trong cài đặt trình duyệt rồi thử lại.',
        NotFoundError: 'Không tìm thấy camera trên thiết bị này.',
        NotReadableError: 'Camera đang được ứng dụng khác sử dụng (Zoom, Teams...). Hãy tắt ứng dụng đó rồi thử lại.',
        NotSupportedError: 'Trình duyệt hoặc thiết bị không hỗ trợ camera.',
        OverconstrainedError: 'Camera không đáp ứng được độ phân giải yêu cầu.'
      };
      say('error', CAMERA_ERRORS[err?.name] || (err?.message && !/^[A-Za-z ]+$/.test(err.message) ? err.message : 'Không mở được camera. Vui lòng thử lại.'));
    }
  }, [stopCamera, tick]);

  useEffect(() => {
    start();
    return stopCamera;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toneColor = { info: '#2563eb', warn: '#d97706', ok: '#16a34a', error: '#dc2626' }[tone];
  const size = compact ? 260 : 320;
  const stepIndex = phase === 'done' ? STEPS.length : STEPS.findIndex(s => s.key === step);
  const showVideo = phase === 'scanning' || phase === 'submitting';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        {STEPS.map((s, i) => {
          const doneStep = i < stepIndex;
          const active = i === stepIndex && phase !== 'error';
          const color = doneStep ? '#16a34a' : active ? '#2563eb' : '#94a3b8';
          const Icon = doneStep ? CheckCircle2 : s.icon;
          return (
            <React.Fragment key={s.key}>
              {i > 0 && <div style={{ width: 22, height: 2, backgroundColor: doneStep || active ? '#93c5fd' : '#e2e8f0' }} />}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem', fontWeight: active ? 600 : 500, color }}>
                <Icon size={17} /> {s.label}
              </div>
            </React.Fragment>
          );
        })}
      </div>

      <div style={{ position: 'relative', width: size, height: size, borderRadius: '50%', overflow: 'hidden', border: `4px solid ${toneColor}`, backgroundColor: '#0f172a', boxShadow: `0 0 0 8px ${toneColor}1f`, transition: 'border-color 0.2s, box-shadow 0.2s' }}>
        <video
          ref={videoRef}
          muted
          playsInline
          style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)', display: showVideo ? 'block' : 'none' }}
        />
        {!showVideo && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e2e8f0' }}>
            {phase === 'loading' && <Loader2 size={48} style={{ animation: 'face-spin 1s linear infinite' }} />}
            {phase === 'done' && (result?.image || result?.data?.faceImage)
              ? <img src={result.image || result.data.faceImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : phase === 'done' ? <CheckCircle2 size={64} color="#4ade80" /> : null}
            {phase === 'error' && <AlertTriangle size={56} color="#f87171" />}
          </div>
        )}
        {phase === 'submitting' && (
          <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ScanFace size={64} color="#ffffff" />
          </div>
        )}
      </div>

      <div style={{ minHeight: '2.8rem', maxWidth: 440, textAlign: 'center', fontSize: '0.95rem', fontWeight: 600, color: toneColor, lineHeight: 1.45 }}>
        {hint}
      </div>

      {(phase === 'error' || phase === 'done') && (
        <button
          type="button"
          onClick={start}
          style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.6rem 1.25rem', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#0f172a', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer' }}
        >
          {phase === 'done' ? <Camera size={17} /> : <RefreshCw size={17} />}
          {phase === 'done' ? (submitLabel || 'Chấm công lần nữa') : 'Thử lại'}
        </button>
      )}
      <style>{'@keyframes face-spin { to { transform: rotate(360deg); } }'}</style>
    </div>
  );
}
