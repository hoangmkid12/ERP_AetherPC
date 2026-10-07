import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  LayoutDashboard, ScanFace, CalendarDays, CalendarCheck, Wallet, UserCircle, BookOpen,
  Clock, LogIn, LogOut, AlertTriangle, CheckCircle2, X, Send, Trash2, Save, KeyRound, Search
} from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { notify } from '../../context/NotificationContext';
import { getRoleName } from '../../utils/rbacEngine';
import { LEAVE_STATUS, ATTENDANCE_STATUS, getStatusInfo, getStatusLabel } from '../../utils/statusLabels';
import FaceCamera from '../../components/HR/FaceCamera';
import PayslipView, { fmtVnd, periodLabel } from '../../components/HR/PayslipView';
import TimesheetPanel from './hr/TimesheetPanel';

const TABS = [
  { key: 'overview', label: 'Tổng Quan', icon: LayoutDashboard },
  { key: 'checkin', label: 'Chấm Công Khuôn Mặt', icon: ScanFace },
  { key: 'attendance', label: 'Lịch Sử Chấm Công', icon: CalendarDays },
  { key: 'leaves', label: 'Nghỉ Phép', icon: CalendarCheck },
  { key: 'payslip', label: 'Phiếu Lương', icon: Wallet },
  { key: 'profile', label: 'Hồ Sơ Cá Nhân', icon: UserCircle },
  { key: 'docs', label: 'Tài Liệu Nội Bộ', icon: BookOpen }
];

const LEAVE_TYPES = [
  { value: 'Phép Năm', hint: 'Trừ vào quỹ phép năm, hưởng nguyên lương' },
  { value: 'Nghỉ Ốm', hint: 'Cần nộp giấy khám bệnh cho phòng Nhân Sự' },
  { value: 'Việc Riêng', hint: 'Kết hôn, tang lễ... theo Điều 115 BLLĐ, hưởng lương' },
  { value: 'Không Lương', hint: 'Không hưởng lương những ngày nghỉ' }
];

