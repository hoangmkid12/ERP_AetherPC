import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { fetchRoadRoute, reverseGeocode } from '../utils/routingService';
import { TILE_URL, TILE_ATTRIBUTION, TILE_MAX_ZOOM, WAREHOUSE_ICON, DESTINATION_ICON, SHIPPER_ICON } from '../utils/mapIcons';

// Tần suất gọi lại OSRM/Nominatim khi Shipper di chuyển — GPS gửi mỗi 8s
// (xem GPS_SEND_INTERVAL_MS ở trang Delivery), nhưng không cần tính lại
// ETA/địa chỉ ở mọi lần đó; ~18s (2 lần cập nhật) là đủ mượt mà vẫn tôn
// trọng usage policy miễn phí của OSRM/Nominatim công khai.
const LIVE_RECALC_INTERVAL_MS = 18000;
// Thời lượng "trượt" marker giữa 2 điểm GPS liên tiếp — ngắn hơn chu kỳ gửi
// GPS để marker kịp đứng yên trước khi có điểm mới, tránh giật.
const MARKER_TWEEN_MS = 2200;

// Haversine — khoảng cách đường chim bay giữa 2 toạ độ (km)
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

export default function DeliveryMap({
  warehouse,
  destination,
  shipperPosition,
  shipperName,
  shipperPhone,
  height = '370px'
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const routeLayersRef = useRef([]);
  const [routeInfo, setRouteInfo] = useState(null);
  const [lastUpdatedLabel, setLastUpdatedLabel] = useState('');
  const routeCoordsRef = useRef([]);
  const animFrameRef = useRef(null);
  const remainingLayerRef = useRef(null);
  const lastLiveRecalcRef = useRef(0);
  const [remainingInfo, setRemainingInfo] = useState(null);
  const [currentAddress, setCurrentAddress] = useState('');

  // Hủy animation trượt marker khi component unmount, tránh setState/setLatLng
  // trên marker đã bị gỡ khỏi map.
  useEffect(() => () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
  }, []);

  // Khởi tạo bản đồ Leaflet 1 lần
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true
    });
    // Nền bản đồ Wikimedia (dựa trên dữ liệu OSM, tông nhạt/ít nhãn rườm rà
    // hơn tile OSM chuẩn) — miễn phí, không cần API key, khác với CartoDB
    // Positron (đã thử nhưng CartoDB giờ bắt buộc phải có key mới hiện tile).
    L.tileLayer(TILE_URL, {
      maxZoom: TILE_MAX_ZOOM,
      attribution: TILE_ATTRIBUTION
    }).addTo(map);
    // Leaflet ném lỗi "Set map center and zoom first" nếu gọi getBounds()/panTo()
    // trước khi map có view — có thể xảy ra khi shipperPosition đã có sẵn (từ
    // lastLocation tải qua REST) nhưng route OSRM (fitBounds ở effect dưới)
    // chưa kịp trả về. Đặt 1 view mặc định (toàn quốc) ngay từ đầu để luôn có
    // center/zoom hợp lệ, effect route sẽ tự fitBounds đè lên khi có dữ liệu.
    map.setView([16.0544, 108.2022], 5);
    mapRef.current = map;

    const handleResize = () => {
      if (mapRef.current) {
        setTimeout(() => mapRef.current?.invalidateSize(), 150);
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Tải và vẽ lộ trình đường bộ thực tế (OSRM Road Routing) giữa Kho và Nhà khách
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !warehouse || !destination) return;

    // Xóa marker cũ
    if (markersRef.current.warehouse) markersRef.current.warehouse.remove();
    if (markersRef.current.destination) markersRef.current.destination.remove();
    routeLayersRef.current.forEach(layer => layer.remove());
    routeLayersRef.current = [];
    if (remainingLayerRef.current) {
      remainingLayerRef.current.remove();
      remainingLayerRef.current = null;
    }
    setRemainingInfo(null);
    setCurrentAddress('');
    lastLiveRecalcRef.current = 0;

    // Marker Kho
    markersRef.current.warehouse = L.marker([warehouse.lat, warehouse.lng], { icon: WAREHOUSE_ICON })
      .addTo(map)
      .bindPopup(`<div style="padding:2px 4px;font-size:0.82rem;"><strong>Kho xuất phát</strong><br/>${warehouse.name || 'Kho AetherPC'}<br/><span style="font-size:0.75rem;color:#5f6368;">${warehouse.address || ''}</span></div>`);

    // Marker Nhà khách
    markersRef.current.destination = L.marker([destination.lat, destination.lng], { icon: DESTINATION_ICON })
      .addTo(map)
      .bindPopup(`<div style="padding:2px 4px;font-size:0.82rem;"><strong>Điểm nhận hàng</strong><br/>${destination.label || 'Địa chỉ nhận hàng'}</div>`);

    let isMounted = true;

    // Gọi dịch vụ OSRM để lấy toàn bộ các góc phố, khúc cua của con đường thực tế
    fetchRoadRoute(warehouse, destination).then(route => {
      if (!isMounted || !mapRef.current) return;

      if (route && route.coordinates && route.coordinates.length > 0) {
        setRouteInfo(route);
        routeCoordsRef.current = route.coordinates;

        // 1 đường mảnh, màu xám nhạt — thể hiện toàn tuyến dự kiến. Đoạn
        // "còn lại" (effect live-recalc bên dưới) sẽ vẽ đè lên bằng màu xanh
        // đậm, giống cách Google Maps làm mờ phần đã đi qua.
        const mainLine = L.polyline(route.coordinates, {
          color: '#9aa0a6',
          weight: 4,
          opacity: 0.85,
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(mapRef.current);

        routeLayersRef.current = [mainLine];

        // Tự động căn góc nhìn bao trọn toàn bộ con đường
        const bounds = L.latLngBounds(route.coordinates);
        if (shipperPosition) bounds.extend([shipperPosition.lat, shipperPosition.lng]);
        mapRef.current.fitBounds(bounds, { padding: [45, 45] });
      }
    });

    return () => {
      isMounted = false;
    };
  }, [warehouse?.lat, warehouse?.lng, destination?.lat, destination?.lng]);

  // Marker Shipper — trượt mượt giữa 2 điểm GPS liên tiếp thay vì nhảy tức thời
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !shipperPosition) return;
    const newPos = L.latLng(shipperPosition.lat, shipperPosition.lng);

    if (!markersRef.current.shipper) {
      markersRef.current.shipper = L.marker(newPos, { icon: SHIPPER_ICON, zIndexOffset: 1000 })
        .addTo(map)
        .bindPopup(`<div style="font-size:0.82rem;"><strong>${shipperName || 'Shipper AetherPC'}</strong>${shipperPhone ? `<br/>${shipperPhone}` : ''}<br/><span style="font-size:0.74rem;color:#1a73e8;">Đang di chuyển giao hàng</span></div>`);
    } else {
      const marker = markersRef.current.shipper;
      const startPos = marker.getLatLng();
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      const startTime = performance.now();
      const tick = (time) => {
        const t = Math.min(1, (time - startTime) / MARKER_TWEEN_MS);
        marker.setLatLng([
          startPos.lat + (newPos.lat - startPos.lat) * t,
          startPos.lng + (newPos.lng - startPos.lng) * t
        ]);
        if (t < 1) {
          animFrameRef.current = requestAnimationFrame(tick);
        } else {
          animFrameRef.current = null;
        }
      };
      animFrameRef.current = requestAnimationFrame(tick);
    }

    if (!map.getBounds().pad(0.15).contains(newPos)) {
      map.panTo(newPos, { animate: true, duration: 0.8 });
    }

    if (shipperPosition.updatedAt) {
      const d = new Date(shipperPosition.updatedAt);
      setLastUpdatedLabel(isNaN(d.getTime()) ? '' : d.toLocaleTimeString('vi-VN'));
    }
  }, [shipperPosition, shipperName, shipperPhone]);

  // ETA/quãng đường còn lại "sống" — tính lại từ vị trí hiện tại của Shipper
  // đến điểm giao (khác route toàn tuyến ở effect trên chỉ tính 1 lần lúc đầu
  // từ Kho), cộng thêm địa chỉ hiện tại (reverse geocode) kiểu Grab. Throttle
  // theo LIVE_RECALC_INTERVAL_MS để không gọi OSRM/Nominatim ở mọi lần GPS gửi.
  useEffect(() => {
    if (!shipperPosition || !destination) return;
    const now = Date.now();
    if (now - lastLiveRecalcRef.current < LIVE_RECALC_INTERVAL_MS) return;
    lastLiveRecalcRef.current = now;

    let cancelled = false;

    fetchRoadRoute(shipperPosition, destination).then((route) => {
      if (cancelled || !mapRef.current || !route?.coordinates?.length) return;
      setRemainingInfo(route);
      if (remainingLayerRef.current) remainingLayerRef.current.remove();
      remainingLayerRef.current = L.polyline(route.coordinates, {
        color: '#1a73e8',
        weight: 5,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(mapRef.current);
    });

    reverseGeocode(shipperPosition.lat, shipperPosition.lng).then((address) => {
      if (!cancelled && address) setCurrentAddress(address);
    });

    return () => { cancelled = true; };
  }, [shipperPosition, destination]);

  const fitFullRoute = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    if (routeCoordsRef.current.length > 0) {
      map.fitBounds(L.latLngBounds(routeCoordsRef.current), { padding: [45, 45], animate: true });
    } else if (warehouse && destination) {
      map.fitBounds(L.latLngBounds([[warehouse.lat, warehouse.lng], [destination.lat, destination.lng]]), { padding: [45, 45], animate: true });
    }
  }, [warehouse, destination]);

  // Khoảng cách đường chim bay từ Shipper đến bạn — chỉ có ý nghĩa khi đã có
  // tín hiệu GPS sống; không dùng lại cho trường hợp chưa có vị trí (đã có
  // số km theo tuyến đường ở khối ETA phía trên rồi, không cần lặp lại).
  let distanceDisplay = '';
  if (shipperPosition && destination) {
    const dKm = haversineKm(shipperPosition, destination);
    if (dKm != null) {
      distanceDisplay = dKm < 0.15 ? 'đã đến nơi' : dKm < 1 ? `${Math.round(dKm * 1000)} m` : `${dKm.toFixed(1)} km`;
    }
  }

  return (
    <div>
      {/* Khung bản đồ */}
      <div style={{ position: 'relative' }}>
        <div
          ref={containerRef}
          className="delivery-map-wrapper"
          style={{ width: '100%', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e8eaed' }}
        />

        {/* Nút căn chỉnh nhanh góc nhìn toàn tuyến — nút tròn tối giản kiểu Google Maps */}
        <button
          type="button"
          onClick={fitFullRoute}
          title="Xem toàn tuyến"
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            zIndex: 999,
            width: '34px',
            height: '34px',
            backgroundColor: '#fff',
            border: 'none',
            borderRadius: '50%',
            cursor: 'pointer',
            boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
            color: '#5f6368'
          }}
        >
          ⛶
        </button>
      </div>

      {/* Thông số lộ trình — 1 thẻ phẳng gọn, ưu tiên ETA lớn giống Google Maps */}
      <div style={{
        marginTop: '0.75rem',
        padding: '0.85rem 1rem',
        backgroundColor: '#fff',
        borderRadius: '12px',
        border: '1px solid #e8eaed',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem'
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#202124', lineHeight: 1.2 }}>
            {remainingInfo
              ? `${remainingInfo.durationMinutes} phút`
              : routeInfo ? `${routeInfo.durationMinutes} phút` : 'Đang tính toán...'}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#5f6368' }}>
            {(remainingInfo || routeInfo) ? `${(remainingInfo || routeInfo).distanceKm} km` : 'Tìm tuyến đường tối ưu'}
            {distanceDisplay ? ` · Cách bạn ${distanceDisplay}` : ''}
          </div>
        </div>

        <div style={{ textAlign: 'right', minWidth: 0 }}>
          <div style={{ color: '#202124', fontWeight: 600, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {shipperName || 'Shipper Nội Bộ'}
          </div>
          {shipperPhone && (
            <a href={`tel:${shipperPhone}`} style={{ color: '#1a73e8', textDecoration: 'none', fontSize: '0.78rem', fontWeight: 500 }}>
              {shipperPhone}
            </a>
          )}
          <div style={{ marginTop: '0.15rem' }}>
            {shipperPosition ? (
              <span style={{ color: '#188038', fontWeight: 600, fontSize: '0.72rem' }}>
                ● Trực tiếp {lastUpdatedLabel ? `(${lastUpdatedLabel})` : ''}
              </span>
            ) : (
              <span style={{ color: '#9aa0a6', fontSize: '0.72rem' }}>Chờ tín hiệu GPS...</span>
            )}
          </div>
        </div>
      </div>

      {/* Địa chỉ hiện tại của Shipper (reverse geocode) */}
      {currentAddress && (
        <div style={{
          marginTop: '0.4rem',
          padding: '0.4rem 0.2rem',
          fontSize: '0.78rem',
          color: '#5f6368',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.4rem'
        }}>
          <span>📍</span>
          <span>{currentAddress}</span>
        </div>
      )}
    </div>
  );
}

