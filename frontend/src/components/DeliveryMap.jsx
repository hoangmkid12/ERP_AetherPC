import React, { useEffect, useRef, useState, useCallback } from 'react';
import '@goongmaps/goong-js/dist/goong-js.css';
import { fetchRoadRoute, reverseGeocode, forwardGeocode } from '../utils/routingService';
import { goongjs, GOONG_STYLE_URL, createWarehouseElement, createDestinationElement, createShipperElement } from '../utils/mapIcons';

// Tần suất gọi lại OSRM/Nominatim khi Shipper di chuyển — GPS gửi mỗi 8s
// (xem GPS_SEND_INTERVAL_MS ở trang Delivery), nhưng không cần tính lại
// ETA/địa chỉ ở mọi lần đó; ~18s (2 lần cập nhật) là đủ mượt mà vẫn tôn
// trọng usage policy miễn phí của OSRM/Nominatim công khai.
const LIVE_RECALC_INTERVAL_MS = 18000;
// Thời lượng "trượt" marker giữa 2 điểm GPS liên tiếp — ngắn hơn chu kỳ gửi
// GPS để marker kịp đứng yên trước khi có điểm mới, tránh giật.
const MARKER_TWEEN_MS = 2200;
// Sau khi người xem tự tay kéo/zoom bản đồ, tạm ngừng auto-pan-theo-shipper
// trong khoảng thời gian này (~2 chu kỳ GPS) để không đè mất thao tác của họ.
// Bấm nút "Xem toàn tuyến" sẽ bật lại auto-follow ngay lập tức.
const AUTO_FOLLOW_PAUSE_MS = 15000;

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

// fetchRoadRoute trả toạ độ dạng [lat,lng] (quy ước Leaflet cũ, vẫn được
// dùng nguyên cho tính năng giả lập GPS ở Delivery/index.jsx) — goong-js
// (GeoJSON/mapbox-gl) cần [lng,lat], nên đổi thứ tự ngay tại nơi tiêu thụ
// thay vì đổi hợp đồng chung của routingService.js.
const EMPTY_LINE = { type: 'Feature', geometry: { type: 'LineString', coordinates: [] } };
const toLineFeature = (coordsLatLng) => ({
  type: 'Feature',
  geometry: { type: 'LineString', coordinates: coordsLatLng.map(([lat, lng]) => [lng, lat]) }
});