const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const card = { backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.25rem', boxShadow: '0 1px 3px rgba(15,23,42,0.04)' };
const input = { width: '100%', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', boxSizing: 'border-box' };
const label = { display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' };
const btn = (bg, color = '#ffffff') => ({ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', backgroundColor: bg, color, border: 'none', borderRadius: '8px', padding: '0.6rem 1.15rem', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer' });
const th = { padding: '0.7rem 0.8rem', textAlign: 'left', fontSize: '0.82rem', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' };
const td = { padding: '0.65rem 0.8rem', fontSize: '0.9rem', borderTop: '1px solid #f1f5f9' };
const currentMonth = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }).slice(0, 7);
const fmtDate = (iso) => (iso ? new Date(`${String(iso).slice(0, 10)}T00:00:00Z`).toLocaleDateString('vi-VN', { timeZone: 'UTC' }) : '');

const Stat = ({ title, value, sub, color = '#2563eb', icon: Icon }) => (
  <div style={{ ...card, display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
    {Icon && <div style={{ backgroundColor: `${color}15`, color, borderRadius: '12px', padding: '0.7rem', display: 'flex', flexShrink: 0 }}><Icon size={22} /></div>}
    <div>
      <div style={{ fontSize: '0.84rem', color: '#64748b', fontWeight: 500 }}>{title}</div>
      <div style={{ fontSize: '1.45rem', fontWeight: 700, color: '#0f172a', lineHeight: 1.3 }}>{value}</div>
      {sub && <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{sub}</div>}
    </div>
  </div>
);

export default function EmployeePortal() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some(t => t.key === params.get('tab')) ? params.get('tab') : 'overview';
  const setTab = (key) => setParams({ tab: key });

  const [profile, setProfile] = useState(null);
  const [today, setToday] = useState(null);
  const [month, setMonth] = useState(currentMonth());
  const [attendance, setAttendance] = useState(null);
  const [leaves, setLeaves] = useState([]);
  const [payslips, setPayslips] = useState([]);
  const [selectedSlip, setSelectedSlip] = useState(null);
  const [holidays, setHolidays] = useState([]);

  const loadProfile = useCallback(() => api.get('/hr/me/profile').then(r => setProfile(r.data)).catch(err => notify(err.message, 'error')), []);
  const loadToday = useCallback(() => api.get('/hr/me/attendance/today').then(r => setToday(r.data)).catch(() => {}), []);
  const loadAttendance = useCallback((m) => api.get(`/hr/me/attendance?month=${m}`).then(r => setAttendance(r.data)).catch(err => notify(err.message, 'error')), []);
  const loadLeaves = useCallback(() => api.get('/hr/leaves').then(r => setLeaves(r.data || [])).catch(() => {}), []);
  const loadPayslips = useCallback(() => api.get('/hr/payrolls/mine').then(r => {
    const list = r.data || [];
    setPayslips(list);
    setSelectedSlip(prev => prev || list[0] || null);
  }).catch(() => {}), []);

  useEffect(() => {
    loadProfile();
    loadToday();
    loadLeaves();
    loadPayslips();
    api.get(`/hr/holidays?year=${new Date().getFullYear()}`).then(r => setHolidays(r.data || [])).catch(() => {});
  }, [loadProfile, loadToday, loadLeaves, loadPayslips]);

  useEffect(() => { loadAttendance(month); }, [month, loadAttendance]);

  const upcomingHolidays = useMemo(() => {
    const now = new Date().toISOString().slice(0, 10);
    return holidays.filter(h => h.date >= now).slice(0, 3);
  }, [holidays]);

  const balance = profile?.leaveBalance;
  const summary = attendance?.summary;
  const rec = today?.record;

  return (
    <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '1.75rem 2rem 2.5rem', maxWidth: '1240px', margin: '0 auto' }}>
      <div style={{ marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <UserCircle size={26} style={{ color: '#2563eb' }} /> Thông Tin Cá Nhân
        </h2>
        <p style={{ color: '#64748b', fontSize: '0.9rem', margin: '0.35rem 0 0' }}>
          Xin chào <strong>{profile?.fullName || user?.fullname || user?.name}</strong> — {profile?.jobTitle || getRoleName(user?.role)}{profile?.department ? ` · ${profile.department}` : ''}
        </p>
      </div>

      <div className="portal-tabs" style={{ display: 'flex', gap: '0.25rem', overflowX: 'auto', marginBottom: '1.5rem', borderBottom: '1px solid #e2e8f0' }}>
        {TABS.map(({ key, label: l, icon: Icon }) => {
          const active = tab === key;
          return (
            <button key={key} type="button" onClick={() => setTab(key)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.7rem 0.75rem', fontSize: '0.9rem', fontWeight: active ? 600 : 500, cursor: 'pointer', whiteSpace: 'nowrap',
                border: 'none', borderBottom: active ? '2px solid #2563eb' : '2px solid transparent', marginBottom: '-1px', backgroundColor: 'transparent', color: active ? '#2563eb' : '#475569' }}>
              <Icon size={17} /> {l}
            </button>
          );
        })}
      </div>

      {tab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', background: 'linear-gradient(135deg,#eff6ff,#ffffff)' }}>
            <div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase' }}>Hôm nay · {fmtDate(today?.date)}</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', marginTop: '0.25rem' }}>
                {today?.holiday ? `Nghỉ lễ: ${today.holiday}` : !today?.isWorkday ? 'Ngày nghỉ hằng tuần' : rec?.checkOut ? 'Đã hoàn thành ca làm việc' : rec?.checkIn ? 'Đang trong ca làm việc' : 'Bạn chưa chấm công vào ca'}
              </div>
              <div style={{ fontSize: '0.875rem', color: '#475569', marginTop: '0.2rem' }}>
                Ca làm việc {today?.shift?.start} – {today?.shift?.end} · Vào ca: <strong>{rec?.checkIn || '--:--'}</strong> · Ra ca: <strong>{rec?.checkOut || '--:--'}</strong>
                {rec?.lateMinutes > 0 && <span style={{ color: '#d97706', fontWeight: 700 }}> · đi muộn {rec.lateMinutes} phút</span>}
              </div>
            </div>
            <button type="button" style={btn('#2563eb')} onClick={() => setTab('checkin')}>
              <ScanFace size={16} /> {rec?.checkIn && !rec?.checkOut ? 'Chấm công ra ca' : 'Chấm công ngay'}
            </button>
          </div>

          {today && !today.hasFace && (
            <div style={{ ...card, borderColor: '#fde68a', backgroundColor: '#fffbeb', display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.9rem', color: '#92400e' }}>
              <AlertTriangle size={18} /> Bạn chưa đăng ký khuôn mặt. Vào mục <strong>Chấm Công Khuôn Mặt</strong> để đăng ký (chỉ làm một lần).
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            <Stat icon={CalendarDays} title={`Ngày công ${periodLabel(attendance?.month)}`} value={`${summary?.workedDays ?? 0} ngày`} sub={`${summary?.workHours ?? 0} giờ làm việc`} />
            <Stat icon={Clock} color="#d97706" title="Đi muộn / về sớm" value={`${(summary?.lateMinutes ?? 0) + (summary?.earlyLeaveMinutes ?? 0)} phút`} sub={`${summary?.lateDays ?? 0} lần đi muộn`} />
            <Stat icon={CalendarCheck} color="#7c3aed" title={`Phép năm ${balance?.year || ''}`} value={`Còn ${balance?.remaining ?? '-'} ngày`} sub={`Được hưởng ${balance?.entitlement ?? '-'} · đã dùng ${balance?.used ?? 0}${balance?.pending ? ` · chờ duyệt ${balance.pending}` : ''}`} />
            <Stat icon={Wallet} color="#16a34a" title={payslips[0] ? `Thực lĩnh ${periodLabel(payslips[0].period)}` : 'Phiếu lương gần nhất'} value={payslips[0] ? fmtVnd(payslips[0].netAmount) : 'Chưa có'} sub="Xem chi tiết ở mục Phiếu Lương" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '0.75rem' }}>
            <div style={card}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.6rem' }}>Đơn nghỉ phép gần đây</h3>
              {leaves.length === 0 ? <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Chưa có đơn nào.</div> : leaves.slice(0, 4).map(l => (
                <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderTop: '1px solid #f1f5f9', fontSize: '0.875rem' }}>
                  <span><strong>{l.type}</strong> · {fmtDate(l.startDate)} → {fmtDate(l.endDate)}</span>
                  <span style={{ fontWeight: 700, color: getStatusInfo(LEAVE_STATUS, l.status).color }}>{getStatusLabel(LEAVE_STATUS, l.status)}</span>
                </div>
              ))}
            </div>
            <div style={card}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.6rem' }}>Ngày lễ sắp tới (nghỉ hưởng nguyên lương)</h3>
              {upcomingHolidays.length === 0 ? <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Không có ngày lễ nào sắp tới trong năm.</div> : upcomingHolidays.map(h => (
                <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderTop: '1px solid #f1f5f9', fontSize: '0.875rem' }}>
                  <span>{h.name}</span><strong>{fmtDate(h.date)}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'checkin' && (
        <CheckInTab
          today={today}
          profile={profile}
          onDone={() => { loadToday(); loadProfile(); loadAttendance(month); }}
        />
      )}

      {tab === 'attendance' && (
        <TimesheetPanel defaultView="my" />
      )}

      {tab === 'leaves' && (
        <LeavesTab balance={balance} leaves={leaves} onChanged={() => { loadLeaves(); loadProfile(); }} />
      )}

      {tab === 'payslip' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 220px) 1fr', gap: '1rem', alignItems: 'start' }} className="portal-payslip-grid">
          <div style={card}>
            <h3 style={{ fontSize: '0.92rem', fontWeight: 700, margin: '0 0 0.5rem' }}>Các kỳ lương</h3>
            {payslips.length === 0 && <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Chưa có phiếu lương nào được Ban Giám Đốc duyệt.</div>}
            {payslips.map(p => (
              <button key={p.id} type="button" onClick={() => setSelectedSlip(p)}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.5rem 0.6rem', marginBottom: '0.3rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem',
                  border: selectedSlip?.id === p.id ? '1px solid #2563eb' : '1px solid #e2e8f0', backgroundColor: selectedSlip?.id === p.id ? '#eff6ff' : '#ffffff' }}>
                <strong>{periodLabel(p.period)}</strong>
                <div style={{ color: '#16a34a', fontWeight: 700 }}>{fmtVnd(p.netAmount)}</div>
              </button>
            ))}
          </div>
          <div style={card}>
            {selectedSlip ? <PayslipView p={selectedSlip} /> : <div style={{ color: '#94a3b8', fontSize: '0.92rem' }}>Chọn một kỳ lương để xem chi tiết.</div>}
          </div>
        </div>
      )}

      {tab === 'profile' && <ProfileTab profile={profile} onSaved={loadProfile} />}
      {tab === 'docs' && <DocsTab />}

      <style>{'@media (max-width: 720px){ .portal-payslip-grid{ grid-template-columns: 1fr !important; } } .portal-tabs::-webkit-scrollbar{ height: 0; }'}</style>
    </div>
  );
}

