import React, { useState, useEffect } from 'react';
import { Search, ShoppingCart, Zap, Clock, Cpu, Gamepad2, Database, Layers, Box, Wind, Monitor, Keyboard, Mouse, Filter, X, SlidersHorizontal, Check, Sparkles, Trophy } from 'lucide-react';
import { notify } from '../../context/NotificationContext';
import { useCart } from '../../context/CartContext';

// So sánh thông số linh kiện (tách từ trang chủ cũ để dùng lại ở trang danh sách sản phẩm).
function formatPrice(price) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
}

const SPEC_LABEL_MAP = {
  'socket': 'Socket',
  'cores': 'Số nhân',
  'threads': 'Số luồng',
  'tdp': 'TDP',
  'ram_slot': 'Số khe RAM',
  'ram_slots': 'Số khe RAM',
  'ram_type': 'Loại RAM',
  'size_format': 'Chuẩn kích thước',
  'capacity': 'Dung lượng',
  'speed': 'Tốc độ',
  'bus': 'Bus RAM',
  'chipset': 'Chipset',
  'vram': 'VRAM',
  'wattage': 'Công suất',
  'rating': 'Chứng nhận hiệu suất',
  'modular': 'Chuẩn cáp',
  'type': 'Loại',
  'size': 'Kích thước',
  'speed_read': 'Tốc độ đọc',
  'read_speed': 'Tốc độ đọc',
  'write_speed': 'Tốc độ ghi',
  'max_vga_length': 'Hỗ trợ VGA tối đa',
  'max_tdp': 'TDP tối đa hỗ trợ',
  'cooling_type': 'Loại tản nhiệt',
  'fan_size': 'Kích thước quạt',
  'fan_rgb': 'Đèn LED',
  'bộ nhớ và tốc độ hỗ trợ (mt/s)': 'Tốc độ RAM tối đa',
  'tần số turbo tối đa của p-core': 'Xung P-core tối đa',
  'bộ nhớ đệm intel® smart (l3)': 'Bộ nhớ đệm L3',
  'tần số cơ bản của e-core': 'Xung cơ bản E-core',
  'tần số cơ bản của p-core': 'Xung cơ bản P-core',
  'nhân đồ họa': 'Đồ họa tích hợp',
  'đồ họa tích hợp': 'Đồ họa tích hợp',
  'số làn cpu pcie': 'Số làn PCIe',
  'dòng cpu': 'Dòng CPU',
  'bộ nhớ đệm l2 tổng': 'Bộ nhớ đệm L2',
  'xung nhịp tối đa': 'Xung nhịp tối đa',
  'socket_support': 'Hỗ trợ Socket'
};

