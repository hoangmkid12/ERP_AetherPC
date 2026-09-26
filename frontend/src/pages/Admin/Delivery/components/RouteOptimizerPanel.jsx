import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Navigation, ChevronRight, RotateCcw, Play, Clock, MapPin, Package, CheckCircle2, Loader2, AlertCircle, ChevronDown, ChevronUp, Locate, X } from 'lucide-react';
import '@goongmaps/goong-js/dist/goong-js.css';
import { api } from '../../../../services/api';
import { forwardGeocode, fetchMultiStopRoute } from '../../../../utils/routingService';
import { goongjs, GOONG_STYLE_URL } from '../../../../utils/mapIcons';
import OriginAddressPicker from './OriginAddressPicker';
import { isOrderRedelivery, getAppointmentInfo } from '../deliveryHelpers';

// Màu gradient cho từng số thứ tự
const SEQ_COLORS = [
  '#2563eb', '#7c3aed', '#db2777', '#ea580c', '#16a34a',
  '#0891b2', '#9333ea', '#dc2626', '#d97706', '#059669'
];

function formatMinutes(mins) {
  if (mins < 60) return `${mins} phút`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}g ${m}p` : `${h} giờ`;
}

function formatEta(iso) {
  if (!iso) return '--:--';
  return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function formatCurrency(amount) {
  if (!amount) return '0₫';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

// Mini-map component dùng goongjs hiển thị lộ trình trực quan
function RoutePreviewMap({ optimizedRoute, warehouse }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    if (!optimizedRoute?.length || !containerRef.current) return;

    const stops = optimizedRoute.filter(s => s.lat && s.lng);
    const origin = warehouse?.lat && warehouse?.lng ? warehouse : (stops[0] || null);
    if (!origin) return;

    const map = new goongjs.Map({
      container: containerRef.current,
      style: GOONG_STYLE_URL,
      center: [origin.lng, origin.lat],
      zoom: 12,
      attributionControl: false
    });

    map.on('load', async () => {
      const bounds = new goongjs.LngLatBounds();

      // Điểm xuất phát (Kho hoặc vị trí Shipper/Địa chỉ thủ công)
      if (warehouse?.lat && warehouse?.lng) {
        bounds.extend([warehouse.lng, warehouse.lat]);
        const originEl = document.createElement('div');
        originEl.innerHTML = `
          <div style="background:linear-gradient(135deg, #1d4ed8, #7c3aed);color:#fff;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;border:2.5px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,0.35)">
            🚩
          </div>
        `;
        new goongjs.Marker({ element: originEl, anchor: 'center' })
          .setLngLat([warehouse.lng, warehouse.lat])
          .setPopup(new goongjs.Popup({ offset: 16 }).setHTML(`<strong>Điểm xuất phát</strong><br/>${warehouse.name || 'Kho xuất phát'}`))
          .addTo(map);
      }

      // Các điểm dừng giao hàng theo thứ tự tối ưu
      stops.forEach((stop, i) => {
        bounds.extend([stop.lng, stop.lat]);
        const color = SEQ_COLORS[i % SEQ_COLORS.length];
        const stopEl = document.createElement('div');
        stopEl.innerHTML = `
          <div style="background:${color};color:#fff;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;border:2px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,0.35)">
            ${stop.sequence}
          </div>
        `;
        new goongjs.Marker({ element: stopEl, anchor: 'center' })
          .setLngLat([stop.lng, stop.lat])
          .setPopup(new goongjs.Popup({ offset: 16 }).setHTML(`<strong>#${stop.sequence} ${stop.customerName}</strong><br/>${stop.shippingAddress || ''}`))
          .addTo(map);
      });

      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, { padding: 40, maxZoom: 15 });
      }

      // Vẽ đường bộ OSRM qua các điểm dừng
      const allWaypoints = [
        warehouse?.lat && warehouse?.lng ? warehouse : null,
        ...stops
      ].filter(Boolean);

      if (allWaypoints.length >= 2) {
        try {
          const multi = await fetchMultiStopRoute(allWaypoints);
          if (multi?.coordinates?.length) {
            const lineCoords = multi.coordinates.map(([lat, lng]) => [lng, lat]);
            if (!map.getSource('optimized-line')) {
              map.addSource('optimized-line', {
                type: 'geojson',
                data: {
                  type: 'Feature',
                  geometry: { type: 'LineString', coordinates: lineCoords }
                }
              });
              map.addLayer({
                id: 'optimized-line-layer',
                type: 'line',
                source: 'optimized-line',
                paint: {
                  'line-color': '#2563eb',
                  'line-width': 4,
                  'line-opacity': 0.85
                }
              });
            }
          }
        } catch (_) {}
      }
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [optimizedRoute, warehouse]);

  return (
    <div ref={containerRef} style={{
      height: '210px', borderRadius: 'var(--radius-md)', overflow: 'hidden',
      backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-glass)',
      position: 'relative'
    }} />
  );
}

