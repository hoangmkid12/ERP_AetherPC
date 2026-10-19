import React, { useEffect, useRef, useState, useCallback } from 'react';
import '@goongmaps/goong-js/dist/goong-js.css';
import { fetchRoadRoute, reverseGeocode, forwardGeocode } from '../utils/routingService';
import { getAddressCoordinates } from '../utils/deliveryRegions';
import {
  goongjs,
  GOONG_STYLE_URL,
  CARTO_VOYAGER_STYLE,
  createDestinationElement,
  createShipperElement,
  updateShipperElementHeading
} from '../utils/mapIcons';

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

// Bản đồ theo dõi đơn của khách: chỉ hiển thị Shipper (GPS sống) => nhà khách.
// Các prop cũ warehouse/originType/originCoord nơi gọi còn truyền vào sẽ bị bỏ
// qua — đường đi không còn vẽ từ kho.
export default function DeliveryMap({
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
  const [exactDestination, setExactDestination] = useState(() => {
    if (destination?.label) {
      const quick = getAddressCoordinates(destination.label);
      if (quick?.lat && quick?.lng) return { ...destination, ...quick };
    }
    return destination;
  });

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
    const initLayers = () => {
      if (!mapRef.current) return;
      if (!map.getSource('main-route')) {
        map.addSource('main-route', { type: 'geojson', data: EMPTY_LINE });
        map.addLayer({
          id: 'main-route-line',
          type: 'line',
          source: 'main-route',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#9aa0a6', 'line-width': 4, 'line-opacity': 0.85 }
        });
      }
      if (!map.getSource('remaining-route')) {
        map.addSource('remaining-route', { type: 'geojson', data: EMPTY_LINE });
        map.addLayer({
          id: 'remaining-route-line',
          type: 'line',
          source: 'remaining-route',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#1a73e8', 'line-width': 5, 'line-opacity': 0.95 }
        });
      }
      styleReadyRef.current = true;
      setStyleReadyTick((t) => t + 1);
    };

    map.on('load', initLayers);

    map.on('error', (e) => {
      if (!styleReadyRef.current) {
        console.warn('Lỗi tải bản đồ Goong, chuyển sang bản đồ dự phòng CARTO:', e);
        try {
          map.setStyle(CARTO_VOYAGER_STYLE);
          map.once('styledata', () => {
            initLayers();
          });
        } catch (_) {}
      }
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
      Object.values(markersRef.current).forEach(m => m?.remove?.());
      markersRef.current = {};
      map.remove();
      mapRef.current = null;
      styleReadyRef.current = false;
    };
  }, []);

  // Điểm nhận hàng luôn hiển thị; đường đi CHỈ vẽ từ vị trí GPS sống của
  // Shipper tới nhà khách (không còn vẽ từ kho / điểm xuất phát giả định).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReadyRef.current || !exactDestination?.lat || !exactDestination?.lng) return;
    if (markersRef.current.destination) markersRef.current.destination.remove();
    markersRef.current.destination = new goongjs.Marker({ element: createDestinationElement(), anchor: 'bottom' })
      .setLngLat([exactDestination.lng, exactDestination.lat])
      .setPopup(new goongjs.Popup({ offset: 28 }).setHTML(`<div style="padding:2px 4px;font-size:0.82rem;"><strong>Điểm nhận hàng</strong><br/>${exactDestination.label || destination?.label || 'Địa chỉ nhận hàng'}</div>`))
      .addTo(map);
    if (!shipperPosition) map.flyTo({ center: [exactDestination.lng, exactDestination.lat], zoom: 15, duration: 600 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exactDestination?.lat, exactDestination?.lng, styleReadyTick]);

  // Tính lại tuyến khi có vị trí Shipper mới — throttle theo
  // LIVE_RECALC_INTERVAL_MS, fitBounds chỉ lần đầu cho mỗi điểm giao.
  const routeStateRef = useRef({ destKey: '', fitted: false });
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReadyRef.current || !shipperPosition || !exactDestination?.lat) return;
    const st = routeStateRef.current;
    const destKey = `${exactDestination.lat.toFixed(6)},${exactDestination.lng.toFixed(6)}`;
    const destChanged = st.destKey !== destKey;
    const now = Date.now();
    if (!destChanged && now - lastLiveRecalcRef.current < LIVE_RECALC_INTERVAL_MS) return;
    lastLiveRecalcRef.current = now;
    if (destChanged) { st.destKey = destKey; st.fitted = false; }

    let cancelled = false;
    fetchRoadRoute(shipperPosition, exactDestination).then((route) => {
      if (cancelled || !mapRef.current || !route?.coordinates?.length) return;
      setRemainingInfo(route);
      routeCoordsRef.current = route.coordinates;
      mapRef.current.getSource('remaining-route')?.setData(toLineFeature(route.coordinates));
      if (!st.fitted) {
        st.fitted = true;
        const coords = route.coordinates.map(([lat, lng]) => [lng, lat]);
        const bounds = coords.reduce((b, c) => b.extend(c), new goongjs.LngLatBounds(coords[0], coords[0]));
        mapRef.current.fitBounds(bounds, { padding: 45, maxZoom: 17 });
      }
    });

    reverseGeocode(shipperPosition.lat, shipperPosition.lng).then((addr) => {
      if (!cancelled && addr) setCurrentAddress(addr);
    });

    return () => { cancelled = true; };
  }, [shipperPosition, exactDestination?.lat, exactDestination?.lng, styleReadyTick]);

  const currentHeadingRef = useRef(0);

  // Marker Shipper — trượt mượt giữa 2 điểm GPS liên tiếp & xoay mượt theo hướng la bàn/chuyển động của Shipper
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !shipperPosition) return;
    const newLngLat = [shipperPosition.lng, shipperPosition.lat];
    const targetHeading = typeof shipperPosition.heading === 'number' && !isNaN(shipperPosition.heading)
      ? shipperPosition.heading
      : null;

    if (!markersRef.current.shipper) {
      markersRef.current.shipper = new goongjs.Marker({
        element: createShipperElement({ heading: targetHeading || 0 }),
        anchor: 'center'
      })
        .setLngLat(newLngLat)
        .setPopup(new goongjs.Popup({ offset: 18 }).setHTML(`<div style="font-size:0.82rem;"><strong>${shipperName || 'Shipper AetherPC'}</strong>${shipperPhone ? `<br/>${shipperPhone}` : ''}<br/><span style="font-size:0.74rem;color:#1a73e8;">Đang di chuyển giao hàng</span></div>`))
        .addTo(map);
      if (targetHeading != null) currentHeadingRef.current = targetHeading;
    } else {
      const marker = markersRef.current.shipper;
      const start = marker.getLngLat();
      const startLngLat = [start.lng, start.lat];

      const startH = currentHeadingRef.current || 0;
      let diffH = 0;
      if (targetHeading != null) {
        diffH = (targetHeading - startH) % 360;
        if (diffH > 180) diffH -= 360;
        if (diffH < -180) diffH += 360;
      }

      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      const startTime = performance.now();
      const tick = (time) => {
        const t = Math.min(1, (time - startTime) / MARKER_TWEEN_MS);
        marker.setLngLat([
          startLngLat[0] + (newLngLat[0] - startLngLat[0]) * t,
          startLngLat[1] + (newLngLat[1] - startLngLat[1]) * t
        ]);

        if (targetHeading != null) {
          const curH = (startH + diffH * t + 360) % 360;
          currentHeadingRef.current = curH;
          updateShipperElementHeading(marker.getElement(), curH);
        }

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
    } else if (shipperPosition && exactDestination?.lat) {
      const bounds = new goongjs.LngLatBounds([shipperPosition.lng, shipperPosition.lat], [shipperPosition.lng, shipperPosition.lat])
        .extend([exactDestination.lng, exactDestination.lat]);
      map.fitBounds(bounds, { padding: 45, animate: true });
    } else if (exactDestination?.lat) {
      map.flyTo({ center: [exactDestination.lng, exactDestination.lat], zoom: 15 });
    }
  }, [shipperPosition, exactDestination]);

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
              : shipperPosition ? 'Đang tính toán...' : 'Chờ Shipper xuất phát'}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#5f6368' }}>
            {remainingInfo ? `${remainingInfo.distanceKm} km` : shipperPosition ? 'Tìm tuyến đường' : 'Bản đồ sẽ hiện đường đi khi Shipper bật GPS'}
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
          <div style={{ marginTop: '0.15rem', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.35rem', flexWrap: 'wrap' }}>
            {shipperPosition ? (
              <>
                <span style={{ color: '#188038', fontWeight: 700, fontSize: '0.72rem' }}>
                  ● Trực tiếp {lastUpdatedLabel ? `(${lastUpdatedLabel})` : ''}
                </span>
                {typeof shipperPosition.heading === 'number' && !isNaN(shipperPosition.heading) && (
                  <span style={{ color: '#2563eb', fontSize: '0.7rem', fontWeight: 600, backgroundColor: '#eff6ff', padding: '1px 5px', borderRadius: '4px' }}>
                    🧭 {Math.round(shipperPosition.heading)}°
                  </span>
                )}
                {typeof shipperPosition.speed === 'number' && shipperPosition.speed > 0 && (
                  <span style={{ color: '#059669', fontSize: '0.7rem', fontWeight: 600, backgroundColor: '#ecfdf5', padding: '1px 5px', borderRadius: '4px' }}>
                    ⚡ {Math.round(shipperPosition.speed * 3.6)} km/h
                  </span>
                )}
              </>
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
