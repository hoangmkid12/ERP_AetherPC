import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, RefreshCw, CheckCircle2, AlertTriangle, Loader2, ScanFace, ArrowLeft, ArrowRight, UserCheck } from 'lucide-react';
import { loadFaceModels, detectFace, createFaceTracker, createHeadTurnChallenge, snapshot, averageDescriptors } from '../../utils/faceRecognition';

const REGISTER_SAMPLES = 5;
const FAST_INTERVAL = 15;      // ms nghỉ giữa hai lần quét trong lúc làm thử thách quay đầu
const LOST_RESET_MS = 2500;    // mất khuôn mặt lâu hơn mức này thì làm lại thử thách từ đầu

const STEPS = [
  { key: 'calibrating', label: 'Nhìn thẳng', icon: ScanFace },
  { key: 'left', label: 'Quay trái', icon: ArrowLeft },
  { key: 'right', label: 'Quay phải', icon: ArrowRight },
  { key: 'verify', label: 'Xác thực', icon: UserCheck }
];
const STEP_INDEX = { calibrating: 0, left: 1, right: 2, front: 3, done: 3, verify: 3 };

const HINTS = {
  calibrating: 'Nhìn thẳng vào camera và giữ yên đầu...',
  left: 'Từ từ QUAY ĐẦU SANG TRÁI.',
  right: 'Tốt! Giờ QUAY ĐẦU SANG PHẢI.',
  front: 'Tốt! Quay lại NHÌN THẲNG vào camera.'
};

/**
 * Khung camera chấm công / đăng ký khuôn mặt, xác nhận người thật bằng thử thách quay đầu trái → phải.
 * - mode="verify": chụp 1 mẫu khi đã nhìn thẳng lại rồi gọi onCapture({ descriptor, image }).
 * - mode="register": gom REGISTER_SAMPLES mẫu khi nhìn thẳng, lấy trung bình để vector ổn định hơn.
 * onCapture trả Promise; nếu reject, thông báo lỗi hiển thị và cho thử lại.
 */
export default function FaceCamera({ mode = 'verify', onCapture, submitLabel, compact = false }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const stateRef = useRef(null);
  const [phase, setPhase] = useState('loading'); // loading | scanning | submitting | done | error
  const [step, setStep] = useState('calibrating');
  const [hint, setHint] = useState('Đang tải mô hình nhận diện khuôn mặt...');
  const [tone, setTone] = useState('info');      // info | warn | ok | error
  const [result, setResult] = useState(null);

  const freshState = () => ({ challenge: createHeadTurnChallenge(), tracker: createFaceTracker(), samples: [], busy: false, lostSince: null });

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
      const face = await st.tracker.next(video);
      if (face.status !== 'ok') {
        st.lostSince = st.lostSince || Date.now();
        // Khi quay đầu mạnh, bộ phát hiện có thể mất mặt vài khung — chỉ làm lại khi mất quá lâu.
        if (Date.now() - st.lostSince > LOST_RESET_MS && st.challenge.step !== 'calibrating') {
          st.challenge = createHeadTurnChallenge();
          setStep('calibrating');
        }
        if (face.status === 'multiple') { st.challenge = createHeadTurnChallenge(); setStep('calibrating'); }
        say('warn', face.status === 'multiple'
          ? `Có ${face.count} người trong khung hình — chỉ một người được đứng trước camera.`
          : 'Không thấy khuôn mặt — hãy đưa mặt vào giữa khung hình.');
        return;
      }
      st.lostSince = null;
      if (face.width < video.videoWidth * 0.18) { say('warn', 'Hãy đưa mặt lại gần camera hơn.'); return; }

      const current = st.challenge.update(face.yaw);
      if (current !== 'done') {
        setStep(current);
        if (current === 'left' && st.challenge.wrongWay) say('warn', 'Bạn đang quay sang phải — hãy quay sang TRÁI trước.');
        else say(current === 'calibrating' ? 'info' : 'ok', HINTS[current]);
        return;
      }

      // Đã qua thử thách: lấy mẫu vector khi đang nhìn thẳng.
      setStep('verify');
      delay = 120;
      if (!st.challenge.isFacingFront(face.yaw)) { say('info', HINTS.front); return; }
      const full = await detectFace(video);
      if (!full || full.multiple) { say('warn', 'Giữ khuôn mặt trong khung hình...'); return; }
      if (mode === 'register') {
        st.samples.push(full.descriptor);
        say('ok', `Đang lấy mẫu khuôn mặt ${st.samples.length}/${REGISTER_SAMPLES} — giữ yên, nhìn thẳng...`);
        if (st.samples.length >= REGISTER_SAMPLES) {
          await finish(averageDescriptors(st.samples), snapshot(video));
        }
      } else {
        await finish(full.descriptor, snapshot(video));
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
    setStep('calibrating');
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
      say('info', HINTS.calibrating);
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
  const stepIndex = phase === 'done' ? STEPS.length : STEP_INDEX[step] ?? 0;
  const showVideo = phase === 'scanning' || phase === 'submitting';
  // Video hiển thị lật gương nên "bên trái của người dùng" nằm ở bên trái màn hình.
  const arrow = phase === 'scanning' && (step === 'left' ? 'left' : step === 'right' ? 'right' : null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        {STEPS.map((s, i) => {
          const doneStep = i < stepIndex;
          const active = i === stepIndex && phase !== 'error';
          const color = doneStep ? '#16a34a' : active ? '#2563eb' : '#94a3b8';
          const Icon = doneStep ? CheckCircle2 : s.icon;
          return (
            <React.Fragment key={s.key}>
              {i > 0 && <div style={{ width: 18, height: 2, backgroundColor: doneStep || active ? '#93c5fd' : '#e2e8f0' }} />}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem', fontWeight: active ? 600 : 500, color }}>
                <Icon size={17} /> {s.label}
              </div>
            </React.Fragment>
          );
        })}
      </div>

      <div style={{ position: 'relative', width: size, height: size }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', overflow: 'hidden', border: `4px solid ${toneColor}`, backgroundColor: '#0f172a', boxShadow: `0 0 0 8px ${toneColor}1f`, transition: 'border-color 0.2s, box-shadow 0.2s' }}>
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
        {arrow && (
          <div style={{ position: 'absolute', top: '50%', [arrow]: -24, transform: 'translateY(-50%)', width: 48, height: 48, borderRadius: '50%', backgroundColor: '#2563eb', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(37,99,235,0.4)', animation: `face-nudge-${arrow} 1s ease-in-out infinite` }}>
            {arrow === 'left' ? <ArrowLeft size={26} /> : <ArrowRight size={26} />}
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
      <style>{`@keyframes face-spin { to { transform: rotate(360deg); } }
        @keyframes face-nudge-left { 0%, 100% { margin-left: 0; } 50% { margin-left: -8px; } }
        @keyframes face-nudge-right { 0%, 100% { margin-right: 0; } 50% { margin-right: -8px; } }`}</style>
    </div>
  );
}
