import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { fetchRoadRoute } from '../utils/routingService';

const emojiIcon = (emoji, bg) => L.divIcon({
  className: 'aetherpc-delivery-marker',
  html: `<div style="width:36px;height:36px;border-radius:50%;background:${bg};display:flex;align-items:center;justify-content:center;font-size:20px;box-shadow:0 3px 10px rgba(0,0,0,0.35);border:2.5px solid #fff;transition:transform 0.2s ease;">${emoji}</div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18]
});

const WAREHOUSE_ICON = emojiIcon('🏬', '#2563eb');
const DESTINATION_ICON = emojiIcon('🏠', '#16a34a');
const SHIPPER_ICON = emojiIcon('🛵', '#f59e0b');

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

  // Khởi tạo bản đồ Leaflet 1 lần
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);
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

    // Marker Kho
    markersRef.current.warehouse = L.marker([warehouse.lat, warehouse.lng], { icon: WAREHOUSE_ICON })
      .addTo(map)
      .bindPopup(`<div style="padding:2px 4px;"><strong>🏬 Kho Xuất Phát</strong><br/>${warehouse.name || 'Kho AetherPC'}<br/><span style="font-size:0.75rem;color:#64748b;">${warehouse.address || ''}</span></div>`);

    // Marker Nhà khách
    markersRef.current.destination = L.marker([destination.lat, destination.lng], { icon: DESTINATION_ICON })
      .addTo(map)
      .bindPopup(`<div style="padding:2px 4px;"><strong>🏠 Điểm Nhận Hàng</strong><br/>${destination.label || 'Địa chỉ nhận hàng'}</div>`);

    let isMounted = true;

    // Gọi dịch vụ OSRM để lấy toàn bộ các góc phố, khúc cua của con đường thực tế
    fetchRoadRoute(warehouse, destination).then(route => {
      if (!isMounted || !mapRef.current) return;

      if (route && route.coordinates && route.coordinates.length > 0) {
        setRouteInfo(route);
        routeCoordsRef.current = route.coordinates;

        // 1. Lớp viền ngoài làm hiệu ứng đổ bóng cho đường lộ trình
        const borderLine = L.polyline(route.coordinates, {
          color: '#1d4ed8',
          weight: 8,
          opacity: 0.35,
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(mapRef.current);

        // 2. Lớp đường lộ trình thực tế chính (màu xanh công nghệ chuẩn TMĐT)
        const mainLine = L.polyline(route.coordinates, {
          color: '#2563eb',
          weight: 4.5,
          opacity: 0.95,
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(mapRef.current);

        routeLayersRef.current = [borderLine, mainLine];

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

  // Marker Shipper — Cập nhật vị trí mượt mà thời gian thực
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !shipperPosition) return;
    const pos = [shipperPosition.lat, shipperPosition.lng];

    if (markersRef.current.shipper) {
      markersRef.current.shipper.setLatLng(pos);
    } else {
      markersRef.current.shipper = L.marker(pos, { icon: SHIPPER_ICON, zIndexOffset: 1000 })
        .addTo(map)
        .bindPopup(`<strong>🛵 ${shipperName || 'Shipper AetherPC'}</strong>${shipperPhone ? `<br/>SĐT: ${shipperPhone}` : ''}<br/><span style="font-size:0.75rem;color:#16a34a;">● Đang di chuyển giao hàng</span>`);
    }

    if (!map.getBounds().pad(0.15).contains(pos)) {
      map.panTo(pos, { animate: true, duration: 0.8 });
    }

    if (shipperPosition.updatedAt) {
      const d = new Date(shipperPosition.updatedAt);
      setLastUpdatedLabel(isNaN(d.getTime()) ? '' : d.toLocaleTimeString('vi-VN'));
    }
  }, [shipperPosition, shipperName, shipperPhone]);

  const fitFullRoute = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    if (routeCoordsRef.current.length > 0) {
      map.fitBounds(L.latLngBounds(routeCoordsRef.current), { padding: [45, 45], animate: true });
    } else if (warehouse && destination) {
      map.fitBounds(L.latLngBounds([[warehouse.lat, warehouse.lng], [destination.lat, destination.lng]]), { padding: [45, 45], animate: true });
    }
  }, [warehouse, destination]);

  // Tính khoảng cách hiển thị
  let distanceDisplay = '';
  if (shipperPosition && destination) {
    const dKm = haversineKm(shipperPosition, destination);
    if (dKm != null) {
      distanceDisplay = dKm < 0.15 ? 'Đã đến điểm giao' : dKm < 1 ? `~${Math.round(dKm * 1000)} m` : `~${dKm.toFixed(1)} km`;
    }
  } else if (routeInfo?.distanceKm) {
    distanceDisplay = `~${routeInfo.distanceKm} km (toàn tuyến)`;
  }

  return (
    <div>
      {/* Khung bản đồ */}
      <div style={{ position: 'relative' }}>
        <div
          ref={containerRef}
          className="delivery-map-wrapper"
          style={{ width: '100%', borderRadius: '12px', overflow: 'hidden', border: '1.5px solid #cbd5e1', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.06)' }}
        />

        {/* Nút căn chỉnh nhanh góc nhìn toàn tuyến */}
        <button
          type="button"
          onClick={fitFullRoute}
          title="Căn giữa toàn bộ lộ trình"
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            zIndex: 999,
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            padding: '5px 10px',
            fontSize: '0.74rem',
            fontWeight: 700,
            color: '#1e293b',
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem'
          }}
        >
          Xem toàn tuyến
        </button>
      </div>

      {/* Thông số lộ trình đường bộ thực tế */}
      <div style={{
        marginTop: '0.75rem',
        padding: '0.65rem 0.85rem',
        backgroundColor: '#f8fafc',
        borderRadius: '10px',
        border: '1px solid #e2e8f0',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))',
        gap: '0.5rem 0.85rem',
        fontSize: '0.78rem',
        color: '#334155'
      }}>
        {/* Lộ trình đường bộ */}
        <div style={{ minWidth: 0 }}>
          <div style={{ color: '#64748b', fontSize: '0.72rem' }}>Tuyến tối ưu:</div>
          <strong style={{ color: '#2563eb', fontSize: '0.84rem', whiteSpace: 'nowrap' }}>
            {routeInfo ? `${routeInfo.distanceKm} km (~${routeInfo.durationMinutes}p)` : 'Đang tính toán...'}
          </strong>
        </div>

        {/* Shipper liên hệ */}
        <div style={{ minWidth: 0 }}>
          <div style={{ color: '#64748b', fontSize: '0.72rem' }}>Shipper phụ trách:</div>
          <div style={{ color: '#0f172a', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {shipperName || 'Shipper Nội Bộ'}
          </div>
          {shipperPhone && (
            <a href={`tel:${shipperPhone}`} style={{ color: '#2563eb', textDecoration: 'none', fontSize: '0.72rem', fontWeight: 600 }}>
              SĐT: {shipperPhone}
            </a>
          )}
        </div>

        {/* Khoảng cách hiện tại */}
        <div style={{ minWidth: 0 }}>
          <div style={{ color: '#64748b', fontSize: '0.72rem' }}>Khoảng cách đến bạn:</div>
          <strong style={{ color: '#059669', fontSize: '0.84rem', whiteSpace: 'nowrap' }}>
            {distanceDisplay || 'Đang cập nhật'}
          </strong>
        </div>

        {/* Thời gian cập nhật */}
        <div style={{ minWidth: 0 }}>
          <div style={{ color: '#64748b', fontSize: '0.72rem' }}>Tín hiệu GPS:</div>
          {shipperPosition ? (
            <span style={{ color: '#16a34a', fontWeight: 700, fontSize: '0.74rem' }}>
              ● Trực tiếp {lastUpdatedLabel ? `(${lastUpdatedLabel})` : ''}
            </span>
          ) : (
            <span style={{ color: '#ea580c', fontStyle: 'italic', fontSize: '0.72rem' }}>
              Chờ kích hoạt...
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

