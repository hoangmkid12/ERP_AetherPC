import React, { useEffect, useState } from 'react';
import { useHRStore } from '../../stores';
import { useAuth } from '../../context/AuthContext';
import { PAYROLL_STATUS, getStatusInfo, getStatusLabel } from '../../utils/statusLabels';
import { Wallet, TrendingUp, TrendingDown, Calendar } from 'lucide-react';

export default function MyPayroll() {
  const { user } = useAuth();
  const getMyPayrolls = useHRStore(state => state.getMyPayrolls);
  const [payrolls, setPayrolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fmt = (n) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n || 0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (typeof getMyPayrolls !== 'function') return;
      setLoading(true);
      try {
        const data = await getMyPayrolls();
        if (!cancelled) setPayrolls(data);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Không thể tải phiếu lương.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [getMyPayrolls]);

  const latest = payrolls[0];

  return (
    <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '1.5rem 2rem', maxWidth: '900px', margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
      <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Wallet size={24} style={{ color: '#2563eb' }} />
        Phiếu Lương Của Tôi
      </h2>
      <p style={{ color: '#64748b', fontSize: '0.82rem', margin: '0 0 1.5rem' }}>
        {user?.fullname || user?.fullName || 'Nhân viên'} — tra cứu lịch sử phiếu lương cá nhân
      </p>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>Đang tải...</div>
      ) : error ? (
        <div style={{ padding: '1rem', borderRadius: '8px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: '0.85rem' }}>{error}</div>
      ) : payrolls.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          Chưa có phiếu lương nào được lập cho bạn.
        </div>
      ) : (
        <>
          {/* Phiếu lương kỳ gần nhất — nổi bật */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #cbd5e1', padding: '1.5rem', marginBottom: '1.5rem', boxShadow: '0 2px 8px rgba(15,23,42,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#64748b', fontSize: '0.82rem', fontWeight: 700 }}>
                <Calendar size={15} />
                Kỳ Lương {latest.period}
              </div>
              <span style={{
                padding: '3px 10px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 800,
                backgroundColor: getStatusInfo(PAYROLL_STATUS, latest.status).bg,
                color: getStatusInfo(PAYROLL_STATUS, latest.status).color
              }}>
                {getStatusLabel(PAYROLL_STATUS, latest.status)}
              </span>
            </div>

            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a', marginBottom: '1.25rem' }}>
              {fmt(latest.netAmount)}
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8', marginLeft: '0.5rem' }}>thực lĩnh</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', fontSize: '0.82rem' }}>
              <div style={{ padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ color: '#64748b', fontSize: '0.72rem', marginBottom: '0.25rem' }}>Lương Theo Công</div>
                <strong style={{ color: '#0f172a' }}>{fmt(latest.salary)}</strong>
              </div>
              <div style={{ padding: '0.75rem', backgroundColor: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                <div style={{ color: '#16a34a', fontSize: '0.72rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                  <TrendingUp size={12} /> Thưởng/Phụ Cấp
                </div>
                <strong style={{ color: '#16a34a' }}>+{fmt(latest.bonuses)}</strong>
              </div>
              <div style={{ padding: '0.75rem', backgroundColor: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca' }}>
                <div style={{ color: '#dc2626', fontSize: '0.72rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                  <TrendingDown size={12} /> Khấu Trừ Bảo Hiểm
                </div>
                <strong style={{ color: '#dc2626' }}>-{fmt(latest.deductions)}</strong>
              </div>
            </div>
          </div>

          {/* Lịch sử các kỳ trước */}
          <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.75rem' }}>Lịch Sử Phiếu Lương</h3>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Kỳ Lương</th>
                  <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Lương Theo Công</th>
                  <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Thưởng/Phụ Cấp</th>
                  <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Khấu Trừ BH</th>
                  <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Thực Lĩnh</th>
                  <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>Trạng Thái</th>
                </tr>
              </thead>
              <tbody>
                {payrolls.map((p, idx) => (
                  <tr key={p.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: '#0f172a' }}>{p.period}</td>
                    <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', color: '#475569' }}>{fmt(p.salary)}</td>
                    <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', color: '#16a34a' }}>+{fmt(p.bonuses)}</td>
                    <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', color: '#ef4444' }}>-{fmt(p.deductions)}</td>
                    <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>{fmt(p.netAmount)}</td>
                    <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 800,
                        backgroundColor: getStatusInfo(PAYROLL_STATUS, p.status).bg,
                        color: getStatusInfo(PAYROLL_STATUS, p.status).color
                      }}>
                        {getStatusLabel(PAYROLL_STATUS, p.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
