import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Navigation, Phone, MapPin, Compass, AlertCircle, Gauge, ExternalLink, Pause } from 'lucide-react';
import '@goongmaps/goong-js/dist/goong-js.css';
import { fetchRoadRoute, forwardGeocode } from '../../../../utils/routingService';
import { goongjs, GOONG_STYLE_URL, createWarehouseElement, createDestinationElement, createShipperElement } from '../../../../utils/mapIcons';
import PODCaptureSection from './PODCaptureSection';

function haversineKm(a, b) {
  if (!a || !b) return null;
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

// fetchRoadRoute trả toạ độ dạng [lat,lng] (quy ước dùng chung với tính năng
// giả lập GPS ở Delivery/index.jsx) — goong-js (GeoJSON/mapbox-gl) cần
// [lng,lat], nên đổi thứ tự ngay tại nơi tiêu thụ.
const EMPTY_LINE = { type: 'Feature', geometry: { type: 'LineString', coordinates: [] } };
const toLineFeature = (coordsLatLng) => ({
  type: 'Feature',
  geometry: { type: 'LineString', coordinates: coordsLatLng.map(([lat, lng]) => [lng, lat]) }
});

// goong-js (mapbox-gl) không có LngLatBounds.pad() như Leaflet — tự nới rộng
// bounds thêm 1 tỉ lệ % trước khi kiểm tra contains().
function padLngLatBounds(bounds, ratio) {
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  const lngPad = (ne.lng - sw.lng) * ratio;
  const latPad = (ne.lat - sw.lat) * ratio;
  return new goongjs.LngLatBounds(
    [sw.lng - lngPad, sw.lat - latPad],
    [ne.lng + lngPad, ne.lat + latPad]
  );
}

// Sau khi Shipper tự tay kéo/zoom bản đồ (vd để xem trước ngã rẽ sắp tới),
// tạm ngừng auto-pan-theo-GPS trong khoảng thời gian này để không đè mất
// thao tác đó. Bấm nút "Xem toàn tuyến" sẽ bật lại auto-follow ngay.
const AUTO_FOLLOW_PAUSE_MS = 15000;

// Màn hình "Bắt Đầu Giao" gộp — CỐ Ý render theo dòng chảy tài liệu bình
// thường (không position:fixed, không sticky, không vh/dvh/svh) thay vì
// modal toàn màn hình như 3 lần sửa trước. Lý do: sau 3 lần vá bằng CSS
// viewport units mà nút hành động vẫn bị Safari iOS thật che/hụt, hướng
// đi chắc chắn nhất là bỏ hẳn mọi kỹ thuật định vị đặc biệt — component
// này giờ chỉ là 1 khối nội dung bình thường nằm trong `.delivery-content`
// (vùng cuộn chính của khung ứng dụng ở DeliveryAppShell.jsx), nên:
//   - Cuộn bằng đúng cơ chế cuộn trang đã luôn hoạt động đúng cho các tab
//     khác (Đang Giao/Lịch Sử...), không tự chế cơ chế cuộn riêng.
//   - Thanh tab dưới cùng (Tổng Quan/Chờ Nhận/...) ở DeliveryAppShell vẫn
//     luôn hiển thị vì nó là sibling cố định bên ngoài `.delivery-content`,
//     không còn bị modal fixed đè lên/ẩn đi nữa.
//   - Thanh trượt xác nhận nằm cuối luồng nội dung, kéo xuống là thấy —
//     đúng yêu cầu, không cần sticky.
export default function DeliveryNavigationModal({
  order,
  user,
  warehouse,
  destination,
  isGpsActive,
  onStartDeliveryWithGps,
  onStopGps,
  onConfirmDelivered,
  onReject,
  onClose,
  fmt
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const routeCoordsRef = useRef([]);
  const lastUserInteractionRef = useRef(0);

  const [routeInfo, setRouteInfo] = useState(null);
  const [loadingRoute, setLoadingRoute] = useState(true);
  const [shipperLoc, setShipperLoc] = useState(null);
  const [locError, setLocError] = useState('');
  const [speedKmh, setSpeedKmh] = useState(0);

  const orderId = String(order?.orderId || order?.id || '');
  const isEffectiveGpsActive = Boolean(
    isGpsActive ||
    (orderId && typeof window !== 'undefined' && localStorage.getItem('aether_active_gps_order_id') === orderId)
  );
  const customerName = order?.customerName || order?.customer?.name || 'Khách hàng';
  const phone = order?.phone || order?.customer?.phone || '';
  const address = order?.shippingAddress || order?.address || destination?.label || '';
  const codAmount = parseFloat(order?.totalAmount || order?.total || 0);
  const isPrepaid = order?.paymentStatus === 'PAID' || order?.paymentMethod === 'ONLINE_GATEWAY' || order?.paymentMethod === 'BANK_TRANSFER' || codAmount === 0;

  // Tự động phát GPS ngay khi vào màn hình "Bắt Đầu Giao" gộp — bỏ nút bấm
  // riêng, chỉ còn badge nhỏ trên bản đồ để tắt/bật lại khi cần.
  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (autoStartedRef.current || isEffectiveGpsActive) return;
    autoStartedRef.current = true;
    if (onStartDeliveryWithGps) onStartDeliveryWithGps(order, shipperLoc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tự động phân giải địa chỉ thực tế (Forward Geocoding) để lấy toạ độ chính xác thay vì chỉ toạ độ khu vực
  const [exactDestination, setExactDestination] = useState(destination);

  useEffect(() => {
    let isMounted = true;
    if (address) {
      forwardGeocode(address).then(geo => {
        if (isMounted && geo && typeof geo.lat === 'number' && typeof geo.lng === 'number') {
          setExactDestination(prev => ({
            ...prev,
            lat: geo.lat,
            lng: geo.lng
          }));
        }
      });
    }
    return () => { isMounted = false; };
  }, [address]);

  const googleMapsUrl = (() => {
    const dest = (exactDestination?.lat && exactDestination?.lng)
      ? `${exactDestination.lat},${exactDestination.lng}`
      : encodeURIComponent(address);
    const originParam = (shipperLoc?.lat && shipperLoc?.lng)
      ? `&origin=${shipperLoc.lat},${shipperLoc.lng}`
      : '';
    return `https://www.google.com/maps/dir/?api=1${originParam}&destination=${dest}&travelmode=driving`;
  })();

  // 1. Khởi tạo bản đồ goong-js
  const styleReadyRef = useRef(false);
  const [styleReadyTick, setStyleReadyTick] = useState(0);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new goongjs.Map({
      container: containerRef.current,
      style: GOONG_STYLE_URL,
      center: [108.2022, 16.0544],
      zoom: 5,
      attributionControl: true
    });
    map.addControl(new goongjs.NavigationControl(), 'top-left');

    // originalEvent chỉ có mặt khi thao tác đến từ chuột/chạm thật của Shipper —
    // panTo()/fitBounds() gọi bằng code không set field này.
    const markUserInteraction = (e) => { if (e.originalEvent) lastUserInteractionRef.current = Date.now(); };
    map.on('dragstart', markUserInteraction);
    map.on('zoomstart', markUserInteraction);

    // Nguồn/lớp vẽ tuyến đường chỉ tạo được sau khi style load xong — tạo 1
    // lần rồi từ nay chỉ setData() lên nguồn có sẵn, tránh nháy bản đồ.
    map.on('load', () => {
      if (!mapRef.current) return;
      map.addSource('main-route', { type: 'geojson', data: EMPTY_LINE });
      map.addLayer({
        id: 'main-route-line',
        type: 'line',
        source: 'main-route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#9aa0a6', 'line-width': 4, 'line-opacity': 0.85 }
      });
      map.addSource('remaining-route', { type: 'geojson', data: EMPTY_LINE });
      map.addLayer({
        id: 'remaining-route-line',
        type: 'line',
        source: 'remaining-route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#1a73e8', 'line-width': 5, 'line-opacity': 0.95 }
      });
      styleReadyRef.current = true;
      setStyleReadyTick((t) => t + 1);
    });

    mapRef.current = map;
    setTimeout(() => {
      if (mapRef.current) mapRef.current.resize();
    }, 200);

    return () => {
      map.remove();
      mapRef.current = null;
      styleReadyRef.current = false;
    };
  }, []);

  // 2. Thử lấy vị trí GPS hiện tại của Shipper ngay khi mở modal
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocError('Thiết bị hoặc trình duyệt không hỗ trợ Geolocation API.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setShipperLoc({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          speed: pos.coords.speed,
          heading: pos.coords.heading
        });
        if (pos.coords.speed != null && pos.coords.speed > 0) {
          setSpeedKmh(Math.round(pos.coords.speed * 3.6));
        }
      },
      (err) => {
        console.warn('Không thể lấy vị trí tức thời của Shipper:', err.message);
        // Fallback: xuất phát từ Kho
        setLocError('Chưa có GPS vệ tinh - Sử dụng vị trí Kho xuất phát làm điểm bắt đầu.');
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 }
    );
  }, []);

  // Tần suất tính lại lộ trình "còn lại" theo GPS sống của Shipper. GPS thực
  // tế bắn toạ độ mới mỗi vài giây (kể cả lúc đứng yên, do sai số vệ tinh) —
  // nếu effect vẽ route phụ thuộc thẳng vào shipperLoc và xoá/vẽ lại toàn bộ
  // marker + gọi fitBounds ở MỌI lần đó, bản đồ sẽ nháy liên tục và tự động
  // zoom-out về khung nhìn toàn tuyến, đè mất thao tác zoom tay của người
  // dùng. Throttle + tách riêng phần vẽ lại (3b) khỏi phần khởi tạo (3a) để
  // chỉ fitBounds đúng 1 lần lúc đầu, giống cách DeliveryMap.jsx đã làm.
  const LIVE_RECALC_INTERVAL_MS = 15000;
  const lastLiveRecalcRef = useRef(0);

  // 3a. Vẽ lộ trình gốc (Kho → Điểm giao) + marker + fitBounds — chỉ chạy lại
  // khi Kho/Điểm giao đổi, KHÔNG phụ thuộc vị trí GPS sống của Shipper.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReadyRef.current || !warehouse || !exactDestination) return;

    setLoadingRoute(true);
    lastLiveRecalcRef.current = 0;

    // Xoá các marker cũ; đường "còn lại" reset về rỗng
    if (markersRef.current.warehouse) markersRef.current.warehouse.remove();
    if (markersRef.current.destination) markersRef.current.destination.remove();
    map.getSource('remaining-route')?.setData(EMPTY_LINE);

    markersRef.current.warehouse = new goongjs.Marker({ element: createWarehouseElement(), anchor: 'bottom' })
      .setLngLat([warehouse.lng, warehouse.lat])
      .setPopup(new goongjs.Popup({ offset: 28 }).setHTML(`<strong>🏬 Kho Xuất Phát:</strong><br/>${warehouse.name || 'Kho AetherPC'}`))
      .addTo(map);

    markersRef.current.destination = new goongjs.Marker({ element: createDestinationElement(), anchor: 'bottom' })
      .setLngLat([exactDestination.lng, exactDestination.lat])
      .setPopup(new goongjs.Popup({ offset: 28 }).setHTML(`<strong>🏠 Điểm Giao Hàng:</strong><br/>${customerName}<br/>${address}`))
      .addTo(map);

    let isMounted = true;
    fetchRoadRoute(warehouse, exactDestination).then(route => {
      if (!isMounted || !mapRef.current) return;
      setLoadingRoute(false);

      if (route && route.coordinates && route.coordinates.length > 0) {
        setRouteInfo(route);
        routeCoordsRef.current = route.coordinates;

        const feature = toLineFeature(route.coordinates);
        mapRef.current.getSource('main-route')?.setData(feature);

        // Căn góc nhìn bao trọn tuyến đường — chỉ làm 1 lần lúc khởi tạo
        const coords = feature.geometry.coordinates;
        const bounds = coords.reduce((b, c) => b.extend(c), new goongjs.LngLatBounds(coords[0], coords[0]));
        if (shipperLoc) bounds.extend([shipperLoc.lng, shipperLoc.lat]);
        mapRef.current.fitBounds(bounds, { padding: 40 });
      }
    });

    return () => { isMounted = false; };
  }, [warehouse?.lat, warehouse?.lng, exactDestination?.lat, exactDestination?.lng, styleReadyTick]);

  // 3b. Tính lại lộ trình "còn lại" (Shipper hiện tại → Điểm giao) mỗi khi có
  // GPS mới — có throttle theo LIVE_RECALC_INTERVAL_MS, chỉ vẽ đè 1 đường màu
  // xanh, KHÔNG đụng tới marker Kho/Điểm giao và KHÔNG gọi fitBounds, nên
  // không làm mất zoom người dùng vừa chỉnh tay.
  useEffect(() => {
    if (!mapRef.current || !styleReadyRef.current || !shipperLoc || !exactDestination) return;
    const now = Date.now();
    if (now - lastLiveRecalcRef.current < LIVE_RECALC_INTERVAL_MS) return;
    lastLiveRecalcRef.current = now;

    let cancelled = false;
    fetchRoadRoute(shipperLoc, exactDestination).then(route => {
      if (cancelled || !mapRef.current || !route?.coordinates?.length) return;
      setRouteInfo(route);
      routeCoordsRef.current = route.coordinates;
      mapRef.current.getSource('remaining-route')?.setData(toLineFeature(route.coordinates));
    });

    return () => { cancelled = true; };
  }, [shipperLoc?.lat, shipperLoc?.lng, exactDestination?.lat, exactDestination?.lng, styleReadyTick]);

  // 4. Cập nhật vị trí Marker Shipper theo thời gian thực
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !shipperLoc) return;
    const pos = [shipperLoc.lng, shipperLoc.lat];

    if (markersRef.current.shipper) {
      markersRef.current.shipper.setLngLat(pos);
    } else {
      markersRef.current.shipper = new goongjs.Marker({ element: createShipperElement() })
        .setLngLat(pos)
        .setPopup(new goongjs.Popup({ offset: 18 }).setHTML(`<strong>🛵 Vị Trí Của Bạn (Shipper)</strong><br/><span style="color:#16a34a;">● Đang phát tín hiệu GPS trực tiếp</span>`))
        .addTo(map);
    }

    const bounds = map.getBounds();
    const autoFollowPaused = Date.now() - lastUserInteractionRef.current < AUTO_FOLLOW_PAUSE_MS;
    if (bounds && !autoFollowPaused && !padLngLatBounds(bounds, 0.15).contains(pos)) {
      map.panTo(pos, { animate: true, duration: 800 });
    }
  }, [shipperLoc]);

  // Lắng nghe cập nhật toạ độ liên tục khi GPS Active
  useEffect(() => {
    if (!isEffectiveGpsActive || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setShipperLoc({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          speed: pos.coords.speed,
          heading: pos.coords.heading
        });
        if (pos.coords.speed != null && pos.coords.speed > 0) {
          setSpeedKmh(Math.round(pos.coords.speed * 3.6));
        }
      },
      (err) => console.warn('Lỗi định vị GPS thực tế:', err.message),
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [isEffectiveGpsActive]);

  const fitFullRoute = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    // Bấm nút này là tín hiệu Shipper chủ động muốn quay lại theo dõi toàn
    // tuyến — bật lại auto-follow ngay, không đợi hết cooldown.
    lastUserInteractionRef.current = 0;
    if (routeCoordsRef.current.length > 0) {
      const coords = routeCoordsRef.current.map(([lat, lng]) => [lng, lat]);
      const bounds = coords.reduce((b, c) => b.extend(c), new goongjs.LngLatBounds(coords[0], coords[0]));
      map.fitBounds(bounds, { padding: 40, animate: true });
    }
  }, []);

  const distanceRemaining = shipperLoc && exactDestination ? haversineKm(shipperLoc, exactDestination) : null;

  return (
    <div style={{ backgroundColor: 'var(--bg-app)' }}>
      {/* Header */}
      <div style={{
        padding: '0.85rem 1rem',
        borderBottom: '1px solid var(--border-glass)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'var(--bg-primary)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Navigation size={18} color="var(--primary)" />
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              Lộ Trình Giao Hàng #{orderId}
            </h3>
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Đề xuất tuyến đường giao hàng tối ưu và định vị GPS thực tế
          </span>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="delivery-icon-btn"
        >
          <X size={20} />
        </button>
      </div>

      {/* Thông tin khách hàng tóm tắt */}
      <div style={{
        padding: '0.75rem 1.15rem',
        backgroundColor: '#eff6ff',
        borderBottom: '1px solid #bfdbfe',
        fontSize: '0.82rem'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '0.75rem',
          marginBottom: '0.35rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ color: '#64748b' }}>Khách hàng:</span>
            <strong style={{ color: '#0f172a' }}>{customerName}</strong>
            {phone && (
              <a
                href={`tel:${phone}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  color: '#2563eb',
                  fontWeight: 700,
                  textDecoration: 'none',
                  backgroundColor: '#dbeafe',
                  padding: '2px 8px',
                  borderRadius: '5px',
                  fontSize: '0.78rem'
                }}
              >
                <Phone size={12} /> {phone}
              </a>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
            <div style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
              <span style={{ color: '#64748b', fontSize: '0.78rem' }}>Thu hộ COD: </span>
              <strong style={{ color: isPrepaid ? '#16a34a' : '#ef4444', fontSize: '0.95rem' }}>
                {isPrepaid ? 'Đã Thanh Toán Online' : fmt ? fmt(codAmount) : `${codAmount.toLocaleString('vi-VN')} ₫`}
              </strong>
            </div>
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Mở Google Maps để nghe chỉ đường bằng giọng nói"
              style={{
                flexShrink: 0, width: '32px', height: '32px', borderRadius: '50%',
                backgroundColor: '#0284c7', color: '#fff', display: 'flex',
                alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(2,132,199,0.3)'
              }}
            >
              <ExternalLink size={15} />
            </a>
          </div>
        </div>

        <div style={{
          color: '#334155',
          fontSize: '0.78rem',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.35rem',
          lineHeight: 1.35
        }}>
          <MapPin size={14} style={{ color: '#ef4444', flexShrink: 0, marginTop: '2px' }} />
          <span><strong style={{ color: '#475569' }}>Địa chỉ:</strong> {address}</span>
        </div>
      </div>

      {/* Khung bản đồ — chiều cao cố định (không flex:1) vì giờ nằm trong
          dòng chảy nội dung bình thường, không còn bị ép vào 1 cột flex
          cao cố định nữa. */}
      <div style={{ position: 'relative', height: '280px' }}>
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

        {/* Nút nổi mở Google Maps trực tiếp trên bản đồ */}
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="Mở Google Maps để nghe chỉ đường bằng giọng nói"
          style={{
            position: 'absolute',
            top: '10px',
            left: '10px',
            zIndex: 999,
            backgroundColor: '#ffffff',
            color: '#1a73e8',
            textDecoration: 'none',
            padding: '7px 12px',
            borderRadius: '999px',
            fontSize: '0.74rem',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
            border: '1.5px solid rgba(26,115,232,0.25)'
          }}
        >
          <Navigation size={13} style={{ transform: 'rotate(45deg)' }} />
          <span>Google Maps</span>
          <ExternalLink size={12} />
        </a>

        {/* Nút căn góc nhìn — tròn tối giản, nhất quán với DeliveryMap.jsx */}
        <button
          type="button"
          onClick={fitFullRoute}
          title="Căn giữa lộ trình"
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            zIndex: 999,
            width: '38px',
            height: '38px',
            backgroundColor: '#fff',
            border: 'none',
            borderRadius: '50%',
            cursor: 'pointer',
            boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Compass size={17} color="#5f6368" />
        </button>

        {/* Badge trạng thái GPS — bấm được để tắt/bật lại, thay cho nút
            Bắt Đầu Giao/Tạm Dừng lớn trước đây (GPS giờ tự bật khi vào
            màn hình, badge này chỉ còn dùng khi cần tạm dừng thủ công). */}
        <button
          type="button"
          onClick={() => (isEffectiveGpsActive ? (onStopGps && onStopGps(order)) : (onStartDeliveryWithGps && onStartDeliveryWithGps(order, shipperLoc)))}
          title={isEffectiveGpsActive ? 'Bấm để tạm dừng phát GPS' : 'Bấm để bật lại GPS'}
          style={{
            position: 'absolute',
            bottom: '12px',
            left: '12px',
            zIndex: 999,
            border: 'none',
            cursor: 'pointer',
            backgroundColor: isEffectiveGpsActive ? '#15803d' : 'rgba(15, 23, 42, 0.85)',
            color: '#ffffff',
            padding: '5px 12px',
            borderRadius: '999px',
            fontSize: '0.75rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
          }}
        >
          {isEffectiveGpsActive ? <Pause size={12} /> : <Navigation size={12} />}
          <span style={{
            width: '8px', height: '8px', borderRadius: '50%',
            backgroundColor: isEffectiveGpsActive ? '#4ade80' : '#f59e0b',
            boxShadow: isEffectiveGpsActive ? '0 0 8px #4ade80' : 'none'
          }} />
          {isEffectiveGpsActive ? 'GPS ĐANG BẬT — BẤM ĐỂ TẠM DỪNG' : 'CHƯA BẬT GPS — BẤM ĐỂ BẬT'}
        </button>
      </div>

      {/* Thẻ ETA phẳng */}
      <div style={{
        padding: '0.85rem 1rem',
        backgroundColor: 'var(--bg-primary)',
        borderTop: '1px solid var(--border-glass)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem'
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
            {loadingRoute ? 'Đang tính...' : routeInfo ? `${routeInfo.durationMinutes} phút` : '—'}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {routeInfo ? `${routeInfo.distanceKm} km` : 'Tìm tuyến đường tối ưu'}
            {distanceRemaining != null && ` · Còn ${distanceRemaining < 0.15 ? 'đã đến nơi' : distanceRemaining < 1 ? `${Math.round(distanceRemaining * 1000)} m` : `${distanceRemaining.toFixed(1)} km`}`}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.82rem', fontWeight: 700 }}>
          <Gauge size={16} color="#7c3aed" />
          {speedKmh > 0 ? `${speedKmh} km/h` : 'Đang dừng'}
        </div>
      </div>

      {/* Nút Mở Google Maps Dẫn Đường Giọng Nói — To, nổi bật, dễ bấm bằng 1 ngón tay khi đang đi xe */}
      <div style={{ padding: '0.75rem 1rem 0', backgroundColor: 'var(--bg-app)' }}>
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.6rem',
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-md)',
            background: 'linear-gradient(135deg, #1a73e8 0%, #1557b0 100%)',
            color: '#ffffff',
            textDecoration: 'none',
            fontWeight: 800,
            fontSize: '0.86rem',
            boxShadow: '0 3px 12px rgba(26,115,232,0.35)',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          <div style={{
            width: 26, height: 26, borderRadius: '50%', backgroundColor: '#ffffff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <Navigation size={15} color="#1a73e8" style={{ transform: 'rotate(45deg)' }} />
          </div>
          <span style={{ flex: 1, textAlign: 'center' }}>
            🧭 Mở Google Maps Dẫn Đường Giọng Nói
          </span>
          <ExternalLink size={15} style={{ opacity: 0.85 }} />
        </a>
      </div>

      {/* Cảnh báo nếu chưa có toạ độ thực tế */}
      {locError && !isEffectiveGpsActive && (
        <div style={{
          padding: '0.45rem 1rem',
          backgroundColor: '#fffbeb',
          color: '#b45309',
          fontSize: '0.75rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          borderTop: '1px solid #fef3c7'
        }}>
          <AlertCircle size={14} />
          <span>{locError} Bấm nút bên dưới để cấp quyền định vị GPS thực tế.</span>
        </div>
      )}

      {/* Chụp ảnh minh chứng + thu tiền/người nhận + trượt xác nhận giao
          thành công — nằm cuối luồng nội dung, kéo xuống là thấy, kèm nút
          "Từ Chối" nhỏ bên cạnh thanh trượt. */}
      <div style={{ padding: '1rem' }}>
        <PODCaptureSection
          order={order}
          user={user}
          fmt={fmt}
          onConfirm={onConfirmDelivered}
          onReject={onReject}
        />
      </div>
    </div>
  );
}