function getSpecLabel(key) {
  const normalized = String(key).toLowerCase().trim();
  return SPEC_LABEL_MAP[normalized] || (key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '));
}


function ProductComparison({ products, onAddCart, onClose, initialProduct, clearInitialProduct }) {
  const getCategoryLabel = (cat) => {
    const labels = {
      CPU: 'CPU / Vi Xử Lý',
      VGA: 'Card Đồ Họa (VGA)',
      RAM: 'Bộ Nhớ RAM',
      MAINBOARD: 'Bo Mạch Chủ',
      STORAGE: 'Ổ Cứng SSD/HDD',
      PSU: 'Nguồn Máy Tính',
      COOLER: 'Tản Nhiệt',
      MONITOR: 'Màn Hình',
      KEYBOARD: 'Bàn Phím',
      MOUSE: 'Chuột Gaming'
    };
    return labels[cat] || cat;
  };

  const categoryIcons = {
    CPU: Cpu,
    VGA: Gamepad2,
    RAM: Layers,
    MAINBOARD: Box,
    STORAGE: Database,
    PSU: Zap,
    COOLER: Wind,
    MONITOR: Monitor,
    KEYBOARD: Keyboard,
    MOUSE: Mouse
  };

  const [selectedCategory, setSelectedCategory] = useState('CPU');
  const [compareList, setCompareList] = useState([null, null]);
  const [slotSearchQueries, setSlotSearchQueries] = useState(['', '', '']);
  const [isSearchingSlot, setIsSearchingSlot] = useState([true, true, false]);

  useEffect(() => {
    if (initialProduct) {
      const cat = (initialProduct.category || 'CPU').toUpperCase();
      setSelectedCategory(cat);
      const catProds = (products || []).filter(p => p && p.category && p.category.toUpperCase() === cat);
      const otherProd = catProds.find(p => String(p.id) !== String(initialProduct.id)) || null;
      
      setCompareList([initialProduct, otherProd]);
      setSlotSearchQueries(['', '', '']);
      setIsSearchingSlot([false, otherProd ? false : true, false]);
      clearInitialProduct();
    }
  }, [initialProduct]);

  const categoriesWithProducts = ['CPU', 'VGA', 'RAM', 'MAINBOARD', 'STORAGE', 'PSU', 'COOLER', 'MONITOR', 'KEYBOARD', 'MOUSE'];

  // Filter products by selected category
  const categoryProducts = (products || []).filter(p => p && p.category && p.category.toUpperCase() === selectedCategory.toUpperCase());

  const handleSearchQueryChange = (idx, value) => {
    setSlotSearchQueries(prev => {
      const copy = [...prev];
      copy[idx] = value;
      return copy;
    });
  };

  const handleSelectProduct = (idx, prod) => {
    setCompareList(prev => {
      const copy = [...prev];
      copy[idx] = prod;
      return copy;
    });
    setIsSearchingSlot(prev => {
      const copy = [...prev];
      copy[idx] = false;
      return copy;
    });
    setSlotSearchQueries(prev => {
      const copy = [...prev];
      copy[idx] = '';
      return copy;
    });
  };

  const addCompareSlot = () => {
    if (compareList.length < 3 && categoryProducts.length > compareList.length) {
      const remaining = categoryProducts.find(p => !compareList.some(item => String(item?.id) === String(p.id)));
      setCompareList([...compareList, remaining || null]);
      const newIdx = compareList.length;
      if (!remaining) {
        setIsSearchingSlot(prev => {
          const copy = [...prev];
          copy[newIdx] = true;
          return copy;
        });
      }
    }
  };

  const removeCompareSlot = (index) => {
    if (compareList.length > 1) {
      const newList = compareList.filter((_, i) => i !== index);
      setCompareList(newList);
      setIsSearchingSlot(prev => prev.filter((_, i) => i !== index));
      setSlotSearchQueries(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleAutoCompareCompetitor = () => {
    if (categoryProducts.length < 2) return;
    const currentSelected = compareList[0];
    const available = categoryProducts.filter(p => String(p?.id) !== String(currentSelected?.id));
    if (available.length > 0) {
      setCompareList([currentSelected || categoryProducts[0], available[0]]);
      setIsSearchingSlot([false, false, false]);
    }
  };

  // Get all unique spec keys from compared products
  const validCompareList = compareList.filter(Boolean);
  const allSpecKeys = [...new Set(
    validCompareList.flatMap(p => p.specs ? Object.keys(p.specs) : [])
  )];

  const getBestSpecIndex = (key) => {
    if (validCompareList.length < 2) return -1;
    
    const isLowerBetter = key.toLowerCase().includes('price') || key.toLowerCase().includes('gia') || key.toLowerCase().includes('tdp');
    let bestIdx = -1;
    let bestVal = isLowerBetter ? Infinity : -Infinity;

    compareList.forEach((p, idx) => {
      if (!p) return;
      let rawVal = null;

      if (key === 'price') {
        rawVal = parseFloat(p.price);
      } else if (p.specs && p.specs[key] !== undefined) {
        const v = p.specs[key];
        const match = String(v).match(/[\d.]+/);
        rawVal = match ? parseFloat(match[0]) : null;
      }

      if (rawVal !== null && !isNaN(rawVal)) {
        if (isLowerBetter) {
          if (rawVal < bestVal) {
            bestVal = rawVal;
            bestIdx = idx;
          }
        } else {
          if (rawVal > bestVal) {
            bestVal = rawVal;
            bestIdx = idx;
          }
        }
      }
    });

    const validVals = compareList
      .map(p => {
        if (!p) return null;
        if (key === 'price') return parseFloat(p.price);
        if (p.specs && p.specs[key] !== undefined) {
          const match = String(p.specs[key]).match(/[\d.]+/);
          return match ? parseFloat(match[0]) : null;
        }
        return null;
      })
      .filter(v => v !== null && !isNaN(v));

    if (validVals.length >= 2 && new Set(validVals).size > 1) {
      return bestIdx;
    }
    return -1;
  };

  const getOptimalRecommendation = () => {
    if (validCompareList.length === 0) return null;

    if (validCompareList.length === 1) {
      const p = validCompareList[0];
      return {
        isSingle: true,
        product: p,
        reason: `Bạn đang xem **${p.name}** (${formatPrice(p.price)}). Nhấn nút bên dưới để AI tự động ghép linh kiện đối thủ so sánh!`
      };
    }

    const scores = validCompareList.map(p => {
      let score = 0;
      const price = parseFloat(p.price) || 1;
      const rating = 4.5;
      const specs = p.specs || {};

      score += rating * 15;
      score += (5000000 / price) * 12;

      if (selectedCategory === 'CPU') {
        const cores = parseInt(specs.cores) || 4;
        const threads = parseInt(specs.threads) || 8;
        score += (cores * threads * 2500000 / price) * 25;
      } else if (selectedCategory === 'VGA') {
        const vramGb = parseInt(specs.vram) || 8;
        score += (vramGb * 7000000 / price) * 25;
      } else if (selectedCategory === 'RAM') {
        const capGb = parseInt(specs.capacity) || 8;
        score += (capGb * 1200000 / price) * 25;
      } else if (selectedCategory === 'STORAGE') {
        const speed = parseInt(specs.speed_read) || 3000;
        score += (speed * 600000 / price) * 25;
      }

      return { product: p, score };
    });

    scores.sort((a, b) => b.score - a.score);
    const winner = scores[0].product;
    const runnerUp = scores[1]?.product;

    const winnerPrice = formatPrice(winner.price);
    let advantageText = '';

    if (selectedCategory === 'CPU') {
      const cores = winner.specs?.cores;
      advantageText = `Vượt trội nhờ hiệu năng tính toán đa nhiệm (${cores ? cores + ' nhân' : 'cực mạnh'}), phù hợp làm việc nặng & gaming với mức giá đầu tư tối ưu **${winnerPrice}**.`;
    } else if (selectedCategory === 'VGA') {
      const vram = winner.specs?.vram;
      advantageText = `Sở hữu dung lượng VRAM (${vram || 'cao'}) cùng khả năng xử lý đồ họa ấn tượng, đạt hiệu năng fps/giá tốt nhất.`;
    } else if (selectedCategory === 'RAM' || selectedCategory === 'STORAGE') {
      advantageText = `Tốc độ truy xuất và băng thông cao hơn, tăng tốc toàn bộ hệ thống với chi phí đầu tư hợp lý nhất.`;
    } else {
      advantageText = `Cân bằng xuất sắc giữa chất lượng linh kiện, độ ổn định lâu dài và mức giá **${winnerPrice}**.`;
    }

    return {
      isSingle: false,
      product: winner,
      runnerUp: runnerUp,
      reason: `**${winner.name}** là lựa chọn đáng mua nhất! ${advantageText}`
    };
  };

  const getSpecLabel = (key) => {
    const labels = {
      socket: 'Socket CPU',
      cores: 'Số Nhân (Cores)',
      threads: 'Số Luồng (Threads)',
      clock_base: 'Xung Cơ Bản',
      clock_boost: 'Xung Tối Đa (Boost)',
      cache: 'Bộ Nhớ Đệm (Cache)',
      vram: 'Dung Lượng VRAM',
      memory_type: 'Chuẩn Bộ Nhớ (RAM)',
      capacity: 'Dung Lượng',
      bus_speed: 'Tốc Độ BUS',
      form_factor: 'Kích Thước (Form Factor)',
      chipset: 'Chipset',
      wattage: 'Công Suất (Wattage)',
      rating: 'Chuẩn Hiệu Suất 80 Plus',
      tdp: 'Mức Tiêu Thụ Điện (TDP)'
    };
    return labels[key] || key.replace(/_/g, ' ').toUpperCase();
  };

  const bestPriceIdx = getBestSpecIndex('price');
  const recommendation = getOptimalRecommendation();

  return (
    <div style={{ padding: '0.25rem', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', color: '#1e293b' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.65rem', marginBottom: '0.65rem', flexShrink: 0 }}>
        <div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, letterSpacing: '-0.02em' }}>
            <div style={{ width: 30, height: 30, borderRadius: '8px', background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(37, 99, 235, 0.3)' }}>
              <SlidersHorizontal size={16} style={{ color: '#fff' }} />
            </div>
            So Sánh Thông Số & Đề Xuất Mua Hàng
          </h3>
          <p style={{ fontSize: '0.775rem', color: '#64748b', margin: '0.15rem 0 0', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Sparkles size={12} style={{ color: '#d97706' }} /> Phân tích tự động thông số & giá bán từ kho hàng AetherPC
          </p>
        </div>
        {onClose && (
          <button 
            onClick={onClose}
            style={{ 
              background: '#f1f5f9', 
              border: '1px solid #cbd5e1', 
              color: '#475569', 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              width: 32,
              height: 32,
              borderRadius: '50%', 
              transition: 'all 0.2s',
              marginLeft: '1rem'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#ef4444';
              e.currentTarget.style.borderColor = '#ef4444';
              e.currentTarget.style.color = '#ffffff';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = '#f1f5f9';
              e.currentTarget.style.borderColor = '#cbd5e1';
              e.currentTarget.style.color = '#475569';
            }}
          >
            <X size={15} />
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto', paddingBottom: '0.5rem', marginBottom: '0.5rem', flexShrink: 0 }}>
        {categoriesWithProducts.map(cat => {
          const IconComp = categoryIcons[cat] || Box;
          const isSelected = selectedCategory === cat;
          const count = (products || []).filter(p => p && p.category && p.category.toUpperCase() === cat).length;

          return (
            <button
              key={cat}
              onClick={() => {
                setSelectedCategory(cat);
                setCompareList([null, null]);
                setSlotSearchQueries(['', '', '']);
                setIsSearchingSlot([true, true, false]);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.35rem 0.75rem',
                borderRadius: '8px',
                border: isSelected ? '1px solid #dc2626' : '1px solid #e2e8f0',
                background: isSelected ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : '#f8fafc',
                color: isSelected ? '#ffffff' : '#475569',
                cursor: 'pointer',
                fontWeight: isSelected ? 700 : 600,
                fontSize: '0.775rem',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s ease'
              }}
            >
              <IconComp size={13} style={{ color: isSelected ? '#ffffff' : '#dc2626' }} />
              {getCategoryLabel(cat)}
              <span style={{
                fontSize: '0.65rem',
                padding: '1px 5px',
                borderRadius: '6px',
                background: isSelected ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
                color: isSelected ? '#ffffff' : '#334155',
                marginLeft: '2px'
              }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Smart AI Recommendation Banner (Compact Single-Bar) */}
      {recommendation ? (
        <div style={{
          background: recommendation.isSingle
            ? 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)'
            : 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
          border: recommendation.isSingle
            ? '1px solid #bfdbfe'
            : '1px solid #bbf7d0',
          borderRadius: '10px',
          padding: '0.5rem 0.85rem',
          marginBottom: '0.65rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.85rem',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', minWidth: 0, flex: 1 }}>
            <div style={{
              background: recommendation.isSingle ? '#2563eb' : '#16a34a',
              color: '#fff',
              borderRadius: '6px',
              padding: '3px 7px',
              fontSize: '0.7rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              flexShrink: 0
            }}>
              {recommendation.isSingle ? <Sparkles size={12} /> : <Trophy size={12} />}
              {recommendation.isSingle ? 'AI Gợi Ý' : 'AI Khuyên Chọn'}
            </div>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} dangerouslySetInnerHTML={{
              __html: recommendation.reason.replace(/\*\*(.*?)\*\*/g, '<strong style="color: #15803d; font-weight: 700;">$1</strong>')
            }} />
          </div>

          {!recommendation.isSingle ? (
            ((Number(recommendation.product?.stockQuantity) > 0 || Number(recommendation.product?.stock) > 0) && !recommendation.product?.isPreorder) ? (
              <button
                onClick={() => onAddCart(recommendation.product)}
                style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  border: 'none',
                  color: '#fff',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '6px',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  flexShrink: 0,
                  boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)',
                  whiteSpace: 'nowrap'
                }}
              >
                <ShoppingCart size={12} /> Thêm SP Khuyên Chọn Vào Giỏ ({formatPrice(recommendation.product.price)})
              </button>
            ) : (
              <button
                disabled
                style={{
                  backgroundColor: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  color: '#94a3b8',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '6px',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  cursor: 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  flexShrink: 0,
                  whiteSpace: 'nowrap'
                }}
              >
                SP Khuyên Chọn (Đặt Trước)
              </button>
            )
          ) : (
            <button
              onClick={handleAutoCompareCompetitor}
              style={{
                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                border: 'none',
                color: '#fff',
                padding: '0.35rem 0.75rem',
                borderRadius: '6px',
                fontWeight: 700,
                fontSize: '0.75rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                flexShrink: 0,
                whiteSpace: 'nowrap'
              }}
            >
              <Zap size={12} /> Ghép Tự Động So Sánh
            </button>
          )}
        </div>
      ) : null}

      {/* Product Selection Slots Grid */}
      {compareList.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: `200px repeat(${compareList.length}, minmax(260px, 1fr)) ${compareList.length < 3 && categoryProducts.length > compareList.length ? '130px' : ''}`,
          gap: '0.65rem',
          marginBottom: '0.65rem',
          alignItems: 'stretch',
          flexShrink: 0
        }}>
          {/* Column 0: Label Card */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '0.5rem 0.85rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            minWidth: '200px'
          }}>
            <h4 style={{ margin: 0, fontSize: '0.825rem', fontWeight: 800, color: '#0f172a' }}>Linh Kiện So Sánh</h4>
            <p style={{ margin: '0.15rem 0 0', fontSize: '0.725rem', color: '#64748b' }}>
              Đã chọn {validCompareList.length}/{compareList.length} mẫu
            </p>
          </div>

          {/* Slot Cards */}
          {compareList.map((p, idx) => {
            const searching = isSearchingSlot[idx];
            const query = slotSearchQueries[idx].toLowerCase();
            const suggestions = categoryProducts
              .filter(item => item.name.toLowerCase().includes(query))
              .slice(0, 5);

            return (
              <div key={`slot-card-${idx}`} style={{
                background: '#ffffff',
                border: searching ? '1px solid #2563eb' : '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '0.5rem 0.75rem',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                minWidth: '260px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
              }}>
                {/* Delete Slot Button */}
                {compareList.length > 2 && (
                  <button 
                    onClick={() => removeCompareSlot(idx)}
                    style={{
                      position: 'absolute',
                      top: '4px',
                      right: '4px',
                      background: '#ffe4e6',
                      border: 'none',
                      color: '#be123c',
                      borderRadius: '50%',
                      width: '20px',
                      height: '20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      zIndex: 12
                    }}
                    title="Xóa cột này"
                  >
                    <X size={11} />
                  </button>
                )}

                {searching ? (
                  /* SEARCH MODE */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', height: '100%' }}>
                    <div style={{ display: 'flex', gap: '0.3rem' }}>
                      <div style={{ position: 'relative', flex: 1 }}>
                        <Search size={12} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                        <input
                          type="text"
                          placeholder="Nhập tên linh kiện..."
                          value={slotSearchQueries[idx]}
                          onChange={(e) => handleSearchQueryChange(idx, e.target.value)}
                          autoFocus
                          style={{
                            width: '100%',
                            padding: '0.35rem 0.35rem 0.35rem 1.8rem',
                            backgroundColor: '#ffffff',
                            border: '1px solid #2563eb',
                            borderRadius: '6px',
                            color: '#0f172a',
                            fontSize: '0.775rem',
                            outline: 'none',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>
                      {p && (
                        <button
                          onClick={() => setIsSearchingSlot(prev => {
                            const copy = [...prev];
                            copy[idx] = false;
                            return copy;
                          })}
                          style={{
                            padding: '0.35rem 0.55rem',
                            backgroundColor: '#f1f5f9',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            color: '#475569',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            fontWeight: 600
                          }}
                        >
                          Hủy
                        </button>
                      )}
                    </div>

                    {/* Inline Suggestions List */}
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.25rem',
                      maxHeight: '110px',
                      overflowY: 'auto'
                    }}>
                      {suggestions.length === 0 ? (
                        <div style={{ padding: '0.4rem', fontSize: '0.725rem', color: '#64748b', textAlign: 'center' }}>
                          Không tìm thấy linh kiện
                        </div>
                      ) : (
                        suggestions.map(sug => (
                          <div
                            key={sug.id}
                            onClick={() => handleSelectProduct(idx, sug)}
                            style={{
                              padding: '0.35rem 0.5rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              cursor: 'pointer',
                              borderRadius: '5px',
                              backgroundColor: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              transition: 'all 0.2s',
                              textAlign: 'left'
                            }}
                          >
                            <div style={{ width: '28px', height: '28px', backgroundColor: '#fff', borderRadius: '4px', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid #e2e8f0' }}>
                              <img src={sug.image || `https://placehold.co/70x70/1e263d/94a3b8?text=${sug.category}`} alt={sug.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sug.name}</div>
                              <div style={{ fontSize: '0.675rem', color: '#16a34a', fontWeight: 700 }}>{formatPrice(sug.price)}</div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ) : (
                  /* DISPLAY PRODUCT MODE */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', height: '100%' }}>
                    {p ? (
                      <>
                        <div style={{ display: 'flex', gap: '0.55rem', alignItems: 'center' }}>
                          <div style={{ width: '44px', height: '44px', backgroundColor: '#fff', borderRadius: '8px', padding: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0, border: '1px solid #e2e8f0' }}>
                            <img src={p.image || `https://placehold.co/70x70/1e263d/94a3b8?text=${p.category}`} alt={p.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                          </div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: '0.785rem', fontWeight: 700, color: '#0f172a', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: '1.25' }} title={p.name}>
                              {p.name}
                            </div>
                            <span style={{ fontSize: '0.675rem', background: '#f1f5f9', padding: '1px 5px', borderRadius: '4px', color: '#475569', fontWeight: 600, marginTop: '2px', display: 'inline-block' }}>
                              {p.brand}
                            </span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '0.35rem', marginTop: 'auto' }}>
                          <button
                            onClick={() => setIsSearchingSlot(prev => {
                              const copy = [...prev];
                              copy[idx] = true;
                              return copy;
                            })}
                            style={{
                              flex: 1,
                              padding: '0.3rem',
                              fontSize: '0.725rem',
                              backgroundColor: '#f1f5f9',
                              border: '1px solid #cbd5e1',
                              color: '#334155',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '0.2rem'
                            }}
                          >
                            Đổi
                          </button>
                          {((Number(p.stockQuantity) > 0 || Number(p.stock) > 0) && !p.isPreorder) ? (
                            <button
                              onClick={() => onAddCart(p)}
                              style={{
                                flex: 1.3,
                                padding: '0.3rem',
                                fontSize: '0.725rem',
                                background: '#16a34a',
                                border: 'none',
                                color: '#fff',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.25rem',
                                boxShadow: '0 2px 6px rgba(22, 163, 74, 0.2)'
                              }}
                            >
                              <ShoppingCart size={11} /> Thêm Vào Giỏ
                            </button>
                          ) : (
                            <button
                              disabled
                              title="Hết hàng sẵn tại kho, vui lòng liên hệ đặt trước"
                              style={{
                                flex: 1.3,
                                padding: '0.3rem',
                                fontSize: '0.725rem',
                                backgroundColor: '#f1f5f9',
                                border: '1px solid #cbd5e1',
                                color: '#94a3b8',
                                borderRadius: '6px',
                                cursor: 'not-allowed',
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.2rem'
                              }}
                            >
                              <Clock size={13} /> Đặt Trước
                            </button>
                          )}
                        </div>
                      </>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0.5rem 0', border: '2px dashed #cbd5e1', borderRadius: '8px', height: '100%' }}>
                        <button
                          onClick={() => setIsSearchingSlot(prev => {
                            const copy = [...prev];
                            copy[idx] = true;
                            return copy;
                          })}
                          style={{
                            padding: '0.35rem 0.65rem',
                            fontSize: '0.75rem',
                            background: '#2563eb',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem'
                          }}
                        >
                          Chọn linh kiện {idx + 1}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Add Slot Card Button */}
          {compareList.length < 3 && categoryProducts.length > compareList.length && (
            <button
              onClick={addCompareSlot}
              style={{
                background: '#f8fafc',
                border: '2px dashed #93c5fd',
                borderRadius: '10px',
                padding: '0.5rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#2563eb',
                fontWeight: 700,
                fontSize: '0.75rem',
                gap: '0.2rem',
                minWidth: '130px',
                transition: 'all 0.2s'
              }}
            >
              <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', color: '#2563eb' }}>
                +
              </div>
              Thêm Cột
            </button>
          )}
        </div>
      )}

      {/* Specification Comparison Table Area */}
      {compareList.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
          Không có sản phẩm nào trong danh mục này để so sánh.
        </div>
      ) : (
        <div style={{
          overflowX: 'auto',
          overflowY: 'auto',
          flex: 1,
          paddingRight: '4px',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          background: '#ffffff'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '780px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                <th style={{
                  width: '200px',
                  minWidth: '200px',
                  maxWidth: '200px',
                  padding: '0.9rem 1.25rem',
                  color: '#334155',
                  fontSize: '0.825rem',
                  fontWeight: 700,
                  whiteSpace: 'nowrap'
                }}>
                  Thông Số Chi Tiết
                </th>
                {compareList.map((p, idx) => (
                  <th key={`table-head-${idx}`} style={{
                    padding: '0.9rem 1.25rem',
                    minWidth: '260px',
                    color: '#0f172a',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {p ? p.name : `Linh kiện ${idx + 1}`}
                  </th>
                ))}
                {compareList.length < 3 && categoryProducts.length > compareList.length && <th></th>}
              </tr>
            </thead>
            <tbody>
              {/* Row: Price */}
              <tr style={{ borderBottom: '1px solid #f1f5f9', background: '#ffffff' }}>
                <td style={{
                  width: '200px',
                  minWidth: '200px',
                  maxWidth: '200px',
                  padding: '0.9rem 1.25rem',
                  color: '#334155',
                  fontSize: '0.825rem',
                  fontWeight: 700,
                  whiteSpace: 'nowrap'
                }}>
                  Giá bán niêm yết
                </td>
                {compareList.map((p, idx) => {
                  const isCheapest = idx === bestPriceIdx;
                  return (
                    <td key={`price-${idx}`} style={{
                      padding: '0.9rem 1.25rem',
                      fontSize: '1.05rem',
                      fontWeight: 800,
                      color: isCheapest ? '#16a34a' : '#0f172a',
                      background: isCheapest ? '#dcfce7' : 'transparent'
                    }}>
                      {p ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span>{formatPrice(p.price)}</span>
                          {isCheapest && (
                            <span style={{ fontSize: '0.7rem', background: '#16a34a', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                              Giá tốt nhất
                            </span>
                          )}
                        </div>
                      ) : '-'}
                    </td>
                  );
                })}
                {compareList.length < 3 && categoryProducts.length > compareList.length && <td></td>}
              </tr>

              {/* Row: Status */}
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{
                  width: '200px',
                  minWidth: '200px',
                  maxWidth: '200px',
                  padding: '0.9rem 1.25rem',
                  color: '#334155',
                  fontSize: '0.825rem',
                  fontWeight: 700,
                  whiteSpace: 'nowrap'
                }}>
                  Trạng thái kho hàng
                </td>
                {compareList.map((p, idx) => {
                  if (!p) return <td key={`status-${idx}`} style={{ padding: '0.9rem 1.25rem', fontSize: '0.8rem' }}>-</td>;
                  
                  const isStockAvailable = p.available && p.stockQuantity > 0;
                  const isPreOrder = p.available && p.stockQuantity === 0;

                  return (
                    <td key={`status-${idx}`} style={{ padding: '0.9rem 1.25rem', fontSize: '0.8rem' }}>
                      <span style={{
                        color: isStockAvailable ? '#15803d' : (isPreOrder ? '#b45309' : '#be123c'),
                        background: isStockAvailable ? '#dcfce7' : (isPreOrder ? '#fef3c7' : '#ffe4e6'),
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem'
                      }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: isStockAvailable ? '#16a34a' : (isPreOrder ? '#d97706' : '#dc2626') }} />
                        {isStockAvailable ? `Còn ${p.stockQuantity} sản phẩm` : (isPreOrder ? 'Hàng đặt trước' : 'Ngừng kinh doanh')}
                      </span>
                    </td>
                  );
                })}
                {compareList.length < 3 && categoryProducts.length > compareList.length && <td></td>}
              </tr>

              {/* Dynamic Specs Rows */}
              {allSpecKeys.map(key => {
                const bestIdx = getBestSpecIndex(key);
                return (
                  <tr key={key} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{
                      width: '200px',
                      minWidth: '200px',
                      maxWidth: '200px',
                      padding: '0.85rem 1.25rem',
                      color: '#475569',
                      fontSize: '0.825rem',
                      fontWeight: 600,
                      whiteSpace: 'nowrap'
                    }}>
                      {getSpecLabel(key)}
                    </td>
                    {compareList.map((p, idx) => {
                      const val = p && p.specs ? p.specs[key] : null;
                      const isBest = idx === bestIdx;
                      return (
                        <td key={`spec-${key}-${idx}`} style={{
                          padding: '0.85rem 1.25rem',
                          fontSize: '0.85rem',
                          color: isBest ? '#15803d' : '#0f172a',
                          fontWeight: isBest ? 700 : 500,
                          background: isBest ? '#dcfce7' : 'transparent'
                        }}>
                          {val !== null && val !== undefined ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <span>{Array.isArray(val) ? val.join(', ') : String(val)}</span>
                              {isBest && (
                                <span style={{
                                  fontSize: '0.675rem',
                                  color: '#15803d',
                                  background: '#bbf7d0',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontWeight: 700,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '2px'
                                }}>
                                  <Check size={11} /> Tốt nhất
                                </span>
                              )}
                            </div>
                          ) : '-'}
                        </td>
                      );
                    })}
                    {compareList.length < 3 && categoryProducts.length > compareList.length && <td></td>}
                  </tr>
                );
              })}

            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Hộp thoại bao quanh bảng so sánh
export default function ComparisonModal({ products, initialProduct, onClose }) {
  const { addToCart } = useCart();
  const [initial, setInitial] = useState(initialProduct || null);
  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100000000, padding: '1.25rem' }}
      onClick={onClose}>
      <div style={{ width: '95vw', maxWidth: '1400px', height: '88vh', maxHeight: '92vh', backgroundColor: '#ffffff', borderRadius: '14px', boxShadow: '0 25px 60px rgba(15, 23, 42, 0.3)', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '1.5rem 1.75rem' }}
        onClick={e => e.stopPropagation()}>
        <ProductComparison
          products={products}
          onAddCart={(p) => {
            const inStock = (Number(p.stockQuantity) > 0 || Number(p.stock) > 0) && !p.isPreorder;
            if (!inStock) {
              notify('Sản phẩm này hiện đang trong diện ĐẶT TRƯỚC, vui lòng liên hệ CSKH để được hỗ trợ!', 'error');
              return;
            }
            addToCart(p, 1);
          }}
          onClose={onClose}
          initialProduct={initial}
          clearInitialProduct={() => setInitial(null)}
        />
      </div>
    </div>
  );
}
