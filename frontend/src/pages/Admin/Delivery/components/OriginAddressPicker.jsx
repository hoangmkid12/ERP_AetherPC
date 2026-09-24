import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, MapPin, X, Loader2, Crosshair, CheckCircle2, Navigation } from 'lucide-react';
import '@goongmaps/goong-js/dist/goong-js.css';
import { goongjs, GOONG_STYLE_URL } from '../../../../utils/mapIcons';
import { searchAddressSuggestions, reverseGeocode, forwardGeocode } from '../../../../utils/routingService';

// Ghim giọt nước tuỳ biến cho điểm xuất phát
function createOriginPinElement() {
  const el = document.createElement('div');
  el.style.width = '30px';
  el.style.height = '42px';
  el.style.cursor = 'grab';
  el.innerHTML = `
    <svg width="30" height="42" viewBox="0 0 30 42" xmlns="http://www.w3.org/2000/svg" style="display:block;filter:drop-shadow(0 3px 6px rgba(0,0,0,0.35));">
      <defs>
        <linearGradient id="pinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#2563eb"/>
          <stop offset="100%" stop-color="#7c3aed"/>
        </linearGradient>
      </defs>
      <path d="M15 0C6.716 0 0 6.716 0 15c0 11.25 15 27 15 27s15-15.75 15-27C30 6.716 23.284 0 15 0z" fill="url(#pinGrad)"/>
      <circle cx="15" cy="15" r="6" fill="#ffffff"/>
      <circle cx="15" cy="15" r="3" fill="#2563eb"/>
    </svg>
  `;
  return el;
}

// Preset nhanh các vị trí phổ biến để test
const QUICK_PRESETS = [
  { label: 'Kho AetherPC (Q1)', address: '12 Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh', lat: 10.7769, lng: 106.7009 },
  { label: 'ĐH Sư Phạm Kỹ Thuật (Thủ Đức)', address: '1 Võ Văn Ngân, Phường Linh Chiểu, TP. Thủ Đức', lat: 10.8510, lng: 106.7720 },
  { label: 'Hồ Con Rùa (Quận 3)', address: 'Công Trường Quốc Tế, Phường 6, Quận 3, TP. Hồ Chí Minh', lat: 10.7828, lng: 106.6958 },
  { label: 'Hàng Xanh (Bình Thạnh)', address: 'Ngã tư Hàng Xanh, Phường 25, Bình Thạnh, TP. Hồ Chí Minh', lat: 10.8015, lng: 106.7115 }
];