// goong-js (mapbox-gl) không có LngLatBounds.pad() như Leaflet — tự nới rộng
// bounds thêm 1 tỉ lệ % trước khi kiểm tra contains(), để tránh panTo quá
// nhạy mỗi khi marker chỉ lệch nhẹ khỏi khung nhìn.
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
  const styleReadyRef = useRef(false);
  const [routeInfo, setRouteInfo] = useState(null);
  const [lastUpdatedLabel, setLastUpdatedLabel] = useState('');
  const routeCoordsRef = useRef([]);
  const animFrameRef = useRef(null);
  const lastLiveRecalcRef = useRef(0);
  const lastUserInteractionRef = useRef(0);
  const [remainingInfo, setRemainingInfo] = useState(null);
  const [currentAddress, setCurrentAddress] = useState('');
  // Đổi mỗi khi style/nguồn dữ liệu bản đồ đã sẵn sàng — dùng làm dependency
  // để các effect vẽ route chạy lại đúng 1 lần ngay khi map load xong.
  const [styleReadyTick, setStyleReadyTick] = useState(0);

  // Tự động phân giải địa chỉ thực tế (Forward Geocoding) để lấy toạ độ chính xác thay vì chỉ toạ độ khu vực
  const [exactDestination, setExactDestination] = useState(destination);

  useEffect(() => {
    setExactDestination(destination);
  }, [destination?.lat, destination?.lng, destination?.label]);

  useEffect(() => {
    let isMounted = true;
    if (destination?.label) {
      forwardGeocode(destination.label).then(geo => {
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
  }, [destination?.label]);

  // Hủy animation trượt marker khi component unmount, tránh setState/setLngLat
  // trên marker đã bị gỡ khỏi map.
  useEffect(() => () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
  }, []);

  // Khởi tạo bản đồ goong-js 1 lần
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

    // originalEvent chỉ có mặt khi thao tác đến từ chuột/chạm thật của người
    // dùng — panTo()/fitBounds() gọi bằng code không set field này, nên đây
    // là cách phân biệt "người dùng tự kéo/zoom" với "code tự di chuyển bản đồ".
    const markUserInteraction = (e) => { if (e.originalEvent) lastUserInteractionRef.current = Date.now(); };
    map.on('dragstart', markUserInteraction);
    map.on('zoomstart', markUserInteraction);

    // Nguồn/lớp vẽ tuyến đường chỉ tạo được sau khi style load xong — tạo 1
    // lần rồi từ nay chỉ setData() lên nguồn có sẵn (không remove/add lại
    // layer mỗi lần cập nhật), tránh nháy bản đồ.
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

    const handleResize = () => {
      if (mapRef.current) {
        setTimeout(() => mapRef.current?.resize(), 150);
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      map.remove();
      mapRef.current = null;
      styleReadyRef.current = false;
    };
  }, []);

  // Tải và vẽ lộ trình đường bộ thực tế (OSRM Road Routing) giữa Kho và Nhà khách
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReadyRef.current || !warehouse || !exactDestination) return;

    // Xóa marker cũ
    if (markersRef.current.warehouse) markersRef.current.warehouse.remove();
    if (markersRef.current.destination) markersRef.current.destination.remove();
    map.getSource('remaining-route')?.setData(EMPTY_LINE);
    setRemainingInfo(null);
    setCurrentAddress('');
    lastLiveRecalcRef.current = 0;

    // Marker Kho
    markersRef.current.warehouse = new goongjs.Marker({ element: createWarehouseElement(), anchor: 'bottom' })
      .setLngLat([warehouse.lng, warehouse.lat])
      .setPopup(new goongjs.Popup({ offset: 28 }).setHTML(`<div style="padding:2px 4px;font-size:0.82rem;"><strong>Kho xuất phát</strong><br/>${warehouse.name || 'Kho AetherPC'}<br/><span style="font-size:0.75rem;color:#5f6368;">${warehouse.address || ''}</span></div>`))
      .addTo(map);

    // Marker Nhà khách
    markersRef.current.destination = new goongjs.Marker({ element: createDestinationElement(), anchor: 'bottom' })
      .setLngLat([exactDestination.lng, exactDestination.lat])
      .setPopup(new goongjs.Popup({ offset: 28 }).setHTML(`<div style="padding:2px 4px;font-size:0.82rem;"><strong>Điểm nhận hàng</strong><br/>${exactDestination.label || destination?.label || 'Địa chỉ nhận hàng'}</div>`))
      .addTo(map);

    let isMounted = true;

    // Gọi dịch vụ OSRM để lấy toàn bộ các góc phố, khúc cua của con đường thực tế
    fetchRoadRoute(warehouse, exactDestination).then(route => {
      if (!isMounted || !mapRef.current) return;

      if (route && route.coordinates && route.coordinates.length > 0) {
        setRouteInfo(route);
        routeCoordsRef.current = route.coordinates;

        const feature = toLineFeature(route.coordinates);
        mapRef.current.getSource('main-route')?.setData(feature);

        // Tự động căn góc nhìn bao trọn toàn bộ con đường
        const coords = feature.geometry.coordinates;
        const bounds = coords.reduce((b, c) => b.extend(c), new goongjs.LngLatBounds(coords[0], coords[0]));
        if (shipperPosition) bounds.extend([shipperPosition.lng, shipperPosition.lat]);
        mapRef.current.fitBounds(bounds, { padding: 45 });
      }
    });

    return () => {
      isMounted = false;
    };
  }, [warehouse?.lat, warehouse?.lng, exactDestination?.lat, exactDestination?.lng, styleReadyTick]);

  // Marker Shipper — trượt mượt giữa 2 điểm GPS liên tiếp thay vì nhảy tức thời
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !shipperPosition) return;
    const newLngLat = [shipperPosition.lng, shipperPosition.lat];

    if (!markersRef.current.shipper) {
      markersRef.current.shipper = new goongjs.Marker({ element: createShipperElement() })
        .setLngLat(newLngLat)
        .setPopup(new goongjs.Popup({ offset: 18 }).setHTML(`<div style="font-size:0.82rem;"><strong>${shipperName || 'Shipper AetherPC'}</strong>${shipperPhone ? `<br/>${shipperPhone}` : ''}<br/><span style="font-size:0.74rem;color:#1a73e8;">Đang di chuyển giao hàng</span></div>`))
        .addTo(map);
    } else {
      const marker = markersRef.current.shipper;
      const start = marker.getLngLat();
      const startLngLat = [start.lng, start.lat];
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      const startTime = performance.now();
      const tick = (time) => {
        const t = Math.min(1, (time - startTime) / MARKER_TWEEN_MS);
        marker.setLngLat([
          startLngLat[0] + (newLngLat[0] - startLngLat[0]) * t,
          startLngLat[1] + (newLngLat[1] - startLngLat[1]) * t
        ]);
        if (t < 1) {
          animFrameRef.current = requestAnimationFrame(tick);
        } else {
          animFrameRef.current = null;
        }
      };
      animFrameRef.current = requestAnimationFrame(tick);
    }

    const bounds = map.getBounds();
    const autoFollowPaused = Date.now() - lastUserInteractionRef.current < AUTO_FOLLOW_PAUSE_MS;
    if (bounds && !autoFollowPaused && !padLngLatBounds(bounds, 0.15).contains(newLngLat)) {
      map.panTo(newLngLat, { animate: true, duration: 800 });
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
    if (!shipperPosition || !exactDestination || !styleReadyRef.current) return;
    const now = Date.now();
    if (now - lastLiveRecalcRef.current < LIVE_RECALC_INTERVAL_MS) return;
    lastLiveRecalcRef.current = now;

    let cancelled = false;

    fetchRoadRoute(shipperPosition, exactDestination).then((route) => {
      if (cancelled || !mapRef.current || !route?.coordinates?.length) return;
      setRemainingInfo(route);
      mapRef.current.getSource('remaining-route')?.setData(toLineFeature(route.coordinates));
    });

    reverseGeocode(shipperPosition.lat, shipperPosition.lng).then((address) => {
      if (!cancelled && address) setCurrentAddress(address);
    });

    return () => { cancelled = true; };
  }, [shipperPosition, exactDestination, styleReadyTick]);

  const fitFullRoute = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    // Bấm nút này là tín hiệu người dùng chủ động muốn quay lại theo dõi
    // toàn tuyến — bật lại auto-follow ngay, không đợi hết cooldown.
    lastUserInteractionRef.current = 0;
    if (routeCoordsRef.current.length > 0) {
      const coords = routeCoordsRef.current.map(([lat, lng]) => [lng, lat]);
      const bounds = coords.reduce((b, c) => b.extend(c), new goongjs.LngLatBounds(coords[0], coords[0]));
      map.fitBounds(bounds, { padding: 45, animate: true });
    } else if (warehouse && exactDestination) {
      const bounds = new goongjs.LngLatBounds([warehouse.lng, warehouse.lat], [warehouse.lng, warehouse.lat])
        .extend([exactDestination.lng, exactDestination.lat]);
      map.fitBounds(bounds, { padding: 45, animate: true });
    }
  }, [warehouse, exactDestination]);

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