function CheckInTab({ today, profile, onDone }) {
  const [last, setLast] = useState(null);
  const hasFace = today?.hasFace;
  const rec = last || today?.record;
  const nextAction = rec?.checkIn ? 'OUT' : 'IN';

  if (!today) return <div style={card}>Đang tải...</div>;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem', alignItems: 'start' }}>
      <div style={{ ...card, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 0.25rem' }}>{!hasFace ? 'Đăng ký khuôn mặt lần đầu' : nextAction === 'OUT' ? 'Chấm công RA CA' : 'Chấm công VÀO CA'}</h3>
        <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 1rem', textAlign: 'center' }}>
          {hasFace
            ? (rec?.checkOut ? `Bạn đã ra ca lúc ${rec.checkOut}; chấm lại sẽ cập nhật giờ ra ca muộn nhất.` : rec?.checkIn ? `Bạn đã vào ca lúc ${rec.checkIn}. Lần chấm này sẽ ghi nhận GIỜ RA CA.` : 'Lần chấm này sẽ ghi nhận GIỜ VÀO CA.')
            : 'Hệ thống sẽ lấy 5 mẫu khuôn mặt của bạn. Chỉ cần làm một lần; muốn đăng ký lại phải liên hệ phòng Nhân Sự.'}
        </p>
        {hasFace ? (
          <FaceCamera
            mode="verify"
            submitLabel={nextAction === 'OUT' ? 'Chấm công ra ca' : 'Chấm công lại'}
            onCapture={async ({ descriptor, image }) => {
              const res = await api.post('/hr/me/attendance/check', { descriptor, image });
              setLast(res.data);
              notify(res.message, res.data?.lateMinutes ? 'info' : 'success');
              onDone();
              return { message: res.message, image };
            }}
          />
        ) : (
          <FaceCamera
            mode="register"
            submitLabel="Bắt đầu chấm công"
            onCapture={async ({ descriptor, image }) => {
              const res = await api.post('/hr/me/face', { descriptor, image });
              notify(res.message || 'Đăng ký khuôn mặt thành công.', 'success');
              onDone();
              return { message: 'Đăng ký thành công! Bấm nút bên dưới để chấm công.', image };
            }}
          />
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={card}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.6rem' }}>Chấm công hôm nay · {fmtDate(today.date)}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.7rem' }}>
              <div style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><LogIn size={13} /> Vào ca</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{rec?.checkIn || '--:--'}</div>
              {rec?.lateMinutes > 0 && <div style={{ fontSize: '0.8rem', color: '#d97706', fontWeight: 700 }}>Muộn {rec.lateMinutes} phút</div>}
            </div>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.7rem' }}>
              <div style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><LogOut size={13} /> Ra ca</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{rec?.checkOut || '--:--'}</div>
              {rec?.earlyLeaveMinutes > 0 && <div style={{ fontSize: '0.8rem', color: '#d97706', fontWeight: 700 }}>Về sớm {rec.earlyLeaveMinutes} phút</div>}
            </div>
          </div>
          {rec?.checkOut && (
            <div style={{ marginTop: '0.6rem', fontSize: '0.875rem', color: '#334155' }}>
              Tổng giờ làm <strong>{rec.workHours}h</strong>{rec.overtimeHours ? <> · Tăng ca <strong>{rec.overtimeHours}h</strong></> : null}
            </div>
          )}
        </div>
        <div style={{ ...card, fontSize: '0.85rem', color: '#475569', lineHeight: 1.55 }}>
          <strong style={{ color: '#0f172a' }}>Quy định chấm công</strong>
          <ul style={{ margin: '0.4rem 0 0', paddingLeft: '1.1rem' }}>
            <li>Ca làm việc {today.shift.start} – {today.shift.end}, nghỉ trưa {today.shift.breakMinutes} phút.</li>
            <li>Vào ca muộn quá {today.shift.lateGraceMinutes} phút bị tính đi muộn và trừ lương theo số phút thực tế.</li>
            <li>Làm sau giờ tan ca từ 30 phút trở lên được ghi nhận tăng ca (150% ngày thường, 200% ngày nghỉ, 300% ngày lễ).</li>
            <li>Để xác nhận người thật, hệ thống yêu cầu quay đầu sang trái, sang phải rồi nhìn thẳng lại; ảnh chụp lúc chấm công được lưu làm bằng chứng.</li>
            <li>Lần chấm đầu tiên trong ngày là giờ vào ca; các lần sau (cách giờ vào ca ít nhất 1 phút) cập nhật giờ ra ca.</li>
            <li>Quên chấm công hoặc chấm sai: liên hệ phòng Nhân Sự để điều chỉnh.</li>
          </ul>
        </div>
        {profile?.faceImage && (
          <div style={{ ...card, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <img src={profile.faceImage} alt="" onError={e => { e.currentTarget.style.visibility = 'hidden'; }} style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', backgroundColor: '#e2e8f0', flexShrink: 0 }} />
            <div style={{ fontSize: '0.85rem', color: '#475569' }}>
              <CheckCircle2 size={14} color="#16a34a" style={{ verticalAlign: 'middle' }} /> Khuôn mặt đã đăng ký lúc {new Date(profile.faceRegisteredAt).toLocaleString('vi-VN')}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LeavesTab({ balance, leaves, onChanged }) {
  const [form, setForm] = useState({ type: 'Phép Năm', startDate: '', endDate: '', reason: '' });
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.startDate || !form.endDate) return notify('Vui lòng chọn ngày bắt đầu và kết thúc.', 'error');
    if (!form.reason.trim()) return notify('Vui lòng nhập lý do nghỉ.', 'error');
    setSubmitting(true);
    try {
      const res = await api.post('/hr/leaves', form);
      notify(`Đã gửi đơn nghỉ ${res.data?.days || ''} ngày làm việc, chờ phòng Nhân Sự duyệt.`, 'success');
      setForm({ type: 'Phép Năm', startDate: '', endDate: '', reason: '' });
      onChanged();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const cancel = async (id) => {
    try {
      await api.delete(`/hr/leaves/${id}`);
      notify('Đã rút đơn nghỉ phép.', 'success');
      onChanged();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem', alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
          {[['Được hưởng', balance?.entitlement, '#2563eb'], ['Đã dùng', balance?.used, '#64748b'], ['Còn lại', balance?.remaining, '#16a34a']].map(([t, v, c]) => (
            <div key={t} style={{ ...card, padding: '0.75rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700 }}>{t}</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: c }}>{v ?? '-'}</div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>ngày phép năm</div>
            </div>
          ))}
        </div>
        <form onSubmit={submit} style={card}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.75rem' }}>Tạo đơn xin nghỉ</h3>
          <div style={{ marginBottom: '0.6rem' }}>
            <label style={label}>Loại nghỉ</label>
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} style={input}>
              {LEAVE_TYPES.map(t => <option key={t.value} value={t.value}>{t.value}</option>)}
            </select>
            <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.2rem' }}>{LEAVE_TYPES.find(t => t.value === form.type)?.hint}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.6rem' }}>
            <div><label style={label}>Từ ngày</label><input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value, endDate: f.endDate || e.target.value }))} style={input} /></div>
            <div><label style={label}>Đến ngày</label><input type="date" value={form.endDate} min={form.startDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} style={input} /></div>
          </div>
          <div style={{ marginBottom: '0.75rem' }}>
            <label style={label}>Lý do</label>
            <textarea rows={3} value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} style={{ ...input, resize: 'vertical' }} placeholder="Ví dụ: Về quê giải quyết việc gia đình" />
          </div>
          <button type="submit" disabled={submitting} style={btn(submitting ? '#94a3b8' : '#7c3aed')}><Send size={15} /> {submitting ? 'Đang gửi...' : 'Gửi đơn'}</button>
        </form>
      </div>

      <div style={card}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.6rem' }}>Đơn nghỉ của tôi</h3>
        {leaves.length === 0 && <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Chưa có đơn nào.</div>}
        {leaves.map(l => {
          const st = getStatusInfo(LEAVE_STATUS, l.status);
          return (
            <div key={l.id} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.6rem 0.75rem', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '0.9rem' }}>{l.type}</strong>
                <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '0.78rem', fontWeight: 700, backgroundColor: st.bg, color: st.color }}>{getStatusLabel(LEAVE_STATUS, l.status)}</span>
              </div>
              <div style={{ fontSize: '0.85rem', color: '#475569', marginTop: '0.2rem' }}>{fmtDate(l.startDate)} → {fmtDate(l.endDate)}</div>
              {l.reason && <div style={{ fontSize: '0.84rem', color: '#64748b', marginTop: '0.2rem', whiteSpace: 'pre-line' }}>{l.reason}</div>}
              {l.status === 'PENDING' && (
                <button type="button" onClick={() => cancel(l.id)} style={{ ...btn('#ffffff', '#dc2626'), border: '1px solid #fecaca', padding: '0.25rem 0.6rem', marginTop: '0.4rem', fontSize: '0.8rem' }}>
                  <Trash2 size={13} /> Rút đơn
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProfileTab({ profile, onSaved }) {
  const [form, setForm] = useState({ phone: '', bankName: '', bankAccount: '' });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) setForm({ phone: profile.phone || '', bankName: profile.bankName || '', bankAccount: profile.bankAccount || '' });
  }, [profile]);

  if (!profile) return <div style={card}>Đang tải...</div>;

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/hr/me/profile', form);
      notify('Đã cập nhật thông tin liên hệ.', 'success');
      onSaved();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    if (pw.newPassword.length < 6) return notify('Mật khẩu mới phải có ít nhất 6 ký tự.', 'error');
    if (pw.newPassword !== pw.confirm) return notify('Mật khẩu xác nhận không khớp.', 'error');
    try {
      await api.put('/auth/change-password', { currentPassword: pw.currentPassword, newPassword: pw.newPassword });
      notify('Đã đổi mật khẩu.', 'success');
      setPw({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const info = [
    ['Mã nhân viên', profile.employeeCode], ['Email đăng nhập', profile.email], ['Phòng ban', profile.department],
    ['Chức danh', profile.jobTitle || getRoleName(profile.role)], ['Ngày vào làm', fmtDate(profile.hireDate)],
    ['Lương cơ bản', fmtVnd(profile.baseSalary)], ['Phụ cấp chức vụ', fmtVnd(profile.responsibilityAllowance)],
    ['Phụ cấp ăn trưa/đi lại', fmtVnd(profile.allowance)], ['Người phụ thuộc (giảm trừ thuế)', `${profile.dependents || 0} người`],
    ['Mã số thuế cá nhân', profile.personalTaxCode || '—'], ['Số CCCD', profile.idNumber || '—']
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem', alignItems: 'start' }}>
      <div style={card}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.6rem' }}>Thông tin hồ sơ (do phòng Nhân Sự quản lý)</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}><tbody>
          {info.map(([k, v]) => (
            <tr key={k}><td style={{ ...td, color: '#64748b' }}>{k}</td><td style={{ ...td, fontWeight: 700, textAlign: 'right' }}>{v}</td></tr>
          ))}
        </tbody></table>
        <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.5rem' }}>Cần thay đổi lương, chức danh, người phụ thuộc? Gửi giấy tờ cho phòng Nhân Sự cập nhật.</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={card}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.6rem' }}>Liên hệ & tài khoản nhận lương</h3>
          <div style={{ marginBottom: '0.55rem' }}><label style={label}>Số điện thoại</label><input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} style={input} placeholder="09xxxxxxxx" /></div>
          <div style={{ marginBottom: '0.55rem' }}><label style={label}>Ngân hàng</label><input value={form.bankName} onChange={e => setForm(f => ({ ...f, bankName: e.target.value }))} style={input} placeholder="Ví dụ: Vietcombank" /></div>
          <div style={{ marginBottom: '0.75rem' }}><label style={label}>Số tài khoản</label><input value={form.bankAccount} onChange={e => setForm(f => ({ ...f, bankAccount: e.target.value }))} style={input} /></div>
          <button type="button" onClick={save} disabled={saving} style={btn(saving ? '#94a3b8' : '#2563eb')}><Save size={15} /> Lưu thay đổi</button>
        </div>
        <div style={card}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.6rem' }}>Đổi mật khẩu</h3>
          {[['currentPassword', 'Mật khẩu hiện tại'], ['newPassword', 'Mật khẩu mới'], ['confirm', 'Nhập lại mật khẩu mới']].map(([k, l]) => (
            <div key={k} style={{ marginBottom: '0.55rem' }}><label style={label}>{l}</label><input type="password" value={pw[k]} onChange={e => setPw(p => ({ ...p, [k]: e.target.value }))} style={input} /></div>
          ))}
          <button type="button" onClick={changePassword} style={btn('#0f172a')}><KeyRound size={15} /> Đổi mật khẩu</button>
        </div>
      </div>
    </div>
  );
}

const DOC_CATEGORIES = { WARRANTY_RMA: 'Bảo hành & Đổi trả', SALES_POLICY: 'Chính sách bán hàng', WAREHOUSE_LOGISTICS: 'Kho vận', TECHNICAL_SOP: 'Quy trình kỹ thuật', ERP_MANUAL: 'Hướng dẫn ERP', GENERAL: 'Quy định chung' };

function DocsTab() {
  const [docs, setDocs] = useState([]);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);

  useEffect(() => {
    api.get('/knowledge').then(r => setDocs(r.data || [])).catch(err => notify(err.message, 'error'));
  }, []);

  const filtered = docs.filter(d => !q || `${d.title} ${d.summary || ''}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div style={card}>
      <div style={{ position: 'relative', maxWidth: 360, marginBottom: '0.85rem' }}>
        <Search size={15} style={{ position: 'absolute', left: 10, top: 10, color: '#94a3b8' }} />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Tìm quy trình, chính sách, hướng dẫn..." style={{ ...input, paddingLeft: '2rem' }} />
      </div>
      {filtered.length === 0 && <div style={{ fontSize: '0.9rem', color: '#94a3b8' }}>Không có tài liệu nào.</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.65rem' }}>
        {filtered.map(d => (
          <button key={d.id} type="button" onClick={() => setOpen(d)} style={{ textAlign: 'left', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem', backgroundColor: '#ffffff', cursor: 'pointer' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase' }}>{DOC_CATEGORIES[d.category] || d.category}</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', margin: '0.2rem 0' }}>{d.title}</div>
            <div style={{ fontSize: '0.82rem', color: '#64748b', lineHeight: 1.4 }}>{(d.summary || d.content || '').slice(0, 130)}{(d.summary || d.content || '').length > 130 ? '…' : ''}</div>
          </button>
        ))}
      </div>
      {open && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={() => setOpen(null)}>
          <div style={{ ...card, maxWidth: 760, width: '100%', maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>{open.title}</h3>
              <button type="button" onClick={() => setOpen(null)} style={{ border: 'none', background: '#f1f5f9', borderRadius: 6, padding: 4, cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.9rem', color: '#334155', lineHeight: 1.6, marginTop: '0.75rem' }}>{open.content}</div>
          </div>
        </div>
      )}
    </div>
  );
}