export default function OriginAddressPicker({
  value,                    // string địa chỉ hiện tại
  onChange,                 // (addressText) => void
  onSelectCoord,            // (coord: {lat, lng, name}) => void
  selectedCoord             // {lat, lng, name} hiện tại
}) {
  const [inputValue, setInputValue] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [currentCoord, setCurrentCoord] = useState(selectedCoord || null);
  const [reverseLoading, setReverseLoading] = useState(false);

  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const isUserTypingRef = useRef(false);

  // Đồng bộ props ngoài vào
  useEffect(() => {
    if (!isUserTypingRef.current && value !== inputValue) {
      setInputValue(value || '');
    }
  }, [value]);

  useEffect(() => {
    if (selectedCoord) {
      setCurrentCoord(selectedCoord);
      if (markerRef.current && selectedCoord.lat && selectedCoord.lng) {
        markerRef.current.setLngLat([selectedCoord.lng, selectedCoord.lat]);
        mapRef.current?.flyTo({ center: [selectedCoord.lng, selectedCoord.lat], zoom: 15, duration: 800 });
      }
    }
  }, [selectedCoord]);

  // Khởi tạo bản đồ goong-js
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Tọa độ mặc định: Hồ Chí Minh hoặc selectedCoord
    const defaultCenter = currentCoord
      ? [currentCoord.lng, currentCoord.lat]
      : [106.7009, 10.7769];

    const map = new goongjs.Map({
      container: containerRef.current,
      style: GOONG_STYLE_URL,
      center: defaultCenter,
      zoom: currentCoord ? 15 : 13,
      attributionControl: false
    });

    map.addControl(new goongjs.NavigationControl({ showCompass: false }), 'top-right');

    const pinEl = createOriginPinElement();
    const marker = new goongjs.Marker({ element: pinEl, draggable: true, anchor: 'bottom' })
      .setLngLat(defaultCenter)
      .addTo(map);

    markerRef.current = marker;

    // Sự kiện kéo thả ghim marker
    marker.on('dragend', async () => {
      const lngLat = marker.getLngLat();
      handleLocationPick(lngLat.lat, lngLat.lng);
    });

    // Sự kiện click trực tiếp lên bất kỳ điểm nào trên bản đồ
    map.on('click', (e) => {
      marker.setLngLat(e.lngLat);
      handleLocationPick(e.lngLat.lat, e.lngLat.lng);
    });

    mapRef.current = map;

    return () => {
      marker.remove();
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  // Xử lý khi chọn vị trí trên bản đồ (click hoặc kéo marker)
  const handleLocationPick = async (lat, lng) => {
    setReverseLoading(true);
    let resolvedName = `Tọa độ: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    try {
      const addr = await reverseGeocode(lat, lng);
      if (addr) resolvedName = addr;
    } catch (_) {}

    const coordObj = { lat, lng, name: resolvedName };
    setCurrentCoord(coordObj);
    setInputValue(resolvedName);
    isUserTypingRef.current = false;
    setReverseLoading(false);

    onChange?.(resolvedName);
    onSelectCoord?.(coordObj);
  };

  // Debounced Autocomplete Search
  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputValue(val);
    isUserTypingRef.current = true;
    onChange?.(val);

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (!val.trim() || val.trim().length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    setLoadingSuggestions(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await searchAddressSuggestions(val);
        setSuggestions(results);
        setShowDropdown(results.length > 0);
      } catch (err) {
        console.warn('Lỗi tìm kiếm gợi ý:', err);
      } finally {
        setLoadingSuggestions(false);
      }
    }, 280);
  };

  // Khi bấm chọn 1 gợi ý từ dropdown
  const handleSelectSuggestion = (item) => {
    setInputValue(item.displayName);
    setShowDropdown(false);
    isUserTypingRef.current = false;

    const coordObj = { lat: item.lat, lng: item.lng, name: item.displayName };
    setCurrentCoord(coordObj);
    onChange?.(item.displayName);
    onSelectCoord?.(coordObj);

    if (mapRef.current && markerRef.current) {
      markerRef.current.setLngLat([item.lng, item.lat]);
      mapRef.current.flyTo({ center: [item.lng, item.lat], zoom: 15, duration: 800 });
    }
  };

  // Khi chọn 1 preset nhanh
  const handleSelectPreset = (preset) => {
    handleSelectSuggestion({
      displayName: preset.address,
      lat: preset.lat,
      lng: preset.lng
    });
  };

  // Về vị trí GPS người dùng trên bản đồ
  const handleLocateMe = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      if (mapRef.current && markerRef.current) {
        markerRef.current.setLngLat([lng, lat]);
        mapRef.current.flyTo({ center: [lng, lat], zoom: 16, duration: 800 });
      }
      handleLocationPick(lat, lng);
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
      {/* Search Input Bar with Autocomplete Dropdown */}
      <div style={{ position: 'relative', width: '100%' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.4rem',
          padding: '0.45rem 0.65rem',
          borderRadius: 'var(--radius-sm)',
          border: '1.5px solid var(--border-glass)',
          backgroundColor: 'var(--bg-primary)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          transition: 'border-color 0.15s'
        }}>
          <Search size={15} style={{ color: 'var(--primary)', flexShrink: 0 }} />
          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
            placeholder="Tìm số nhà, hẻm, tên đường, phường/quận..."
            style={{
              flex: 1, border: 'none', background: 'transparent',
              outline: 'none', fontSize: '0.78rem', color: 'var(--text-primary)',
              width: '100%'
            }}
          />
          {loadingSuggestions && (
            <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite', color: 'var(--text-muted)' }} />
          )}
          {inputValue && !loadingSuggestions && (
            <button
              type="button"
              onClick={() => {
                setInputValue('');
                setShowDropdown(false);
                setSuggestions([]);
                onChange?.('');
              }}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px', display: 'flex' }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Dropdown Gợi Ý Địa Chỉ */}
        {showDropdown && suggestions.length > 0 && (
          <div
            style={{
              position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
              backgroundColor: 'var(--bg-primary)',
              border: '1.5px solid var(--border-glass)',
              borderRadius: 'var(--radius-md)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
              zIndex: 9999,
              maxHeight: '210px',
              overflowY: 'auto'
            }}
          >
            <div style={{ padding: '0.35rem 0.6rem', fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', borderBottom: '1px solid var(--border-glass)', textTransform: 'uppercase' }}>
              📍 Kết quả tìm kiếm phù hợp
            </div>
            {suggestions.map((item, idx) => (
              <div
                key={idx}
                onClick={() => handleSelectSuggestion(item)}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
                  padding: '0.5rem 0.65rem', cursor: 'pointer',
                  borderBottom: idx < suggestions.length - 1 ? '1px solid var(--border-glass)' : 'none',
                  transition: 'background-color 0.15s'
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(37,99,235,0.08)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <MapPin size={14} style={{ color: '#2563eb', flexShrink: 0, marginTop: '2px' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.mainText}
                  </div>
                  {item.secondaryText && (
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.secondaryText}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick preset badges */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', overflowX: 'auto', paddingBottom: '2px' }}>
        <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Gợi ý nhanh:</span>
        {QUICK_PRESETS.map((p, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleSelectPreset(p)}
            style={{
              padding: '0.2rem 0.45rem',
              fontSize: '0.65rem',
              borderRadius: '999px',
              border: '1px solid var(--border-glass)',
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s'
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.color = '#2563eb'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-glass)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Khung Bản Đồ Tương Tác Chọn Điểm */}
      <div style={{ position: 'relative', width: '100%', height: '210px', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1.5px solid var(--border-glass)' }}>
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

        {/* Nút GPS định vị tôi trên bản đồ */}
        <button
          type="button"
          onClick={handleLocateMe}
          title="Lấy vị trí GPS hiện tại của bạn"
          style={{
            position: 'absolute', bottom: 10, right: 10, zIndex: 10,
            width: 32, height: 32, borderRadius: '50%',
            backgroundColor: 'var(--bg-primary)', border: '1.5px solid var(--border-glass)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: '#2563eb'
          }}
        >
          <Crosshair size={16} />
        </button>

        {/* Hướng dẫn thao tác mờ trên map */}
        <div style={{
          position: 'absolute', top: 8, left: 8, zIndex: 10,
          backgroundColor: 'rgba(15,23,42,0.75)', backdropFilter: 'blur(4px)',
          color: '#fff', fontSize: '0.65rem', fontWeight: 600,
          padding: '0.25rem 0.5rem', borderRadius: '999px',
          display: 'flex', alignItems: 'center', gap: '0.3rem', pointerEvents: 'none'
        }}>
          <span>👆 Bấm hoặc kéo ghim để chọn vị trí chính xác</span>
        </div>
      </div>

      {/* Thông tin vị trí đã ghim */}
      {currentCoord && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.45rem',
          padding: '0.4rem 0.6rem', borderRadius: 'var(--radius-sm)',
          backgroundColor: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.2)',
          fontSize: '0.7rem', color: '#2563eb'
        }}>
          {reverseLoading ? (
            <Loader2 size={13} style={{ animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
          ) : (
            <CheckCircle2 size={14} style={{ color: '#16a34a', flexShrink: 0 }} />
          )}
          <div style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            <strong>Đã chọn:</strong> {currentCoord.name || `${currentCoord.lat.toFixed(5)}, ${currentCoord.lng.toFixed(5)}`}
          </div>
        </div>
      )}
    </div>
  );
}
