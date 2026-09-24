import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { MapPin, Phone, PackageSearch, CheckCircle2 } from 'lucide-react';
import { api } from '../../services/api';
import DeliveryMap from '../../components/DeliveryMap';
import DeliveryProgressStepper from '../../components/DeliveryProgressStepper';
import { REGION_COORDS, detectDeliveryRegion } from '../../utils/deliveryRegions';

// Trang theo dõi đơn công khai — không cần đăng nhập, chỉ cần biết mã đơn
// hàng (giống tra cứu mã vận đơn GHTK/Grab). Dùng lại đúng REST endpoint và
// kênh WebSocket /ws/tracking mà "Đơn Mua Của Tôi" (MyOrders.jsx) đã dùng.
export default function TrackOrder() {
  const { orderId } = useParams();
  const [tracking, setTracking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [livePosition, setLivePosition] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmedMsg, setConfirmedMsg] = useState('');

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;
    setLoading(true);
    setError('');

    api.get(`/orders/${orderId}/tracking`)
      .then((res) => {
        if (cancelled) return;
        if (res?.success) {
          setTracking(res.data);
          if (res.data?.lastLocation) setLivePosition(res.data.lastLocation);
        } else {
          setError('Không tìm thấy đơn hàng này.');
        }
      })
      .catch(() => { if (!cancelled) setError('Không tìm thấy đơn hàng này.'); })
      .finally(() => { if (!cancelled) setLoading(false); });

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws/tracking`);
    ws.onopen = () => ws.send(JSON.stringify({ type: 'CUSTOMER_TRACK_ORDER', payload: { orderId } }));
    ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data);
        if (data.type === 'DELIVERY_LOCATION_UPDATE' && String(data.orderId) === String(orderId)) {
          setLivePosition({
            lat: data.lat,
            lng: data.lng,
            speed: data.speed,
            heading: data.heading,
            originType: data.originType,
            originCoord: data.originCoord,
            updatedAt: data.updatedAt
          });
          if (data.originType || data.originCoord) {
            setTracking(prev => prev ? ({ ...prev, originType: data.originType || prev.originType, originCoord: data.originCoord || prev.originCoord }) : prev);
          }
        }
      } catch (_) { /* ignore malformed frame */ }
    };

    return () => {
      cancelled = true;
      ws.close();
    };
  }, [orderId]);

  return (
    <div style={{ maxWidth: '780px', margin: '0 auto', padding: 'clamp(1rem, 3vw, 2rem) clamp(1rem, 4vw, 1.5rem)' }}>
      <h1 style={{ fontSize: 'clamp(1.15rem, 2.5vw, 1.4rem)', fontWeight: 800, color: '#0f172a', margin: '0 0 0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <PackageSearch size={24} color="#2563eb" /> Theo Dõi Đơn Hàng #{orderId}
      </h1>
      <p style={{ margin: '0 0 1.25rem', fontSize: '0.85rem', color: '#64748b' }}>
        Vị trí Shipper được cập nhật trực tiếp — không cần đăng nhập.
      </p>

      {loading && (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Đang tải thông tin đơn hàng...</div>
      )}

      {!loading && error && (
        <div style={{ padding: '1.5rem', textAlign: 'center', color: '#b91c1c', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px' }}>
          {error}
        </div>
      )}

      {!loading && !error && tracking && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="card-glass" style={{ padding: '1.25rem', borderRadius: '14px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff' }}>
            <DeliveryProgressStepper status={tracking.status} />
          </div>

          {tracking.shipper && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#334155' }}>
              <MapPin size={16} color="#2563eb" />
              <span>Shipper phụ trách: <strong>{tracking.shipper.name}</strong></span>
              {tracking.shipper.phone && (
                <a href={`tel:${tracking.shipper.phone}`} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#2563eb', textDecoration: 'none', fontWeight: 700 }}>
                  <Phone size={14} /> {tracking.shipper.phone}
                </a>
              )}
            </div>
          )}

          {tracking.status === 'SHIPPED' && tracking.warehouse && (() => {
            const currentOriginType = livePosition?.originType || tracking.originType || 'warehouse';
            const currentOriginCoord = livePosition?.originCoord || tracking.originCoord || null;
            const region = tracking.deliveryRegion || detectDeliveryRegion(tracking.shippingAddress || '');
            const destination = {
              ...(REGION_COORDS[region] || REGION_COORDS.ALL),
              label: tracking.shippingAddress || 'Địa chỉ nhận hàng'
            };
            return (
              <DeliveryMap
                warehouse={tracking.warehouse}
                destination={destination}
                shipperPosition={livePosition}
                shipperName={tracking.shipper?.name}
                shipperPhone={tracking.shipper?.phone}
                originType={currentOriginType}
                originCoord={currentOriginCoord}
              />
            );
          })()}

          {['SHIPPED', 'DELIVERED'].includes(tracking.status) && (
            <div style={{
              padding: '1.15rem 1.35rem',
              backgroundColor: '#f0fdf4',
              border: '1.5px solid #86efac',
              borderRadius: '12px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 800, fontSize: '0.92rem', color: '#15803d' }}>
                  <CheckCircle2 size={18} color="#16a34a" />
                  <span>Xác Nhận Đã Nhận Hàng</span>
                </div>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: '#166534' }}>
                  Nếu bạn đã nhận đủ kiện hàng từ Shipper, hãy xác nhận để hoàn tất đơn hàng. (Tự động hoàn tất sau 48h).
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  if (!window.confirm('Xác nhận bạn đã nhận được kiện hàng này?')) return;
                  setConfirming(true);
                  try {
                    await api.post(`/orders/${orderId}/confirm-received`, { note: 'Khách hàng xác nhận trên trang tra cứu' });
                    setTracking(prev => ({ ...prev, status: 'COMPLETED' }));
                    setConfirmedMsg('Đã xác nhận nhận hàng thành công! Cảm ơn bạn.');
                  } catch (e) {
                    alert('Lỗi khi xác nhận nhận hàng: ' + (e.message || 'Không thành công'));
                  } finally {
                    setConfirming(false);
                  }
                }}
                disabled={confirming}
                style={{
                  padding: '0.55rem 1.25rem',
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  backgroundColor: '#16a34a',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: confirming ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  boxShadow: '0 2px 8px rgba(22,163,74,0.25)'
                }}
              >
                <CheckCircle2 size={16} /> {confirming ? 'Đang xử lý...' : 'Đã Nhận Được Hàng'}
              </button>
            </div>
          )}

          {tracking.status === 'COMPLETED' && (
            <div style={{
              padding: '1rem 1.25rem',
              backgroundColor: '#f0fdf4',
              border: '1px solid #86efac',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: '#15803d',
              fontWeight: 700,
              fontSize: '0.88rem'
            }}>
              <CheckCircle2 size={20} color="#16a34a" />
              <span>{confirmedMsg || 'Đơn hàng này đã được xác nhận nhận hàng thành công (Hoàn tất).'}</span>
            </div>
          )}

          {tracking.status !== 'SHIPPED' && tracking.status !== 'COMPLETED' && (
            <div style={{ padding: '1rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              Bản đồ định vị Shipper sẽ hiện khi đơn chuyển sang trạng thái "Đang giao hàng".
            </div>
          )}
        </div>
      )}
    </div>
  );
}
