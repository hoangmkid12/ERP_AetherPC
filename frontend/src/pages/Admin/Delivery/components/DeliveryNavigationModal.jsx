import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Navigation, Phone, MapPin, Compass, AlertCircle, Gauge, Camera, ExternalLink, Pause } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { fetchRoadRoute, forwardGeocode } from '../../../../utils/routingService';
import { TILE_URL, TILE_ATTRIBUTION, TILE_MAX_ZOOM, WAREHOUSE_ICON, DESTINATION_ICON, SHIPPER_ICON } from '../../../../utils/mapIcons';

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

export default function DeliveryNavigationModal({
  order,
  warehouse,
  destination,
  isGpsActive,
  onStartDeliveryWithGps,
  onStopGps,
  onOpenPOD,
  onClose,
  fmt
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const routeLayersRef = useRef([]);
  const routeCoordsRef = useRef([]);

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

  const googleMapsUrl = exactDestination?.lat && exactDestination?.lng
    ? `https://www.google.com/maps/dir/?api=1&destination=${exactDestination.lat},${exactDestination.lng}&travelmode=driving`
    : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}&travelmode=driving`;

  // 1. Khởi tạo bản đồ Leaflet
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true
    });
    L.tileLayer(TILE_URL, {
      maxZoom: TILE_MAX_ZOOM,
      attribution: TILE_ATTRIBUTION,
      subdomains: ['a', 'b', 'c']
    }).addTo(map);
    map.setView([16.0544, 108.2022], 5);
    mapRef.current = map;
    setTimeout(() => {
      if (mapRef.current) mapRef.current.invalidateSize();
    }, 200);

    return () => {
      map.remove();
      mapRef.current = null;
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

  // 3. Tính toán và vẽ lộ trình đường bộ tối ưu qua OSRM
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !exactDestination) return;

    // Điểm xuất phát ưu tiên: Vị trí thực tế của Shipper, nếu chưa có thì dùng vị trí Kho
    const origin = shipperLoc || warehouse;
    if (!origin) return;

    setLoadingRoute(true);

    // Xoá các marker & layer cũ
    if (markersRef.current.warehouse) markersRef.current.warehouse.remove();
    if (markersRef.current.destination) markersRef.current.destination.remove();
    routeLayersRef.current.forEach(layer => layer.remove());
    routeLayersRef.current = [];

    // Marker Điểm xuất phát (Kho hoặc Shipper)
    if (warehouse) {
      markersRef.current.warehouse = L.marker([warehouse.lat, warehouse.lng], { icon: WAREHOUSE_ICON })
        .addTo(map)
        .bindPopup(`<strong>🏬 Kho Xuất Phát:</strong><br/>${warehouse.name || 'Kho AetherPC'}`);
    }

    // Marker Điểm nhận hàng của Khách
    markersRef.current.destination = L.marker([exactDestination.lat, exactDestination.lng], { icon: DESTINATION_ICON })
      .addTo(map)
      .bindPopup(`<strong>🏠 Điểm Giao Hàng:</strong><br/>${customerName}<br/>${address}`);

    let isMounted = true;
    fetchRoadRoute(origin, exactDestination).then(route => {
      if (!isMounted || !mapRef.current) return;
      setLoadingRoute(false);

      if (route && route.coordinates && route.coordinates.length > 0) {
        setRouteInfo(route);
        routeCoordsRef.current = route.coordinates;

        const mainLine = L.polyline(route.coordinates, {
          color: '#1a73e8',
          weight: 5,
          opacity: 0.95,
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(mapRef.current);

        routeLayersRef.current = [mainLine];

        // Căn góc nhìn bao trọn tuyến đường
        const bounds = L.latLngBounds(route.coordinates);
        if (shipperLoc) bounds.extend([shipperLoc.lat, shipperLoc.lng]);
        mapRef.current.fitBounds(bounds, { padding: [40, 40] });
      }
    });

    return () => { isMounted = false; };
  }, [warehouse?.lat, warehouse?.lng, exactDestination?.lat, exactDestination?.lng, shipperLoc?.lat, shipperLoc?.lng]);

  // 4. Cập nhật vị trí Marker Shipper theo thời gian thực
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !shipperLoc) return;
    const pos = [shipperLoc.lat, shipperLoc.lng];

    if (markersRef.current.shipper) {
      markersRef.current.shipper.setLatLng(pos);
    } else {
      markersRef.current.shipper = L.marker(pos, { icon: SHIPPER_ICON, zIndexOffset: 1000 })
        .addTo(map)
        .bindPopup(`<strong>🛵 Vị Trí Của Bạn (Shipper)</strong><br/><span style="color:#16a34a;">● Đang phát tín hiệu GPS trực tiếp</span>`);
    }

    if (!map.getBounds().pad(0.15).contains(pos)) {
      map.panTo(pos, { animate: true, duration: 0.8 });
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
    if (routeCoordsRef.current.length > 0) {
      map.fitBounds(L.latLngBounds(routeCoordsRef.current), { padding: [40, 40], animate: true });
    }
  }, []);

  const distanceRemaining = shipperLoc && exactDestination ? haversineKm(shipperLoc, exactDestination) : null;

  return (
    <div className="delivery-fullscreen-modal">
      <div className="delivery-fullscreen-modal-inner">
        {/* Header Modal */}
        <div style={{
          padding: '0.85rem 1rem',
          borderBottom: '1px solid var(--border-glass)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--bg-primary)',
          flexShrink: 0
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

        {/* Vùng nội dung cuộn được — bọc thông tin khách hàng + bản đồ + ETA +
            cảnh báo GPS trong 1 khối cuộn riêng (flex:1 + minHeight:0) thay vì
            để chúng nằm thẳng trong cột flex cao cố định của modal: nếu không
            có minHeight:0, flex item mặc định không co xuống dưới chiều cao
            nội dung tự nhiên, khiến bản đồ (minHeight 340px) + các khối phía
            trên có thể vượt quá 100dvh trên máy màn hình thấp — phần bị tràn
            khi đó bị .delivery-fullscreen-modal-inner (overflow:hidden) cắt
            mất ở dưới, che luôn thanh nút "Đã Đến Nơi". Bọc cuộn riêng đảm bảo
            header và thanh nút hành động luôn cố định, luôn nhìn thấy được. */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
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

            <div style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
              <span style={{ color: '#64748b', fontSize: '0.78rem' }}>Thu hộ COD: </span>
              <strong style={{ color: isPrepaid ? '#16a34a' : '#ef4444', fontSize: '0.95rem' }}>
                {isPrepaid ? 'Đã Thanh Toán Online' : fmt ? fmt(codAmount) : `${codAmount.toLocaleString('vi-VN')} ₫`}
              </strong>
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

        {/* Khung bản đồ */}
        <div style={{ position: 'relative', flex: 1, minHeight: '340px' }}>
          <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: '340px' }} />

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

          {/* Badge trạng thái GPS */}
          <div style={{
            position: 'absolute',
            bottom: '12px',
            left: '12px',
            zIndex: 999,
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
          }}>
            <span style={{
              width: '8px', height: '8px', borderRadius: '50%',
              backgroundColor: isEffectiveGpsActive ? '#4ade80' : '#f59e0b',
              boxShadow: isEffectiveGpsActive ? '0 0 8px #4ade80' : 'none'
            }} />
            {isEffectiveGpsActive ? 'GPS THỜI GIAN THỰC ĐANG BẬT' : 'CHƯA BẬT GPS GIAO HÀNG'}
          </div>
        </div>

        {/* Thẻ ETA phẳng — cùng bố cục với bottom-card của DeliveryMap.jsx
            (số phút lớn nổi bật + khoảng cách/tốc độ phụ), thay cho lưới 4 ô
            trước đây vốn hơi chật trên màn hình dưới 360px. */}
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

        {/* Thanh nút hành động chính — Cân đối 3 cột đồng đều. Đặt NGAY TRONG
            vùng cuộn (không phải sibling ngoài flex) và ghim bằng
            position:sticky+bottom:0 thay vì chỉ dựa vào flex-shrink:0 của
            phần tử anh em: sticky bám theo scrollport thực tế của trình
            duyệt nên vẫn hiển thị đúng kể cả khi 100dvh tính sai/trễ so với
            chiều cao khả kiến thật trên điện thoại thật (thanh địa chỉ ẩn/hiện
            khi cuộn), tránh tái diễn lỗi bị khoảng trắng che mất nút. */}
        <div className="delivery-modal-action-bar" style={{
          position: 'sticky',
          bottom: 0,
          zIndex: 10,
          marginTop: 'auto',
          padding: '0.75rem 0.85rem 0',
          backgroundColor: '#ffffff',
          borderTop: '1px solid #e2e8f0',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '0.5rem',
          alignItems: 'center'
        }}>
          {!isEffectiveGpsActive ? (
            <button
              type="button"
              className="delivery-tap-target"
              onClick={() => onStartDeliveryWithGps && onStartDeliveryWithGps(order, shipperLoc)}
              style={{
                height: '46px',
                padding: '0 0.4rem',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                fontWeight: 700,
                fontSize: '0.84rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem',
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 8px rgba(37,99,235,0.2)'
              }}
            >
              <Navigation size={15} />
              Bắt Đầu Giao
            </button>
          ) : (
            <button
              type="button"
              className="delivery-tap-target"
              onClick={() => onStopGps && onStopGps(order)}
              style={{
                height: '46px',
                padding: '0 0.4rem',
                backgroundColor: '#fff1f2',
                color: '#e11d48',
                border: '1.5px solid #fecdd3',
                borderRadius: '10px',
                fontWeight: 700,
                fontSize: '0.84rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem',
                whiteSpace: 'nowrap'
              }}
            >
              <Pause size={15} />
              Tạm Dừng
            </button>
          )}

          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="delivery-tap-target"
            style={{
              height: '46px',
              padding: '0 0.4rem',
              backgroundColor: '#f0f9ff',
              color: '#0284c7',
              border: '1.5px solid #bae6fd',
              borderRadius: '10px',
              fontWeight: 700,
              fontSize: '0.84rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.35rem',
              textDecoration: 'none',
              whiteSpace: 'nowrap'
            }}
            title="Mở ứng dụng Google Maps ngoài để nghe chỉ đường bằng giọng nói"
          >
            <ExternalLink size={15} color="#0284c7" />
            Google Maps
          </a>

          <button
            type="button"
            className="delivery-tap-target"
            onClick={() => {
              onClose();
              if (onOpenPOD) onOpenPOD(order);
            }}
            style={{
              height: '46px',
              padding: '0 0.4rem',
              backgroundColor: '#16a34a',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              fontWeight: 700,
              fontSize: '0.84rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.35rem',
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 8px rgba(22,163,74,0.2)'
            }}
          >
            <Camera size={15} />
            Đã Đến Nơi
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}