export default function RouteOptimizerPanel({
  orders,           // Danh sách đơn đang giao của shipper
  onStartOptimized  // Callback khi bấm "Bắt đầu ca giao" với thứ tự đã tối ưu
}) {
  const [status, setStatus] = useState('idle'); // idle | picking | loading | done | error
  const [isDismissed, setIsDismissed] = useState(false);
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [gpsStatus, setGpsStatus] = useState(null); // null | 'locating' | { lat, lng } | 'denied'
  // Origin picker
  const [originMode, setOriginMode] = useState('gps');     // 'gps' | 'manual' | 'warehouse'
  const [manualAddress, setManualAddress] = useState('');
  const [selectedManualCoord, setSelectedManualCoord] = useState(null);
  const [geocodingAddr, setGeocodingAddr] = useState(false);

  // Chỉ hiện với đơn chưa giao xong (SHIPPED) và chưa hoàn kho
  const eligibleOrders = orders.filter(o =>
    o.status === 'SHIPPED' || o.status === 'READY_TO_SHIP'
  );

  /**
   * Lấy GPS hiện tại của Shipper (timeout 8 giây).
   * Trả về {lat, lng} hoặc null nếu không có / bị từ chối.
   */
  const getShipperLocation = () =>
    new Promise((resolve) => {
      if (!navigator.geolocation) { resolve(null); return; }
      setGpsStatus('locating');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coord = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setGpsStatus(coord);
          resolve(coord);
        },
        () => {
          setGpsStatus('denied');
          resolve(null); // Fallback về kho
        },
        { timeout: 8000, maximumAge: 30000, enableHighAccuracy: false }
      );
    });

  // Khi bấm nút "✨ Tối Ưu" — hiện picker chọn điểm xuất phát
  const handleOptimize = () => {
    if (eligibleOrders.length < 2) {
      setErrorMsg('Cần ít nhất 2 đơn hàng đang giao để tối ưu lộ trình.');
      setStatus('error');
      return;
    }
    setErrorMsg('');
    setStatus('picking');
  };

  // Sau khi user chọn xong origin — thực sự chạy thuật toán
  const handleConfirmOrigin = async () => {
    setStatus('loading');
    setErrorMsg('');
    setResult(null);
    setGpsStatus(null);

    let shipperCoord = null;

    if (originMode === 'gps') {
      shipperCoord = await getShipperLocation();
    } else if (originMode === 'manual') {
      if (selectedManualCoord?.lat && selectedManualCoord?.lng) {
        shipperCoord = {
          lat: selectedManualCoord.lat,
          lng: selectedManualCoord.lng,
          name: selectedManualCoord.name || `📍 ${manualAddress.trim() || 'Điểm xuất phát'}`
        };
        setGpsStatus(shipperCoord);
      } else {
        if (!manualAddress.trim()) {
          setErrorMsg('Vui lòng tìm địa chỉ hoặc bấm chọn điểm xuất phát trên bản đồ.');
          setStatus('picking');
          return;
        }
        setGeocodingAddr(true);
        const geo = await forwardGeocode(manualAddress.trim());
        setGeocodingAddr(false);
        if (!geo) {
          setErrorMsg('Không tìm thấy tọa độ cho địa chỉ này. Hãy bấm chọn trên bản đồ.');
          setStatus('picking');
          return;
        }
        shipperCoord = { ...geo, name: `📍 ${manualAddress.trim()}` };
        setGpsStatus(shipperCoord);
      }
    }
    // originMode === 'warehouse' → shipperCoord = null → fallback về kho

    const orderIds = eligibleOrders.map(o => o.orderId || o.id);
    try {
      const payload = { orderIds };
      if (shipperCoord) {
        payload.originLat = shipperCoord.lat;
        payload.originLng = shipperCoord.lng;
      }
      const res = await api.post('/routes/optimize', payload);
      if (res.data?.success && res.data?.data) {
        const backendData = res.data.data;
        const enrichedRoute = (backendData.optimizedRoute || []).map(stop => {
          const ord = eligibleOrders.find(o => String(o.orderId || o.id) === String(stop.orderId));
          const apt = getAppointmentInfo(ord || stop);
          let appointmentAdherence = null;
          if (apt.hasAppointment && stop.estimatedArrival) {
            const etaDate = new Date(stop.estimatedArrival);
            const etaMinutes = etaDate.getHours() * 60 + etaDate.getMinutes();
            if (apt.startMinutes !== null && apt.endMinutes !== null) {
              if (etaMinutes >= apt.startMinutes - 20 && etaMinutes <= apt.endMinutes + 15) {
                appointmentAdherence = { status: 'ON_TIME', label: `✅ Đúng hẹn (${apt.timeWindow})`, color: 'var(--success)' };
              } else if (etaMinutes < apt.startMinutes - 20) {
                const diff = Math.round(apt.startMinutes - etaMinutes);
                appointmentAdherence = { status: 'EARLY', label: `⏳ Đến sớm ~${diff}p (${apt.timeWindow})`, color: '#0891b2' };
              } else {
                const diff = Math.round(etaMinutes - apt.endMinutes);
                appointmentAdherence = { status: 'LATE', label: `⚠️ Trễ hẹn ~${diff}p (${apt.timeWindow})`, color: 'var(--danger)' };
              }
            } else {
              appointmentAdherence = { status: 'SCHEDULED', label: `⏰ Hẹn: ${apt.label}`, color: '#7c3aed' };
            }
          }
          return {
            ...stop,
            isRedelivery: stop.isRedelivery || isOrderRedelivery(ord || stop),
            appointmentInfo: apt,
            appointmentAdherence
          };
        });
        setResult({
          ...backendData,
          optimizedRoute: enrichedRoute
        });
        setStatus('done');
        setCollapsed(false);
      } else {
        throw new Error(res.data?.message || 'Lỗi không xác định từ server.');
      }
    } catch (err) {
      console.warn('[RouteOptimizer] Backend lỗi, thử frontend fallback:', err.message);
      await runFrontendFallback(orderIds, shipperCoord);
    }
  };

  const handlePromoteToFirst = (orderId) => {
    if (!result?.optimizedRoute) return;
    const currentList = [...result.optimizedRoute];
    const targetIdx = currentList.findIndex(s => String(s.orderId) === String(orderId));
    if (targetIdx <= 0) return;

    const [promoted] = currentList.splice(targetIdx, 1);
    currentList.unshift(promoted);

    const now = new Date();
    let cumMinutes = 5;
    const recomputed = currentList.map((stop, seq) => {
      cumMinutes += (stop.durationFromPrevMinutes || 5);
      const etaDate = new Date(now.getTime() + cumMinutes * 60 * 1000);
      const apt = stop.appointmentInfo || getAppointmentInfo(stop);
      let appointmentAdherence = stop.appointmentAdherence;
      if (apt?.hasAppointment && apt.startMinutes !== null && apt.endMinutes !== null) {
        const etaMinutes = etaDate.getHours() * 60 + etaDate.getMinutes();
        if (etaMinutes >= apt.startMinutes - 20 && etaMinutes <= apt.endMinutes + 15) {
          appointmentAdherence = { status: 'ON_TIME', label: `✅ Đúng hẹn (${apt.timeWindow})`, color: 'var(--success)' };
        } else if (etaMinutes < apt.startMinutes - 20) {
          appointmentAdherence = { status: 'EARLY', label: `⏳ Đến sớm ~${Math.round(apt.startMinutes - etaMinutes)}p (${apt.timeWindow})`, color: '#0891b2' };
        } else {
          appointmentAdherence = { status: 'LATE', label: `⚠️ Trễ hẹn ~${Math.round(etaMinutes - apt.endMinutes)}p (${apt.timeWindow})`, color: 'var(--danger)' };
        }
      }
      return {
        ...stop,
        sequence: seq + 1,
        estimatedArrival: etaDate.toISOString(),
        appointmentAdherence
      };
    });

    setResult(prev => ({
      ...prev,
      optimizedRoute: recomputed
    }));
  };

  const runFrontendFallback = async (orderIds, shipperCoord = null) => {
    try {
      // Dùng GPS thực tế nếu có, không thì dùng kho
      const originCoord = shipperCoord
        ? { ...shipperCoord, name: '📍 Vị trí hiện tại của bạn' }
        : { lat: 10.7769, lng: 106.7009, name: 'Kho AetherPC' };
      const geocodedOrders = await Promise.all(
        eligibleOrders.map(async (ord) => {
          const geo = await forwardGeocode(ord.shippingAddress || ord.address || '');
          return { ...ord, lat: geo?.lat || null, lng: geo?.lng || null };
        })
      );

      const validOrders = geocodedOrders.filter(o => o.lat && o.lng);
      if (validOrders.length < 2) {
        setErrorMsg('Không thể xác định tọa độ đủ số đơn để tối ưu. Kiểm tra lại địa chỉ giao hàng.');
        setStatus('error');
        return;
      }

      const { fetchOsrmTable, solveVRPTW } = await import('../../../../utils/routingService');
      const allCoords = [originCoord, ...validOrders.map(o => ({ lat: o.lat, lng: o.lng }))];
      const matrix = await fetchOsrmTable(allCoords);

      // Nếu OSRM cũng lỗi, dùng khoảng cách đường thẳng
      const effectiveMatrix = matrix || buildSimpleMatrix(allCoords);
      const ordersWithMeta = validOrders.map(o => ({
        ...o,
        appointmentInfo: getAppointmentInfo(o)
      }));
      const now = new Date();
      const currentMinutesOfDay = now.getHours() * 60 + now.getMinutes();
      const optimizedRoute = solveVRPTW(effectiveMatrix, 0, ordersWithMeta, currentMinutesOfDay);

      let cumSeconds = 5 * 60;
      const routeResult = optimizedRoute.map((stop, seq) => {
        cumSeconds += stop.durationFromPrev;
        const ord = validOrders[stop.index - 1];
        const apt = getAppointmentInfo(ord);
        const etaDate = new Date(now.getTime() + cumSeconds * 1000);

        let appointmentAdherence = null;
        if (apt.hasAppointment) {
          const etaMinutes = etaDate.getHours() * 60 + etaDate.getMinutes();
          if (apt.startMinutes !== null && apt.endMinutes !== null) {
            if (etaMinutes >= apt.startMinutes - 20 && etaMinutes <= apt.endMinutes + 15) {
              appointmentAdherence = { status: 'ON_TIME', label: `✅ Đúng hẹn (${apt.timeWindow})`, color: 'var(--success)' };
            } else if (etaMinutes < apt.startMinutes - 20) {
              const diff = Math.round(apt.startMinutes - etaMinutes);
              appointmentAdherence = { status: 'EARLY', label: `⏳ Đến sớm ~${diff}p (${apt.timeWindow})`, color: '#0891b2' };
            } else {
              const diff = Math.round(etaMinutes - apt.endMinutes);
              appointmentAdherence = { status: 'LATE', label: `⚠️ Trễ hẹn ~${diff}p (${apt.timeWindow})`, color: 'var(--danger)' };
            }
          } else {
            appointmentAdherence = { status: 'SCHEDULED', label: `⏰ Hẹn: ${apt.label}`, color: '#7c3aed' };
          }
        }

        return {
          sequence: seq + 1,
          orderId: ord.orderId || ord.id,
          customerName: ord.customerName || ord.customer?.name || 'Khách hàng',
          shippingAddress: ord.shippingAddress || ord.address || '',
          totalAmount: ord.totalAmount,
          paymentMethod: ord.paymentMethod,
          lat: ord.lat,
          lng: ord.lng,
          isRedelivery: isOrderRedelivery(ord),
          notes: ord.notes,
          appointmentInfo: apt,
          appointmentAdherence,
          durationFromPrevMinutes: Math.round(stop.durationFromPrev / 60),
          estimatedArrival: etaDate.toISOString(),
          distanceFromPrevKm: +((stop.durationFromPrev / 3600) * 20).toFixed(1)
        };
      });

      const totalDuration = Math.round(cumSeconds / 60);
      const totalDist = routeResult.reduce((s, r) => s + r.distanceFromPrevKm, 0).toFixed(1);

      setResult({
        warehouse: originCoord,
        optimizedRoute: routeResult,
        summary: {
          totalOrders: routeResult.length,
          totalDurationMinutes: totalDuration,
          totalDistanceKm: +totalDist,
          estimatedFinish: new Date(now.getTime() + cumSeconds * 1000).toISOString()
        }
      });
      setStatus('done');
    } catch (err2) {
      setErrorMsg('Không thể tối ưu lộ trình: ' + err2.message);
      setStatus('error');
    }
  };

  function buildSimpleMatrix(coords) {
    const n = coords.length;
    const R = 6371;
    return Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (__, j) => {
        if (i === j) return 0;
        const a = coords[i], b = coords[j];
        const dLat = (b.lat - a.lat) * Math.PI / 180;
        const dLng = (b.lng - a.lng) * Math.PI / 180;
        const hav = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
        const km = R * 2 * Math.atan2(Math.sqrt(hav), Math.sqrt(1 - hav));
        return Math.round((km / 20) * 3600);
      })
    );
  }

  const handleReset = () => {
    setStatus('idle');
    setResult(null);
    setErrorMsg('');
    setGpsStatus(null);
    setManualAddress('');
    setSelectedManualCoord(null);
    setOriginMode('gps');
  };

  if (eligibleOrders.length < 2) return null;

  if (isDismissed) {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.65rem' }}>
        <button
          type="button"
          onClick={() => setIsDismissed(false)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
            padding: '0.3rem 0.7rem', borderRadius: '999px',
            border: '1px solid var(--border-glass)',
            backgroundColor: 'var(--bg-primary)',
            color: 'var(--primary)', fontSize: '0.72rem', fontWeight: 700,
            cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
          }}
        >
          <Sparkles size={13} />
          <span>Gợi ý tối ưu lộ trình ({eligibleOrders.length} đơn)</span>
        </button>
      </div>
    );
  }

  return (
    <div style={{
      marginBottom: '0.85rem',
      borderRadius: 'var(--radius-md)',
      border: '1.5px solid',
      borderColor: status === 'done' ? 'rgba(37,99,235,0.25)' : 'var(--border-glass)',
      background: status === 'done'
        ? 'linear-gradient(135deg, rgba(37,99,235,0.06) 0%, rgba(124,58,237,0.04) 100%)'
        : 'var(--bg-primary)',
      overflow: 'hidden',
      transition: 'border-color 0.3s, background 0.3s'
    }}>
      {/* Header */}
      <div
        onClick={() => status === 'done' && setCollapsed(c => !c)}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.6rem',
          padding: '0.75rem 0.85rem',
          cursor: status === 'done' ? 'pointer' : 'default',
          borderBottom: (!collapsed && status === 'done') ? '1px solid var(--border-glass)' : 'none'
        }}
      >
        <div style={{
          width: 32, height: 32, borderRadius: 'var(--radius-md)',
          background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          boxShadow: '0 2px 8px rgba(37,99,235,0.35)'
        }}>
          <Sparkles size={16} color="#fff" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            Tối Ưu Lộ Trình (Tùy chọn)
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.05rem' }}>
            {status === 'idle' && 'Nhấn Tối Ưu để AI xếp tuyến, hoặc chọn giao tự do từng đơn bên dưới.'}
            {status === 'picking' && 'Chọn điểm xuất phát …'}
            {status === 'loading' && (
              gpsStatus === 'locating'
                ? '📡 Đang xác định vị trí GPS của bạn...'
                : 'Đang tính toán lộ trình tối ưu...'
            )}
            {status === 'done' && result && (
              `✓ ${result.summary.totalOrders} đơn · ~${result.summary.totalDistanceKm} km · ~${formatMinutes(result.summary.totalDurationMinutes)}`
            )}
            {status === 'error' && 'Không thể tối ưu — thử lại'}
          </div>
        </div>

        {(status === 'idle' || status === 'picking') && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <button
              type="button"
              onClick={status === 'idle' ? handleOptimize : undefined}
              disabled={status === 'picking'}
              style={{
                padding: '0.45rem 0.85rem', borderRadius: 'var(--radius-md)', border: 'none', cursor: status === 'idle' ? 'pointer' : 'default',
                background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
                color: '#fff', fontSize: '0.75rem', fontWeight: 700,
                display: 'flex', alignItems: 'center', gap: '0.3rem',
                boxShadow: '0 2px 8px rgba(37,99,235,0.3)', whiteSpace: 'nowrap',
                opacity: status === 'picking' ? 0.7 : 1
              }}
            >
              <Sparkles size={13} /> Tối Ưu
            </button>
            {status === 'idle' && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setIsDismissed(true); }}
                title="Thu gọn panel tối ưu"
                style={{
                  padding: '0.35rem', borderRadius: 'var(--radius-sm)',
                  border: 'none', background: 'transparent',
                  color: 'var(--text-muted)', cursor: 'pointer', display: 'flex'
                }}
              >
                <X size={15} />
              </button>
            )}
          </div>
        )}

        {status === 'loading' && (
          <Loader2 size={18} style={{ color: 'var(--primary)', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
        )}

        {status === 'done' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
            <button
              type="button"
              onClick={e => { e.stopPropagation(); handleReset(); }}
              title="Tính lại"
              style={{ padding: '0.3rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}
            >
              <RotateCcw size={13} />
            </button>
            {collapsed ? <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} /> : <ChevronUp size={16} style={{ color: 'var(--text-muted)' }} />}
          </div>
        )}

        {status === 'error' && (
          <button
            type="button"
            onClick={handleOptimize}
            style={{ padding: '0.35rem 0.7rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--danger)', background: 'transparent', cursor: 'pointer', color: 'var(--danger)', fontSize: '0.72rem', fontWeight: 700 }}
          >
            Thử Lại
          </button>
        )}
      </div>

      {/* Origin Picker Panel */}
      {status === 'picking' && (
        <div style={{
          padding: '0.85rem',
          borderBottom: '1px solid var(--border-glass)',
          backgroundColor: 'var(--bg-secondary)',
          display: 'flex', flexDirection: 'column', gap: '0.6rem'
        }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            📍 Chọn điểm xuất phát
          </div>

          {/* 3 option cards */}
          {[
            {
              mode: 'gps',
              icon: <Locate size={15} />,
              label: 'Vị trí GPS hiện tại',
              desc: 'Trình duyệt sẽ hỏi quyền định vị'
            },
            {
              mode: 'manual',
              icon: <MapPin size={15} />,
              label: 'Nhập địa chỉ thủ công',
              desc: 'Nhập địa chỉ bất kỳ để test'
            },
            {
              mode: 'warehouse',
              icon: <span style={{ fontSize: '14px' }}>🏭</span>,
              label: 'Kho AetherPC (mặc định)',
              desc: 'Tối ưu từ kho xuất phát'
            }
          ].map(({ mode, icon, label, desc }) => (
            <div
              key={mode}
              onClick={() => setOriginMode(mode)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.65rem',
                padding: '0.6rem 0.7rem', borderRadius: 'var(--radius-md)',
                border: `1.5px solid ${originMode === mode ? '#2563eb' : 'var(--border-glass)'}`,
                backgroundColor: originMode === mode ? 'rgba(37,99,235,0.07)' : 'var(--bg-primary)',
                cursor: 'pointer', transition: 'all 0.15s'
              }}
            >
              {/* Radio */}
              <div style={{
                width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                border: `2px solid ${originMode === mode ? '#2563eb' : 'var(--border-glass)'}`,
                backgroundColor: originMode === mode ? '#2563eb' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                {originMode === mode && <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#fff' }} />}
              </div>
              <div style={{ color: originMode === mode ? 'var(--primary)' : 'var(--text-muted)', flexShrink: 0 }}>
                {icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: originMode === mode ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                  {label}
                </div>
                <div style={{ fontSize: '0.67rem', color: 'var(--text-muted)', marginTop: '0.05rem' }}>{desc}</div>
              </div>
            </div>
          ))}

          {/* Manual address input with Map & Search Autocomplete */}
          {originMode === 'manual' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.1rem' }}>
              <OriginAddressPicker
                value={manualAddress}
                onChange={setManualAddress}
                selectedCoord={selectedManualCoord}
                onSelectCoord={setSelectedManualCoord}
              />
            </div>
          )}

          {/* Error inside picker */}
          {errorMsg && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', color: 'var(--danger)' }}>
              <AlertCircle size={13} />
              {errorMsg}
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.1rem' }}>
            <button
              type="button"
              onClick={() => { setStatus('idle'); setErrorMsg(''); }}
              style={{
                flex: 1, padding: '0.55rem', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-glass)', background: 'transparent',
                color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer'
              }}
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleConfirmOrigin}
              disabled={geocodingAddr}
              style={{
                flex: 2, padding: '0.55rem', borderRadius: 'var(--radius-sm)', border: 'none',
                background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
                color: '#fff', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                opacity: geocodingAddr ? 0.7 : 1
              }}
            >
              {geocodingAddr
                ? <><Loader2 size={13} style={{ animation: 'spin 0.8s linear infinite' }} /> Đang tìm địa chỉ...</>
                : <><Sparkles size={13} /> Bắt đầu Tối Ʈu</>
              }
            </button>
          </div>
        </div>
      )}

      {/* Error message (khi status = error, ngoài picker) */}
      {status === 'error' && errorMsg && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
          padding: '0.7rem 0.85rem', fontSize: '0.75rem', color: 'var(--danger)',
          backgroundColor: 'rgba(220,38,38,0.06)'
        }}>
          <AlertCircle size={14} style={{ marginTop: '0.05rem', flexShrink: 0 }} />
          {errorMsg}
        </div>
      )}

      {/* Kết quả tối ưu */}
      {status === 'done' && result && !collapsed && (
        <div style={{ padding: '0.75rem 0.85rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

          {/* Summary bar */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem'
          }}>
            {[
              { icon: Package, label: 'Đơn hàng', value: result.summary.totalOrders },
              { icon: Navigation, label: 'Khoảng cách', value: `~${result.summary.totalDistanceKm} km` },
              { icon: Clock, label: 'Thời gian', value: `~${formatMinutes(result.summary.totalDurationMinutes)}` }
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '0.5rem 0.3rem', borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-glass)', textAlign: 'center'
              }}>
                <Icon size={14} style={{ color: 'var(--primary)', marginBottom: '0.2rem' }} />
                <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary)' }}>{value}</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{label}</div>
              </div>
            ))}
          </div>

          {/* GPS / Warehouse origin badge */}
          {gpsStatus && typeof gpsStatus === 'object' ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.35rem 0.6rem', borderRadius: 'var(--radius-sm)',
              backgroundColor: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.2)'
            }}>
              <Locate size={13} style={{ color: 'var(--success)', flexShrink: 0 }} />
              <span style={{ fontSize: '0.7rem', color: 'var(--success)', fontWeight: 700 }}>
                Điểm xuất phát: Vị trí GPS hiện tại của bạn
              </span>
            </div>
          ) : (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.35rem 0.6rem', borderRadius: 'var(--radius-sm)',
              backgroundColor: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.15)'
            }}>
              <span style={{ fontSize: '11px' }}>🏭</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 700 }}>
                Điểm xuất phát: {result.warehouse.name}
                {gpsStatus === 'denied' && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> (GPS bị từ chối)</span>}
              </span>
            </div>
          )}

          {/* Danh sách đơn theo thứ tự tối ưu */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {/* Xuất phát */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.55rem', backgroundColor: 'rgba(37,99,235,0.08)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', backgroundColor: typeof gpsStatus === 'object' ? '#16a34a' : '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {typeof gpsStatus === 'object'
                  ? <Locate size={11} color="#fff" />
                  : <span style={{ fontSize: '9px', fontWeight: 900, color: '#fff' }}>KHO</span>
                }
              </div>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: typeof gpsStatus === 'object' ? 'var(--success)' : 'var(--primary)' }}>
                Xuất phát: {result.warehouse.name}
              </span>
            </div>

            {result.optimizedRoute.map((stop, idx) => (
              <div key={stop.orderId}>
                {/* Connector line with duration */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.2rem 0.55rem' }}>
                  <div style={{ width: 2, height: 16, backgroundColor: SEQ_COLORS[idx % SEQ_COLORS.length], borderRadius: 2, marginLeft: '0.55rem', opacity: 0.4 }} />
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    ~{stop.durationFromPrevMinutes} phút · {stop.distanceFromPrevKm} km
                  </span>
                </div>
                {/* Stop card */}
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: '0.55rem',
                  padding: '0.55rem 0.55rem',
                  border: '1px solid var(--border-glass)',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-primary)',
                  position: 'relative', overflow: 'hidden'
                }}>
                  {/* Accent bar */}
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: SEQ_COLORS[idx % SEQ_COLORS.length], borderRadius: '3px 0 0 3px' }} />

                  {/* Sequence badge */}
                  <div style={{
                    width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                    background: SEQ_COLORS[idx % SEQ_COLORS.length],
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.72rem', fontWeight: 900, color: '#fff',
                    boxShadow: `0 2px 6px ${SEQ_COLORS[idx % SEQ_COLORS.length]}55`,
                    marginLeft: '0.2rem'
                  }}>
                    {stop.sequence}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.3rem' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {stop.customerName}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        ETA {formatEta(stop.estimatedArrival)}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: '0.1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <MapPin size={10} style={{ display: 'inline', marginRight: '0.2rem' }} />
                      {stop.shippingAddress}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: stop.paymentMethod === 'COD' ? '#ea580c' : 'var(--success)' }}>
                        {stop.paymentMethod === 'COD' ? `💵 COD ${formatCurrency(stop.totalAmount)}` : `✅ Đã TT`}
                      </span>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>#{stop.orderId}</span>
                      {isOrderRedelivery(stop) && (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '2px',
                          padding: '1px 5px', borderRadius: '3px', fontSize: '0.62rem', fontWeight: 800,
                          backgroundColor: 'rgba(234, 88, 12, 0.12)', color: '#ea580c', border: '1px solid rgba(234, 88, 12, 0.25)'
                        }}>
                          <RotateCcw size={9} /> Giao lại
                        </span>
                      )}
                      {stop.appointmentAdherence && (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '3px',
                          padding: '1px 5px', borderRadius: '3px', fontSize: '0.62rem', fontWeight: 800,
                          backgroundColor: stop.appointmentAdherence.status === 'LATE' ? 'rgba(220,38,38,0.12)' : (stop.appointmentAdherence.status === 'ON_TIME' ? 'rgba(22,163,74,0.12)' : 'rgba(124,58,237,0.12)'),
                          color: stop.appointmentAdherence.color,
                          border: `1px solid ${stop.appointmentAdherence.color}40`
                        }}>
                          <Clock size={9} />
                          {stop.appointmentAdherence.label}
                        </span>
                      )}
                      {stop.appointmentInfo?.hasAppointment && stop.sequence > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePromoteToFirst(stop.orderId);
                          }}
                          style={{
                            padding: '1px 6px', borderRadius: '3px',
                            fontSize: '0.62rem', fontWeight: 800, cursor: 'pointer',
                            backgroundColor: 'rgba(37,99,235,0.08)', color: 'var(--primary)',
                            border: '1px solid rgba(37,99,235,0.25)', display: 'inline-flex', alignItems: 'center', gap: '2px'
                          }}
                          title="Đảo đơn này lên đầu danh sách để kịp giờ hẹn"
                        >
                          ⚡ Đi đơn này trước
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Kết thúc — quay về kho */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.2rem 0.55rem' }}>
              <div style={{ width: 2, height: 16, backgroundColor: '#6b7280', borderRadius: 2, marginLeft: '0.55rem', opacity: 0.3 }} />
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>Kết thúc ca giao</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.55rem', backgroundColor: 'rgba(22,163,74,0.08)', borderRadius: 'var(--radius-sm)' }}>
              <CheckCircle2 size={16} style={{ color: 'var(--success)', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--success)' }}>
                  Dự kiến hoàn thành: {formatEta(result.summary.estimatedFinish)}
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                  Tổng ~{result.summary.totalDistanceKm} km · ~{formatMinutes(result.summary.totalDurationMinutes)}
                </div>
              </div>
            </div>
          </div>

          {/* Toggle mini-map */}
          <button
            type="button"
            onClick={() => setShowMap(v => !v)}
            style={{
              width: '100%', padding: '0.4rem', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)',
              color: 'var(--text-secondary)', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem'
            }}
          >
            <MapPin size={12} />
            {showMap ? 'Ẩn bản đồ lộ trình' : 'Xem bản đồ lộ trình'}
            {showMap ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          {showMap && (
            <RoutePreviewMap
              optimizedRoute={result.optimizedRoute}
              warehouse={result.warehouse}
            />
          )}

          {/* CTA: Bắt đầu ca giao */}
          {onStartOptimized && (
            <button
              type="button"
              onClick={() => onStartOptimized(result.optimizedRoute, { originMode, originCoord: result.warehouse })}
              style={{
                width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)',
                border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg, #16a34a, #15803d)',
                color: '#fff', fontSize: '0.82rem', fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                boxShadow: '0 3px 12px rgba(22,163,74,0.35)',
                letterSpacing: '0.02em'
              }}
            >
              <Play size={15} fill="#fff" />
              Bắt Đầu Ca Giao Theo Thứ Tự Tối Ưu
              <ChevronRight size={15} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
