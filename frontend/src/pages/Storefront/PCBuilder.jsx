import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { api } from '../../services/api';
import {
  Cpu, Trash2, ShieldCheck, ShieldAlert, ShoppingCart, HelpCircle, Sparkles,
  AlertTriangle, XCircle, Layers, Database, Gamepad2, Zap, HardDrive, Box, Wind,
  Copy, Printer, MessageSquare
} from 'lucide-react';
import { HARDWARE_KNOWLEDGE_BASE, parseCustomerPrompt, runAIOptimizer } from '../../config/pcBuilderAIKnowledge';

const COMPONENT_SLOTS = [
  { id: 'CPU', label: 'Bộ xử lý (CPU)', icon: <Cpu size={18} /> },
  { id: 'MAINBOARD', label: 'Bo mạch chủ (Mainboard)', icon: <Layers size={18} /> },
  { id: 'RAM', label: 'Bộ nhớ (RAM)', icon: <Database size={18} /> },
  { id: 'VGA', label: 'Card đồ họa (VGA)', icon: <Gamepad2 size={18} /> },
  { id: 'PSU', label: 'Nguồn máy tính (PSU)', icon: <Zap size={18} /> },
  { id: 'STORAGE', label: 'Ổ cứng (Storage)', icon: <HardDrive size={18} /> },
  { id: 'CASE', label: 'Vỏ máy tính (Case)', icon: <Box size={18} /> },
  { id: 'COOLER', label: 'Tản nhiệt (Cooler)', icon: <Wind size={18} /> }
];

const FALLBACK_PRODUCTS = [
  { id: 1, name: 'Intel Core i5-13400F', category: 'CPU', price: 4890000, brand: 'Intel', specs: { socket: 'LGA1700', cores: 10, threads: 16, tdp: 65 } },
  { id: 2, name: 'Intel Core i7-14700K', category: 'CPU', price: 10990000, brand: 'Intel', specs: { socket: 'LGA1700', cores: 20, threads: 28, tdp: 125 } },
  { id: 3, name: 'ASUS ROG STRIX B760-F Gaming WiFi', category: 'MAINBOARD', price: 5490000, brand: 'ASUS', specs: { socket: 'LGA1700', ram_slot: 4, ram_type: 'DDR5', size_format: 'ATX' } },
  { id: 4, name: 'MSI PRO H610M-E DDR4', category: 'MAINBOARD', price: 1850000, brand: 'MSI', specs: { socket: 'LGA1700', ram_slot: 2, ram_type: 'DDR4', size_format: 'Micro-ATX' } },
  { id: 5, name: 'Corsair Vengeance RGB 32GB (2x16GB) DDR5 6000MHz', category: 'RAM', price: 3250000, brand: 'Corsair', specs: { ram_type: 'DDR5', capacity: '32GB', speed: '6000MHz' } },
  { id: 6, name: 'Kingston Fury Beast 16GB DDR4 3200MHz', category: 'RAM', price: 1050000, brand: 'Kingston', specs: { ram_type: 'DDR4', capacity: '16GB', speed: '3200MHz' } },
  { id: 7, name: 'ASUS ROG Strix RTX 4070 Super 12GB OC', category: 'VGA', price: 21990000, brand: 'ASUS', specs: { chipset: 'RTX 4070 Super', vram: '12GB', power_pin: '16-pin', tdp: 220 } },
  { id: 8, name: 'MSI GeForce RTX 4060 Ventus 2X 8GB OC', category: 'VGA', price: 8390000, brand: 'MSI', specs: { chipset: 'RTX 4060', vram: '8GB', power_pin: '8-pin', tdp: 115 } },
  { id: 9, name: 'Corsair RM750e 750W 80 Plus Gold', category: 'PSU', price: 2890000, brand: 'Corsair', specs: { wattage: 750, rating: '80 Plus Gold', modular: 'Full' } },
  { id: 10, name: 'MSI MAG A650BN 650W 80 Plus Bronze', category: 'PSU', price: 1390000, brand: 'MSI', specs: { wattage: 650, rating: '80 Plus Bronze', modular: 'No' } },
  { id: 11, name: 'Samsung 990 PRO 1TB PCIe 4.0 NVMe', category: 'STORAGE', price: 2990000, brand: 'Samsung', specs: { type: 'SSD NVMe', size: 'M.2 2280', speed_read: '7450MB/s' } },
  { id: 12, name: 'NZXT H5 Flow Black', category: 'CASE', price: 2390000, brand: 'NZXT', specs: { size_format: 'ATX', max_vga_length: 365 } },
  { id: 13, name: 'Deepcool AK400 Digital', category: 'COOLER', price: 850000, brand: 'Deepcool', specs: { type: 'Air Cooling', socket_support: ['LGA1700', 'AM4', 'AM5'], max_tdp: 220 } }
];

// Helper functions for parsing attributes from specs or name
const getSocket = (item) => {
  if (!item) return '';
  // 1. Check specs object
  if (item.specs?.socket) {
    let s = item.specs.socket.toString().toUpperCase().trim();
    if (s === '1700' || s === 'LGA 1700') return 'LGA1700';
    if (s === '1200' || s === 'LGA 1200') return 'LGA1200';
    if (s === '1851' || s === 'LGA 1851') return 'LGA1851';
    if (s === '1151' || s === 'LGA 1151') return 'LGA1151';
    if (s.startsWith('LGA') || s.startsWith('AM')) return s;
    return s;
  }
  // 2. Search in name
  const name = (item.name || '').toUpperCase();
  if (name.includes('LGA1700') || name.includes('LGA 1700')) return 'LGA1700';
  if (name.includes('LGA1851') || name.includes('LGA 1851')) return 'LGA1851';
  if (name.includes('LGA1200') || name.includes('LGA 1200')) return 'LGA1200';
  if (name.includes('LGA1151') || name.includes('LGA 1151')) return 'LGA1151';
  if (name.includes('AM5')) return 'AM5';
  if (name.includes('AM4')) return 'AM4';
  // 3. Infer from CPU model names (common Intel/AMD)
  if (name.includes('13400') || name.includes('13500') || name.includes('13600') || name.includes('13700') || name.includes('13900') ||
      name.includes('14400') || name.includes('14500') || name.includes('14600') || name.includes('14700') || name.includes('14900') ||
      name.includes('12400') || name.includes('12600') || name.includes('12700') || name.includes('12900') ||
      name.includes('I5-13') || name.includes('I7-13') || name.includes('I9-13') ||
      name.includes('I5-14') || name.includes('I7-14') || name.includes('I9-14') ||
      name.includes('I5-12') || name.includes('I7-12') || name.includes('I9-12') ||
      name.includes('I3-12') || name.includes('I3-13') || name.includes('I3-14')) return 'LGA1700';
  if (name.includes('ULTRA 5') || name.includes('ULTRA 7') || name.includes('ULTRA 9') || name.includes('CORE ULTRA') || name.includes('285') || name.includes('265')) return 'LGA1851';
  if (name.includes('10400') || name.includes('10600') || name.includes('10700') || name.includes('10900') ||
      name.includes('11400') || name.includes('11600') || name.includes('11700') || name.includes('11900') ||
      name.includes('I5-10') || name.includes('I7-10') || name.includes('I5-11') || name.includes('I7-11')) return 'LGA1200';
  if (name.includes('RYZEN') && (name.includes('7600') || name.includes('7700') || name.includes('7800') || name.includes('7900') || name.includes('7950') ||
      name.includes('9600') || name.includes('9700') || name.includes('9800') || name.includes('9900') || name.includes('9950'))) return 'AM5';
  if (name.includes('RYZEN') && (name.includes('5600') || name.includes('5700') || name.includes('5800') || name.includes('5900') || name.includes('5950') ||
      name.includes('3600') || name.includes('3700') || name.includes('3800') || name.includes('3900') || name.includes('3950') || name.includes('3100') || name.includes('3300'))) return 'AM4';
  // 4. Mainboard chipset names
  if (name.includes('B760') || name.includes('Z790') || name.includes('H770') || name.includes('B660') || name.includes('Z690') || name.includes('H610') || name.includes('H670') || name.includes('Z690')) return 'LGA1700';
  if (name.includes('Z890') || name.includes('B860') || name.includes('H870')) return 'LGA1851';
  if (name.includes('B550') || name.includes('X570') || name.includes('B450') || name.includes('A520') || name.includes('A320')) return 'AM4';
  if (name.includes('B650') || name.includes('X670') || name.includes('A620') || name.includes('X870')) return 'AM5';
  if (name.includes('B560') || name.includes('Z590') || name.includes('H510') || name.includes('H570')) return 'LGA1200';
  return '';
};

const getRamType = (item) => {
  if (!item) return '';
  if (item.specs?.ram_type) {
    return item.specs.ram_type.toString().toUpperCase().trim();
  }
  const name = item.name.toUpperCase();
  if (name.includes('DDR5')) return 'DDR5';
  if (name.includes('DDR4')) return 'DDR4';
  if (name.includes('DDR3')) return 'DDR3';
  return '';
};

const getRamFormFactor = (item) => {
  if (!item) return '';
  const name = item.name.toUpperCase();
  if (name.includes('LAPTOP') || name.includes('SODIMM') || name.includes('SO-DIMM') || name.includes('SODIM')) {
    return 'SODIMM'; // Laptop RAM
  }
  return 'DIMM'; // Desktop RAM
};

const getPsuWattageHelper = (item) => {
  if (!item) return 0;
  if (item.specs?.wattage) {
    const w = parseInt(item.specs.wattage);
    if (!isNaN(w)) return w;
  }
  const name = item.name.toUpperCase();
  const match = name.match(/(\d+)\s*[WWw]/);
  if (match) {
    return parseInt(match[1]);
  }
  return 0;
};

const getCpuTdp = (item) => {
  if (!item) return 0;
  if (item.specs?.tdp) {
    const tdp = parseInt(item.specs.tdp);
    if (!isNaN(tdp)) return tdp;
  }
  const name = item.name.toUpperCase();
  if (name.includes('I9') || name.includes('RYZEN 9')) return 125;
  if (name.includes('I7') || name.includes('RYZEN 7')) return 105;
  if (name.includes('I5') || name.includes('RYZEN 5')) return 65;
  if (name.includes('I3') || name.includes('RYZEN 3')) return 60;
  return 65; // default
};

const getVgaTdp = (item) => {
  if (!item) return 0;
  if (item.specs?.tdp) {
    const tdp = parseInt(item.specs.tdp);
    if (!isNaN(tdp)) return tdp;
  }
  const name = item.name.toUpperCase();
  if (name.includes('4090')) return 450;
  if (name.includes('4080')) return 320;
  if (name.includes('4070') && (name.includes('TI') || name.includes('SUPER'))) return 285;
  if (name.includes('4070')) return 200;
  if (name.includes('4060') && name.includes('TI')) return 160;
  if (name.includes('4060')) return 115;
  if (name.includes('3090')) return 350;
  if (name.includes('3080')) return 320;
  if (name.includes('3070')) return 220;
  if (name.includes('3060')) return 170;
  if (name.includes('1660') || name.includes('1650')) return 75;
  return 150; // default
};

const getMbSize = (item) => {
  if (!item) return '';
  if (item.specs?.size_format) {
    return item.specs.size_format.toString().toUpperCase().trim();
  }
  const name = item.name.toUpperCase();
  if (name.includes('ITX') || name.includes('MINI-ITX')) return 'MINI-ITX';
  if (name.includes('E-ATX') || name.includes('EATX')) return 'E-ATX';
  if (name.includes('H610M') || name.includes('B660M') || name.includes('B760M') || name.includes('B650M') || name.includes('A520M') || name.includes('H81M')) {
    return 'MICRO-ATX';
  }
  if (name.includes('M-PLUS') || name.includes('M-A') || name.includes('M-K') || name.includes('M-E')) {
    return 'MICRO-ATX';
  }
  return 'ATX';
};

const getCaseSizeSupport = (item) => {
  if (!item) return '';
  if (item.specs?.size_format) {
    return item.specs.size_format.toString().toUpperCase().trim();
  }
  const name = item.name.toUpperCase();
  if (name.includes('MINI') || name.includes('ITX')) return 'MINI-ITX';
  if (name.includes('MICRO') || name.includes('M-ATX') || name.includes('MINI TOWER')) return 'MICRO-ATX';
  return 'ATX';
};

export default function PCBuilder() {
  const [products, setProducts] = useState(FALLBACK_PRODUCTS);
  const [selectedParts, setSelectedParts] = useState({
    CPU: null,
    MAINBOARD: null,
    RAM: null,
    VGA: null,
    PSU: null,
    STORAGE: null,
    CASE: null,
    COOLER: null
  });
  const [activeSlot, setActiveSlot] = useState(null);
  const [modalSearch, setModalSearch] = useState('');
  const [modalBrandFilter, setModalBrandFilter] = useState('all');
  const [modalSortOrder, setModalSortOrder] = useState('default');
  const [warnings, setWarnings] = useState([]);
  const [onlyCompatible, setOnlyCompatible] = useState(true);
  const [aiUsage, setAiUsage] = useState('gaming');
  const [aiBudget, setAiBudget] = useState(25000000);
  const [aiBrand, setAiBrand] = useState('all');
  const [aiGpuBrand, setAiGpuBrand] = useState('all');
  const [aiMfgBrand, setAiMfgBrand] = useState('all');
  const [customPromptText, setCustomPromptText] = useState('');
  const [aiReport, setAiReport] = useState(null);
  const [isAnalyzingAI, setIsAnalyzingAI] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [activeStepTab, setActiveStepTab] = useState(0);
  const { addToCart } = useCart();

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await api.get('/products');
        if (response && response.length > 0) {
          setProducts(response);
        }
      } catch (err) {
        console.warn('Backend API unavailable. Displaying local fallback computer parts list.', err);
      }
    };
    fetchProducts();

    // Check if there is a pending AI build from chatbot
    const pendingBuildStr = localStorage.getItem('aetherpc_active_build') || localStorage.getItem('aetherpc_ai_selected_build');
    if (pendingBuildStr) {
      try {
        const parsed = JSON.parse(pendingBuildStr);
        if (parsed && typeof parsed === 'object') {
          const cleanedBuild = {};
          Object.entries(parsed).forEach(([slot, item]) => {
            if (item) {
              cleanedBuild[slot] = {
                ...item,
                price: parseFloat(item.price) || 0
              };
            }
          });
          setSelectedParts(prev => ({ ...prev, ...cleanedBuild }));
        }
      } catch (e) {
        console.warn("Failed to apply pending AI build", e);
      } finally {
        localStorage.removeItem('aetherpc_active_build');
        localStorage.removeItem('aetherpc_ai_selected_build');
      }
    }

    const handleApplyBuildEvent = (e) => {
      if (e.detail && typeof e.detail === 'object') {
        const cleanedBuild = {};
        Object.entries(e.detail).forEach(([slot, item]) => {
          if (item) {
            cleanedBuild[slot] = {
              ...item,
              price: parseFloat(item.price) || 0
            };
          }
        });
        setSelectedParts(prev => ({ ...prev, ...cleanedBuild }));
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };
    window.addEventListener('aetherpc_apply_ai_build', handleApplyBuildEvent);
    return () => window.removeEventListener('aetherpc_apply_ai_build', handleApplyBuildEvent);
  }, []);

  // Validation Engine
  useEffect(() => {
    const newWarnings = [];
    const { CPU, MAINBOARD, RAM, VGA, PSU, CASE, COOLER } = selectedParts;

    // 1. CPU & Mainboard Socket check
    if (CPU && MAINBOARD) {
      const cpuSocket = getSocket(CPU);
      const mbSocket = getSocket(MAINBOARD);
      if (cpuSocket && mbSocket && cpuSocket !== mbSocket) {
        newWarnings.push({
          level: 'error',
          text: `Không tương thích Socket: CPU dùng Socket [${cpuSocket}] nhưng Bo mạch chủ dùng Socket [${mbSocket}].`
        });
      }
    }

    // 2. Mainboard & RAM DDR generation check
    if (MAINBOARD && RAM) {
      const mbRamType = getRamType(MAINBOARD);
      const ramType = getRamType(RAM);
      if (mbRamType && ramType && mbRamType !== ramType) {
        newWarnings.push({
          level: 'error',
          text: `Không tương thích RAM: Bo mạch chủ hỗ trợ [${mbRamType}] nhưng RAM đang chọn là [${ramType}].`
        });
      }
    }

    // 3. RAM Form Factor Check (Desktop vs Laptop RAM)
    if (MAINBOARD && RAM) {
      const ramForm = getRamFormFactor(RAM);
      if (ramForm === 'SODIMM') {
        newWarnings.push({
          level: 'error',
          text: `Sai loại RAM: RAM đã chọn là RAM Laptop (SODIMM), không lắp ráp được vào Bo mạch chủ PC thông thường.`
        });
      }
    }

    // 4. Power PSU Capacity check
    const estTdp = getEstimatedTdp();
    const psuWattage = getPsuWattageHelper(PSU);
    if (PSU) {
      const safetyBuffer = estTdp * 1.25; // 25% safety margin
      if (psuWattage < safetyBuffer) {
        newWarnings.push({
          level: 'warning',
          text: `Công suất nguồn yếu: Tổng công suất ước tính hệ thống là ${estTdp}W. Bộ nguồn đề xuất tối thiểu là ${Math.ceil(safetyBuffer)}W nhưng nguồn hiện tại chỉ có ${psuWattage}W.`
        });
      }
    }

    // 5. Case & Motherboard size compatibility check
    if (MAINBOARD && CASE) {
      const mbSize = getMbSize(MAINBOARD);
      const caseSupport = getCaseSizeSupport(CASE);
      const sizeHierarchy = { 'MINI-ITX': 1, 'MICRO-ATX': 2, 'ATX': 3, 'E-ATX': 4 };
      const mbRank = sizeHierarchy[mbSize] || 3;
      const caseRank = sizeHierarchy[caseSupport] || 3;
      
      if (mbRank > caseRank) {
        newWarnings.push({
          level: 'error',
          text: `Không tương thích kích thước: Bo mạch chủ chuẩn [${mbSize}] quá to so với Vỏ máy tính chỉ hỗ trợ tối đa [${caseSupport}].`
        });
      }
    }

    // 6. Cooler & CPU Socket compatibility check
    if (CPU && COOLER) {
      const cpuSocket = getSocket(CPU);
      const coolerSockets = COOLER.specs?.socket_support || [];
      if (cpuSocket && coolerSockets.length > 0) {
        const isSupported = coolerSockets.some(s => s.toLowerCase() === cpuSocket.toLowerCase());
        if (!isSupported) {
          newWarnings.push({
            level: 'warning',
            text: `Socket tản nhiệt: Tản nhiệt này không ghi nhận hỗ trợ socket [${cpuSocket}] của CPU.`
          });
        }
      }
    }

    setWarnings(newWarnings);
  }, [selectedParts]);

  const selectPart = (slotId, product) => {
    setSelectedParts(prev => ({ ...prev, [slotId]: product }));
    setActiveSlot(null);
    setModalSearch('');
    setModalBrandFilter('all');
    setModalSortOrder('default');
  };

  const removePart = (slotId) => {
    setSelectedParts(prev => ({ ...prev, [slotId]: null }));
  };

  const calculateTotalPrice = () => {
    return Object.values(selectedParts).reduce((sum, item) => sum + (item ? (parseFloat(item.price) || 0) : 0), 0);
  };

  const formatPrice = (price) => {
    const num = parseFloat(price) || 0;
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);
  };

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

  const getSpecLabel = (key) => {
    const normalized = String(key).toLowerCase().trim();
    return SPEC_LABEL_MAP[normalized] || (key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '));
  };


  const getEstimatedTdp = () => {
    let totalTdp = 100; // Base system wattage
    const { CPU, VGA } = selectedParts;
    if (CPU) totalTdp += getCpuTdp(CPU);
    if (VGA) totalTdp += getVgaTdp(VGA);
    return totalTdp;
  };

  const getPsuWattage = () => {
    const { PSU } = selectedParts;
    return getPsuWattageHelper(PSU);
  };

  const handleCopyBuild = () => {
    const list = Object.entries(selectedParts)
      .filter(([_, item]) => item !== null)
      .map(([slotId, item]) => `- ${COMPONENT_SLOTS.find(s => s.id === slotId)?.label}: ${item.name} (${formatPrice(item.price)})`)
      .join('\n');
    
    if (!list) {
      alert('Vui lòng chọn ít nhất một linh kiện trước khi sao chép!');
      return;
    }

    const text = `CẤU HÌNH PC - AETHERPC\n---------------------\n${list}\n---------------------\nTỔNG CỘNG: ${formatPrice(calculateTotalPrice())}\nLink build: ${window.location.href}`;
    navigator.clipboard.writeText(text);
    alert('Đã sao chép cấu hình máy tính vào clipboard thành công!');
  };

  const handlePrintBuild = () => {
    window.print();
  };

  const addWholeBuildToCart = () => {
    Object.values(selectedParts).forEach(item => {
      if (item) {
        addToCart(item, 1, { pc_build_bundle: 'custom_pc' });
      }
    });
    alert('Đã thêm toàn bộ linh kiện của cấu hình vào giỏ hàng thành công!');
  };

  // Dynamic AI PC Build selector based on client needs & Knowledge Base Engine
  const generateAIBuild = (usage, budgetLimit, brandPref, customPrompt = '') => {
    setIsAnalyzingAI(true);
    setTimeout(() => {
      const activeProducts = products.length > 0 ? products : FALLBACK_PRODUCTS;
      const result = runAIOptimizer({
        promptText: customPrompt || customPromptText,
        budgetInput: budgetLimit || aiBudget,
        workloadInput: usage || aiUsage,
        brandInput: brandPref || aiBrand,
        gpuBrandInput: aiGpuBrand,
        mfgBrandInput: aiMfgBrand,
        availableProducts: activeProducts
      });

      if (result && result.build) {
        setSelectedParts(result.build);
        setAiReport(result);
      }
      setIsAnalyzingAI(false);
    }, 350);
  };

  const availableBrands = activeSlot ? [...new Set(products.filter(p => p.category.toUpperCase() === activeSlot).map(p => p.brand))].filter(Boolean) : [];

  const filteredModalProducts = products.map(p => {
    if (p.category.toUpperCase() !== activeSlot) return null;

    const matchSearch = p.name.toLowerCase().includes(modalSearch.toLowerCase()) ||
                        p.brand.toLowerCase().includes(modalSearch.toLowerCase());
    const matchBrand = modalBrandFilter === 'all' || p.brand === modalBrandFilter;
    if (!matchSearch || !matchBrand) return null;

    const { CPU, MAINBOARD, RAM } = selectedParts;
    let isCompatible = true;
    let compatReason = '';

    if (activeSlot === 'CPU') {
      if (MAINBOARD) {
        const pSocket = getSocket(p);
        const mbSocket = getSocket(MAINBOARD);
        if (pSocket && mbSocket && pSocket !== mbSocket) {
          isCompatible = false;
        } else if (pSocket) {
          compatReason = `Socket ${pSocket} khớp Bo mạch chủ`;
        }
      }
    } else if (activeSlot === 'MAINBOARD') {
      if (CPU) {
        const pSocket = getSocket(p);
        const cpuSocket = getSocket(CPU);
        if (pSocket && cpuSocket && pSocket !== cpuSocket) {
          isCompatible = false;
        } else if (pSocket) {
          compatReason = `Socket ${pSocket} chuẩn CPU`;
        }
      }
      if (RAM) {
        const pRamType = getRamType(p);
        const ramType = getRamType(RAM);
        if (pRamType && ramType && pRamType !== ramType) {
          isCompatible = false;
        } else if (pRamType) {
          compatReason += ` (Chuẩn RAM ${pRamType})`;
        }
      }
    } else if (activeSlot === 'RAM') {
      if (getRamFormFactor(p) === 'SODIMM') {
        isCompatible = false;
      } else if (MAINBOARD) {
        const pRamType = getRamType(p);
        const mbRamType = getRamType(MAINBOARD);
        if (pRamType && mbRamType && pRamType !== mbRamType) {
          isCompatible = false;
        } else if (pRamType) {
          compatReason = `RAM ${pRamType} chuẩn chân cắm Desktop`;
        }
      }
    } else if (activeSlot === 'PSU') {
      const estTdp = getEstimatedTdp();
      const psuWatts = getPsuWattageHelper(p);
      const reqWatts = Math.ceil(estTdp * 1.25);
      if (psuWatts > 0 && psuWatts >= reqWatts) {
        compatReason = `Nguồn ${psuWatts}W đạt 25% dư tải an toàn`;
      } else if (psuWatts > 0 && psuWatts < estTdp) {
        isCompatible = false;
      }
    } else if (activeSlot === 'COOLER') {
      if (CPU) {
        const cpuSock = getSocket(CPU).toLowerCase();
        const support = p.specs?.socket_support || [];
        if (Array.isArray(support) && support.length > 0 && cpuSock) {
          if (!support.some(s => s.toLowerCase() === cpuSock)) {
            isCompatible = false;
          } else {
            compatReason = `Hỗ trợ chân cắm ${getSocket(CPU)}`;
          }
        }
      }
    }

    if (onlyCompatible && !isCompatible) return null;
    return { ...p, isCompatible, compatReason };
  }).filter(Boolean).sort((a, b) => {
    if (a.isCompatible !== b.isCompatible) {
      return a.isCompatible ? -1 : 1; // Đưa linh kiện tương thích lên đầu!
    }
    if (modalSortOrder === 'price-asc') return a.price - b.price;
    if (modalSortOrder === 'price-desc') return b.price - a.price;
    return 0;
  });

  return (
    <div className="container" style={{ padding: '2rem 1.5rem 4rem 1.5rem' }}>
      <style>{`
        .print-only-layout {
          display: none;
        }
        @media print {
          header, footer, .chat-bot, #chat-bot, [class*="Header"], [class*="Footer"], [class*="Chatbot"] {
            display: none !important;
          }
          .pc-builder-screen-layout {
            display: none !important;
          }
          .print-only-layout {
            display: block !important;
            background: #fff !important;
            color: #000 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
        }
      `}</style>

      <div className="pc-builder-screen-layout">
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <h1 style={{
            fontSize: '2.5rem',
            fontFamily: 'var(--font-title)',
            color: '#0f172a',
            fontWeight: 800,
            marginBottom: '0.5rem'
          }}>
            Trình Tự Chọn Lắp Ráp PC Thông Minh
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Hệ thống sẽ tự động đối chiếu thông số socket, loại RAM và công suất nguồn để đưa ra các gợi ý tương thích.
          </p>

          <button
            onClick={() => setShowGuide(!showGuide)}
            style={{
              padding: '0.5rem 1.25rem',
              fontSize: '0.85rem',
              fontWeight: 700,
              borderRadius: '99px',
              border: '1px solid #bfdbfe',
              backgroundColor: showGuide ? '#2563eb' : '#eff6ff',
              color: showGuide ? '#ffffff' : '#2563eb',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: '0 4px 12px rgba(37,99,235,0.12)',
              transition: 'all 0.2s'
            }}
          >
            <HelpCircle size={16} />
            <span>{showGuide ? '✕ Đóng Cẩm Nang Build PC' : '💡 Cẩm Nang Chọn Linh Kiện PC Siêu Chi Tiết (Click để xem)'}</span>
          </button>
        </div>

      {/* AI Custom Suggestions based on user needs & Knowledge Engine */}
      <div className="card-glass" style={{ marginBottom: '2rem', padding: '1.5rem', borderRadius: '18px', border: '1.5px solid #bfdbfe', backgroundColor: '#ffffff', boxShadow: '0 8px 30px rgba(37,99,235,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#2563eb' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={20} color="#2563eb" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Trợ lý Cấu hình PC AI Thông Minh</h3>
              <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0.15rem 0 0 0' }}>Tự động phân tích nhu cầu tự do hoặc chọn tiêu chí có sẵn từ kho 1.580 linh kiện PC</p>
            </div>
          </div>
          <span style={{ fontSize: '0.72rem', fontWeight: 800, backgroundColor: '#eff6ff', color: '#2563eb', padding: '0.3rem 0.75rem', borderRadius: '20px', border: '1px solid #bfdbfe' }}>
            ⚡ Bộ Trí Thức AI v2.5
          </span>
        </div>

        {/* Custom Natural Language Prompt Input */}
        <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '14px', border: '1px solid #e2e8f0', marginBottom: '1.25rem' }}>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.4rem' }}>
            💬 Nhập yêu cầu cụ thể của bạn (AI tự động trích xuất Ngân sách, Nhu cầu & Tối ưu hóa linh kiện):
          </label>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.6rem' }}>
            <input
              type="text"
              value={customPromptText}
              onChange={e => setCustomPromptText(e.target.value)}
              placeholder="Ví dụ: Build PC 22 triệu chơi mượt Valorant 240fps & edit video 4K TikTok, tông màu trắng..."
              style={{
                flex: 1, padding: '0.65rem 0.85rem', borderRadius: '10px',
                border: '1.5px solid #cbd5e1', fontSize: '0.85rem', color: '#0f172a',
                backgroundColor: '#ffffff', outline: 'none', boxSizing: 'border-box'
              }}
            />
            <button
              onClick={() => generateAIBuild(aiUsage, aiBudget, aiBrand, customPromptText)}
              disabled={isAnalyzingAI}
              style={{
                padding: '0.65rem 1.4rem', borderRadius: '10px', border: 'none',
                background: 'linear-gradient(135deg, #2563eb, #6366f1)',
                color: '#ffffff', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap',
                boxShadow: '0 4px 12px rgba(37,99,235,0.2)'
              }}
            >
              <Sparkles size={16} />
              {isAnalyzingAI ? 'AI Đang Phân Tích...' : 'AI Phân Tích & Tối Ưu'}
            </button>
          </div>

          {/* Quick Sample Prompts */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700 }}>Gợi ý nhanh:</span>
            {[
              "PC 20 triệu chơi mượt CS2 & Valorant 240Hz",
              "PC 35 triệu làm đồ họa 3D Blender & Unreal 5",
              "PC 40 triệu chạy AI Llama & Deep Learning VRAM 16GB",
              "PC 18 triệu học tập & giải trí"
            ].map((sample, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setCustomPromptText(sample);
                  generateAIBuild(aiUsage, aiBudget, aiBrand, sample);
                }}
                style={{
                  padding: '0.25rem 0.65rem', borderRadius: '20px',
                  border: '1px solid #bfdbfe', backgroundColor: '#eff6ff',
                  color: '#2563eb', fontSize: '0.72rem', fontWeight: 600,
                  cursor: 'pointer', transition: 'all 0.15s'
                }}
              >
                ✨ {sample}
              </button>
            ))}
          </div>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Row 1: Nhu cầu linh hoạt */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 700, minWidth: '120px', color: '#334155' }}>Nhu cầu sử dụng:</span>
            <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
              {[
                { key: 'gaming', label: '🎮 Chơi Game & E-Sports' },
                { key: 'graphics', label: '🎨 Đồ họa 3D & Render' },
                { key: 'ai', label: '💻 Lập trình & AI' },
                { key: 'STREAMING', label: '🎥 Livestream & Creator' },
                { key: 'EMULATOR', label: '📱 Giả lập Multi-Nox' },
                { key: 'office', label: '💼 Văn phòng & Học tập' }
              ].map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setAiUsage(opt.key)}
                  style={{
                    padding: '0.4rem 0.85rem',
                    fontSize: '0.8125rem',
                    borderRadius: '10px',
                    border: `1.5px solid ${aiUsage === opt.key ? '#2563eb' : '#e2e8f0'}`,
                    backgroundColor: aiUsage === opt.key ? '#eff6ff' : '#ffffff',
                    color: aiUsage === opt.key ? '#2563eb' : '#334155',
                    fontWeight: aiUsage === opt.key ? 800 : 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Row 2: Ngân sách Siêu Linh Hoạt (Chips + Range Slider + Custom Input Box) */}
          <div style={{ backgroundColor: '#f8fafc', padding: '0.85rem 1rem', borderRadius: '14px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                💰 Ngân sách ước tính:
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.95rem', fontWeight: 900, color: '#2563eb', backgroundColor: '#eff6ff', padding: '0.2rem 0.75rem', borderRadius: '20px', border: '1px solid #bfdbfe' }}>
                  {(aiBudget / 1000000).toLocaleString('vi-VN')} Triệu VNĐ
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem', color: '#64748b', fontWeight: 700 }}>
                  (Nhập số: 
                  <input
                    type="number"
                    min="5"
                    max="100"
                    step="0.5"
                    value={aiBudget / 1000000}
                    onChange={e => {
                      const v = parseFloat(e.target.value);
                      if (!isNaN(v) && v > 0) setAiBudget(v * 1000000);
                    }}
                    style={{
                      width: '60px', padding: '0.25rem 0.4rem', borderRadius: '6px',
                      border: '1.5px solid #cbd5e1', fontSize: '0.82rem', fontWeight: 800,
                      color: '#0f172a', textAlign: 'center', outline: 'none'
                    }}
                  /> Triệu)
                </div>
              </div>
            </div>

            {/* Range Slider Control */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700 }}>5 Tr</span>
              <input
                type="range"
                min="5000000"
                max="100000000"
                step="500000"
                value={aiBudget}
                onChange={e => setAiBudget(Number(e.target.value))}
                style={{ flex: 1, accentColor: '#2563eb', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700 }}>100 Tr</span>
            </div>

            {/* Quick Preset Budget Chips */}
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700 }}>Mốc nhanh:</span>
              {[
                { val: 10000000, label: '10 Tr' },
                { val: 15000000, label: '15 Tr' },
                { val: 20000000, label: '20 Tr' },
                { val: 25000000, label: '25 Tr' },
                { val: 35000000, label: '35 Tr' },
                { val: 50000000, label: '50 Tr' },
                { val: 70000000, label: '70 Tr' },
                { val: 100000000, label: '100 Tr' }
              ].map(opt => (
                <button
                  key={opt.val}
                  onClick={() => setAiBudget(opt.val)}
                  style={{
                    padding: '0.2rem 0.6rem',
                    fontSize: '0.75rem',
                    borderRadius: '8px',
                    border: `1px solid ${aiBudget === opt.val ? '#2563eb' : '#cbd5e1'}`,
                    backgroundColor: aiBudget === opt.val ? '#2563eb' : '#ffffff',
                    color: aiBudget === opt.val ? '#ffffff' : '#334155',
                    fontWeight: aiBudget === opt.val ? 800 : 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Row 3: Hãng CPU & GPU Linh Hoạt */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>Thương hiệu CPU:</span>
              <div style={{ display: 'flex', gap: '0.35rem' }}>
                {[
                  { key: 'all', label: 'Tùy chọn' },
                  { key: 'intel', label: 'Intel' },
                  { key: 'amd', label: 'AMD' }
                ].map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => setAiBrand(opt.key)}
                    style={{
                      padding: '0.3rem 0.7rem',
                      fontSize: '0.78rem',
                      borderRadius: '8px',
                      border: `1.5px solid ${aiBrand === opt.key ? '#2563eb' : '#cbd5e1'}`,
                      backgroundColor: aiBrand === opt.key ? '#eff6ff' : '#ffffff',
                      color: aiBrand === opt.key ? '#2563eb' : '#334155',
                      fontWeight: aiBrand === opt.key ? 800 : 600,
                      cursor: 'pointer'
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>Card Đồ Họa (GPU):</span>
              <div style={{ display: 'flex', gap: '0.35rem' }}>
                {[
                  { key: 'all', label: 'Tùy chọn' },
                  { key: 'nvidia', label: 'NVIDIA' },
                  { key: 'amd', label: 'Radeon' }
                ].map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => setAiGpuBrand(opt.key)}
                    style={{
                      padding: '0.3rem 0.7rem',
                      fontSize: '0.78rem',
                      borderRadius: '8px',
                      border: `1.5px solid ${aiGpuBrand === opt.key ? '#2563eb' : '#cbd5e1'}`,
                      backgroundColor: aiGpuBrand === opt.key ? '#eff6ff' : '#ffffff',
                      color: aiGpuBrand === opt.key ? '#2563eb' : '#334155',
                      fontWeight: aiGpuBrand === opt.key ? 800 : 600,
                      cursor: 'pointer'
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Row 4: Thương hiệu Hãng sản xuất (Hệ sinh thái Hãng) */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.6rem', marginTop: '0.25rem' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, minWidth: '120px', color: '#334155' }}>Hãng sản xuất yêu thích:</span>
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
              {[
                { key: 'all', label: 'Tất cả Hãng' },
                { key: 'ASUS', label: 'ASUS / ROG' },
                { key: 'MSI', label: 'MSI' },
                { key: 'GIGABYTE', label: 'GIGABYTE / AORUS' },
                { key: 'Corsair', label: 'Corsair' },
                { key: 'Kingston', label: 'Kingston' },
                { key: 'Deepcool', label: 'Deepcool' },
                { key: 'NZXT', label: 'NZXT' },
                { key: 'Samsung', label: 'Samsung' }
              ].map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setAiMfgBrand(opt.key)}
                  style={{
                    padding: '0.28rem 0.65rem',
                    fontSize: '0.78rem',
                    borderRadius: '8px',
                    border: `1.5px solid ${aiMfgBrand === opt.key ? '#2563eb' : '#cbd5e1'}`,
                    backgroundColor: aiMfgBrand === opt.key ? '#eff6ff' : '#ffffff',
                    color: aiMfgBrand === opt.key ? '#2563eb' : '#334155',
                    fontWeight: aiMfgBrand === opt.key ? 800 : 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Action Row */}
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => generateAIBuild(aiUsage, aiBudget, aiBrand, customPromptText)}
              disabled={isAnalyzingAI}
              className="btn btn-primary"
              style={{
                padding: '0.625rem 2rem',
                fontSize: '0.875rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: 'linear-gradient(135deg, var(--primary), #4f46e5)',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              <Sparkles size={16} />
              {isAnalyzingAI ? 'AI Đang Phân Tích...' : 'Gợi ý Cấu hình Tối ưu'}
            </button>
            
            <button
              onClick={() => {
                setSelectedParts({ CPU: null, MAINBOARD: null, RAM: null, VGA: null, PSU: null, STORAGE: null, CASE: null, COOLER: null });
                setAiReport(null);
              }}
              className="btn btn-secondary"
              style={{
                borderColor: 'rgba(239, 68, 68, 0.2)',
                color: 'var(--danger)',
                padding: '0.625rem 1.5rem',
                fontSize: '0.875rem',
                cursor: 'pointer'
              }}
            >
              Làm sạch cấu hình
            </button>

            <button
              onClick={() => setShowGuide(!showGuide)}
              className="btn btn-secondary"
              style={{
                borderColor: 'rgba(37, 99, 235, 0.3)',
                color: '#2563eb',
                backgroundColor: showGuide ? '#eff6ff' : '#ffffff',
                padding: '0.625rem 1.5rem',
                fontSize: '0.875rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginLeft: 'auto'
              }}
            >
              <HelpCircle size={16} />
              {showGuide ? 'Thu gọn hướng dẫn' : '📖 Hướng dẫn build PC cho người mới'}
            </button>
          </div>

          {/* AI Hardware Report Card */}
          {aiReport && (
            <div style={{ backgroundColor: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: '14px', padding: '1rem 1.25rem', marginTop: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#166534', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Sparkles size={18} color="#16a34a" /> Báo Cáo Phân Tích &amp; Tối Ưu Linh Kiện Từ AI AetherPC
                </div>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#15803d', backgroundColor: '#dcfce7', padding: '0.25rem 0.65rem', borderRadius: '20px', border: '1px solid #86efac' }}>
                  ✓ 100% Tương Thích Linh Kiện
                </div>
              </div>
              <p style={{ fontSize: '0.83rem', color: '#166534', margin: '0 0 0.6rem 0', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                {aiReport.aiExplanation}
              </p>
              <div style={{ display: 'flex', gap: '1.25rem', fontSize: '0.78rem', color: '#15803d', fontWeight: 700, flexWrap: 'wrap', borderTop: '1px solid #bbf7d0', paddingTop: '0.5rem' }}>
                <span>⚡ Điện năng tiêu thụ: <strong>~{aiReport.estimatedTdp}W</strong></span>
                <span>🔌 Nguồn khuyến nghị: <strong>{aiReport.requiredWatts}W+</strong></span>
                <span>💰 Tổng chi phí dàn PC: <strong style={{ color: '#dc2626' }}>{Number(aiReport.totalPrice).toLocaleString('vi-VN')} đ</strong></span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Super Detailed Beginner PC Building Masterclass Card Panel */}
      {showGuide && (
        <div className="card-glass" style={{ marginBottom: '2.5rem', padding: '2rem', border: '2px solid #2563eb', backgroundColor: '#ffffff', borderRadius: '20px', boxShadow: '0 10px 30px rgba(37,99,235,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #f1f5f9', paddingBottom: '1.25rem', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <div style={{ width: '46px', height: '46px', borderRadius: '14px', backgroundColor: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                <HelpCircle size={24} />
              </div>
              <div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: 0, fontFamily: 'var(--font-title)' }}>
                  📖 Cẩm Nang Hướng Dẫn Chọn Linh Kiện PC Chi Tiết Từ A - Z
                </h2>
                <p style={{ fontSize: '0.875rem', color: '#64748b', margin: '0.25rem 0 0 0' }}>
                  Dành cho người chưa từng build máy tính: Hiểu rõ vai trò 8 linh kiện cốt lõi & nguyên tắc phối ghép chuẩn 100%.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowGuide(false)}
              style={{
                padding: '0.4rem 0.85rem',
                fontSize: '0.8rem',
                fontWeight: 700,
                backgroundColor: '#fef2f2',
                color: '#dc2626',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              ✕ Đóng Hướng Dẫn
            </button>
          </div>

          {/* 8 Component Category Tabs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem', marginBottom: '1.5rem' }}>
            {[
              { id: 0, title: '1. CPU', icon: <Cpu size={15} />, color: '#2563eb', label: 'Bộ não' },
              { id: 1, title: '2. Mainboard', icon: <Layers size={15} />, color: '#16a34a', label: 'Mạch chủ' },
              { id: 2, title: '3. RAM', icon: <Database size={15} />, color: '#d97706', label: 'Bộ nhớ' },
              { id: 3, title: '4. Card VGA', icon: <Gamepad2 size={15} />, color: '#9333ea', label: 'Đồ họa 3D' },
              { id: 4, title: '5. SSD Storage', icon: <HardDrive size={15} />, color: '#0284c7', label: 'Lưu trữ' },
              { id: 5, title: '6. Nguồn PSU', icon: <Zap size={15} />, color: '#dc2626', label: 'Cấp điện' },
              { id: 6, title: '7. Tản nhiệt', icon: <Wind size={15} />, color: '#0891b2', label: 'Làm mát' },
              { id: 7, title: '8. Vỏ Case', icon: <Box size={15} />, color: '#4f46e5', label: 'Vỏ máy' }
            ].map(step => {
              const isActive = activeStepTab === step.id;
              return (
                <button
                  key={step.id}
                  onClick={() => setActiveStepTab(step.id)}
                  style={{
                    padding: '0.65rem 0.5rem',
                    borderRadius: '10px',
                    border: isActive ? `2px solid ${step.color}` : '1px solid #cbd5e1',
                    backgroundColor: isActive ? '#eff6ff' : '#ffffff',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}
                >
                  <div style={{ color: step.color }}>{step.icon}</div>
                  <strong style={{ fontSize: '0.8rem', color: isActive ? '#2563eb' : '#0f172a', fontWeight: 800 }}>{step.title}</strong>
                  <span style={{ fontSize: '0.7rem', color: '#64748b' }}>{step.label}</span>
                </button>
              );
            })}
          </div>

          {/* Masterclass Detail Panels */}
          <div style={{ padding: '1.5rem', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px' }}>
            {activeStepTab === 0 && (
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Cpu size={20} style={{ color: '#2563eb' }} />
                  1. Bộ Xử Lý (CPU) — "Bộ Não" Trung Tâm Quyết Định Tốc Độ Máy
                </h3>
                <p style={{ fontSize: '0.875rem', color: '#334155', lineHeight: 1.6, marginBottom: '1rem' }}>
                  CPU đảm nhận toàn bộ việc tính toán và điều hành các chương trình. Chọn đúng CPU giúp hệ thống chạy mượt mà mà không bị lãng phí ngân sách.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div style={{ padding: '1rem', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '10px' }}>
                    <h4 style={{ color: '#2563eb', fontSize: '0.9rem', fontWeight: 800, marginBottom: '0.5rem' }}>🔷 Phân loại CPU Intel Core:</h4>
                    <ul style={{ fontSize: '0.825rem', color: '#475569', paddingLeft: '1.1rem', lineHeight: 1.6, margin: 0 }}>
                      <li><strong>Core i3:</strong> Phù hợp văn phòng, lướt web, học tập, chơi game eSports nhẹ (LOL, Valorant).</li>
                      <li><strong>Core i5:</strong> 🌟 <em>Dòng CPU quốc dân</em> cân bằng nhất cho 90% nhu cầu chơi game mượt & đồ họa.</li>
                      <li><strong>Core i7 / i9:</strong> Dành cho Game thủ hardcore, thiết kế 3D phức tạp, Render 4K, Live Stream nặng.</li>
                    </ul>
                  </div>

                  <div style={{ padding: '1rem', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '10px' }}>
                    <h4 style={{ color: '#dc2626', fontSize: '0.9rem', fontWeight: 800, marginBottom: '0.5rem' }}>🔴 Phân loại CPU AMD Ryzen:</h4>
                    <ul style={{ fontSize: '0.825rem', color: '#475569', paddingLeft: '1.1rem', lineHeight: 1.6, margin: 0 }}>
                      <li><strong>Ryzen 5:</strong> Hiệu năng cực cao trên giá thành, đa nhiệm mượt và tiết kiệm điện năng.</li>
                      <li><strong>Ryzen 7 / 9:</strong> Bá chủ xử lý đa nhân, tối ưu cho lập trình, AI và dựng hình đồ họa nặng.</li>
                    </ul>
                  </div>
                </div>
                <div style={{ padding: '0.75rem 1rem', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', color: '#1e40af', fontSize: '0.825rem', fontWeight: 600 }}>
                  💡 Quy tắc khớp Socket: CPU Intel thế hệ 12/13/14 dùng Socket <strong>LGA1700</strong>, CPU Intel Core Ultra thế hệ mới dùng <strong>LGA1851</strong>, CPU AMD Ryzen 7000/9000 dùng <strong>AM5</strong>.
                </div>
              </div>
            )}

            {activeStepTab === 1 && (
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Layers size={20} style={{ color: '#16a34a' }} />
                  2. Bo Mạch Chủ (Mainboard) — Khung Xương Kết Nối Linh Kiện
                </h3>
                <p style={{ fontSize: '0.875rem', color: '#334155', lineHeight: 1.6, marginBottom: '1rem' }}>
                  Mainboard kết nối CPU, RAM, VGA và SSD lại với nhau. Chọn đúng dòng Mainboard giúp các linh kiện phát huy tối đa sức mạnh.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.85rem', marginBottom: '1rem' }}>
                  <div style={{ padding: '0.85rem', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '10px' }}>
                    <strong style={{ color: '#0f172a', fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>📌 Dòng H / A (Ví dụ: H610, A520)</strong>
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Phù hợp CPU Core i3/i5 phổ thông. Giá rẻ, đủ các cổng kết nối cơ bản.</span>
                  </div>
                  <div style={{ padding: '0.85rem', backgroundColor: '#ffffff', border: '2px solid #16a34a', borderRadius: '10px' }}>
                    <strong style={{ color: '#16a34a', fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>🌟 Dòng B (Ví dụ: B760, B650)</strong>
                    <span style={{ fontSize: '0.8rem', color: '#334155', fontWeight: 600 }}>Tốt nhất cho 80% người dùng. Tản nhiệt VRM ngon, hỗ trợ cắm nhiều SSD & RAM tốc độ cao.</span>
                  </div>
                  <div style={{ padding: '0.85rem', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '10px' }}>
                    <strong style={{ color: '#0f172a', fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>🔥 Dòng Z / X (Ví dụ: Z790, X670)</strong>
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Dành cho dàn máy cao cấp, hỗ trợ Ép Xung (Overclocking) các CPU dòng K.</span>
                  </div>
                </div>
              </div>
            )}

            {activeStepTab === 2 && (
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Database size={20} style={{ color: '#d97706' }} />
                  3. Bộ Nhớ RAM — Chạy Đa Nhiệm Mượt Mà Không Giật Lag
                </h3>
                <p style={{ fontSize: '0.875rem', color: '#334155', lineHeight: 1.6, marginBottom: '1rem' }}>
                  RAM chứa dữ liệu tạm thời khi bạn mở ứng dụng hay game. RAM càng lớn, bạn càng mở được nhiều tab trình duyệt và phần mềm song song.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.85rem' }}>
                  <div style={{ padding: '0.85rem', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '10px' }}>
                    <strong style={{ color: '#d97706', fontSize: '0.85rem', display: 'block' }}>💻 16GB RAM (2x8GB)</strong>
                    <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Mức chuẩn tối thiểu cho mọi dàn PC chơi game mượt ở thời điểm hiện tại.</span>
                  </div>
                  <div style={{ padding: '0.85rem', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '10px' }}>
                    <strong style={{ color: '#16a34a', fontSize: '0.85rem', display: 'block' }}>🚀 32GB RAM (2x16GB)</strong>
                    <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Khuyên dùng cho game thủ đồ họa 2K/4K, Photoshop, Premiere, AutoCAD.</span>
                  </div>
                  <div style={{ padding: '0.85rem', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '10px' }}>
                    <strong style={{ color: '#2563eb', fontSize: '0.85rem', display: 'block' }}>⚡ DDR4 vs DDR5</strong>
                    <span style={{ fontSize: '0.78rem', color: '#64748b' }}>DDR5 nhanh hơn 40% nhưng bắt buộc phải cắm trên Mainboard hỗ trợ chuẩn DDR5.</span>
                  </div>
                </div>
              </div>
            )}

            {activeStepTab === 3 && (
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Gamepad2 size={20} style={{ color: '#9333ea' }} />
                  4. Card Đồ Họa (VGA) — Linh Kiện Quyết Định FPS Game 3D
                </h3>
                <p style={{ fontSize: '0.875rem', color: '#334155', lineHeight: 1.6, marginBottom: '1rem' }}>
                  VGA xử lý toàn bộ hình ảnh 3D, hiệu ứng ánh sáng Ray Tracing và xuất hình ra màn hình.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.85rem' }}>
                  <div style={{ padding: '0.85rem', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '10px' }}>
                    <strong style={{ color: '#9333ea', fontSize: '0.85rem', display: 'block' }}>🎮 Game Full HD (1080p)</strong>
                    <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Chọn <strong>NVIDIA RTX 4060 8GB</strong> hoặc <strong>RTX 3060</strong>.</span>
                  </div>
                  <div style={{ padding: '0.85rem', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '10px' }}>
                    <strong style={{ color: '#2563eb', fontSize: '0.85rem', display: 'block' }}>🎮 Game 2K & Đồ Họa 3D</strong>
                    <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Chọn <strong>NVIDIA RTX 4070 Super 12GB</strong>.</span>
                  </div>
                  <div style={{ padding: '0.85rem', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '10px' }}>
                    <strong style={{ color: '#dc2626', fontSize: '0.85rem', display: 'block' }}>🔥 Game 4K & AI Trí Tuệ Nhân Tạo</strong>
                    <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Chọn <strong>NVIDIA RTX 4080 / RTX 4090</strong>.</span>
                  </div>
                </div>
              </div>
            )}

            {activeStepTab === 4 && (
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <HardDrive size={20} style={{ color: '#0284c7' }} />
                  5. Ổ Cứng Lưu Trữ (SSD NVMe) — Tốc Độ Mở Windows & Ứng Dụng
                </h3>
                <p style={{ fontSize: '0.875rem', color: '#334155', lineHeight: 1.6, marginBottom: '0.75rem' }}>
                  Ổ cứng lưu trữ hệ điều hành Windows, dữ liệu cá nhân và ứng dụng game. Nên dùng chuẩn <strong>SSD M.2 NVMe PCIe Gen 4</strong> với tốc độ đọc ghi từ 3500MB/s - 7000MB/s (gấp 15 lần ổ HDD cũ).
                </p>
                <div style={{ padding: '0.75rem 1rem', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.825rem', color: '#334155' }}>
                  <strong>Khuyên dùng dung lượng:</strong> Chọn tối thiểu <strong>512GB SSD</strong> cho nhu cầu cơ bản. Nếu tải nhiều game AAA nặng (mỗi game 50GB-100GB), nên chọn ổ <strong>1TB SSD NVMe</strong>.
                </div>
              </div>
            )}

            {activeStepTab === 5 && (
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Zap size={20} style={{ color: '#dc2626' }} />
                  6. Nguồn Máy Tính (PSU) — Trái Tim Cấp Điện An Toàn Cho Hệ Thống
                </h3>
                <p style={{ fontSize: '0.875rem', color: '#334155', lineHeight: 1.6, marginBottom: '1rem' }}>
                  Nguồn điện chuyển đổi dòng điện sinh hoạt thành điện áp một chiều nuôi linh kiện. Nguồn tốt đảm bảo máy chạy bền bỉ 10 năm mà không lo sụt áp hay chập cháy.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', fontSize: '0.8rem' }}>
                  <div style={{ padding: '0.75rem', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px' }}>
                    <strong style={{ color: '#2563eb', display: 'block' }}>⚡ 550W - 650W Bronze:</strong>
                    <span>Cho CPU i3/i5 + VGA RTX 3050 / 4060.</span>
                  </div>
                  <div style={{ padding: '0.75rem', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px' }}>
                    <strong style={{ color: '#16a34a', display: 'block' }}>⚡ 750W 80 Plus Gold:</strong>
                    <span>Cho CPU i7 + VGA RTX 4070 Super.</span>
                  </div>
                  <div style={{ padding: '0.75rem', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px' }}>
                    <strong style={{ color: '#dc2626', display: 'block' }}>⚡ 850W - 1000W Gold/Platinum:</strong>
                    <span>Cho CPU i9 + VGA RTX 4080 / 4090.</span>
                  </div>
                </div>
              </div>
            )}

            {activeStepTab === 6 && (
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Wind size={20} style={{ color: '#0891b2' }} />
                  7. Tản Nhiệt CPU (Cooler) — Giữ Máy Mát Mẻ Dưới 70°C
                </h3>
                <p style={{ fontSize: '0.875rem', color: '#334155', lineHeight: 1.6, marginBottom: '1rem' }}>
                  Tản nhiệt giúp giải tỏa sức nóng tỏa ra từ CPU. CPU mát mẻ giúp máy chạy tối đa hiệu năng không bị giảm xung giật giật.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', fontSize: '0.825rem' }}>
                  <div style={{ padding: '0.85rem', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '10px' }}>
                    <strong style={{ color: '#0891b2', display: 'block', marginBottom: '4px' }}>❄️ Tản Nhiệt Khí (Air Cooling):</strong>
                    <span style={{ color: '#64748b' }}>Giá từ 300k - 900k, lắp đặt bền bỉ không lo hỏng hóc. Rất tốt cho CPU Core i3, i5 và Ryzen 5.</span>
                  </div>
                  <div style={{ padding: '0.85rem', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '10px' }}>
                    <strong style={{ color: '#2563eb', display: 'block', marginBottom: '4px' }}>🌊 Tản Nhiệt Nước AIO (Liquid Cooling):</strong>
                    <span style={{ color: '#64748b' }}>Giá từ 1.2tr - 3tr, thẩm mỹ RGB cực đẹp, làm mát cực nhanh cho các CPU tỏa nhiều nhiệt như i7 / i9 dòng K.</span>
                  </div>
                </div>
              </div>
            )}

            {activeStepTab === 7 && (
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Box size={20} style={{ color: '#4f46e5' }} />
                  8. Vỏ Máy Tính (Case) — Bộ Giáp & Thẩm Mỹ Góc Làm Việc
                </h3>
                <p style={{ fontSize: '0.875rem', color: '#334155', lineHeight: 1.6, marginBottom: '0.75rem' }}>
                  Vỏ máy bảo vệ linh kiện khỏi bụi bẩn, va đập và hỗ trợ luồng gió tản nhiệt.
                </p>
                <div style={{ padding: '0.75rem 1rem', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.825rem', color: '#334155' }}>
                  <strong>Kinh nghiệm chọn Case:</strong> Ưu tiên vỏ Case có mặt trước <strong>Lưới (Mesh)</strong> giúp hút gió mát tốt hơn mặt kính kín. Đảm bảo chuẩn kích thước Case hỗ trợ vừa Mainboard (ATX hay Micro-ATX) của bạn.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: '3fr 2fr',
        gap: '2rem',
        alignItems: 'start'
      }}>
        {/* Main List of Slots */}
        <div className="card-glass" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {COMPONENT_SLOTS.map((slot) => {
              const selectedItem = selectedParts[slot.id];
              return (
                <div key={slot.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '1rem',
                  border: selectedItem ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                  borderRadius: '12px',
                  backgroundColor: selectedItem ? '#f0fdf4' : '#ffffff',
                  transition: 'all 0.2s'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{
                      width: '46px',
                      height: '46px',
                      borderRadius: '8px',
                      backgroundColor: selectedItem ? '#fff' : '#f1f5f9',
                      border: selectedItem ? '1px solid #e2e8f0' : '1px solid #e2e8f0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#64748b',
                      overflow: 'hidden',
                      flexShrink: 0
                    }}>
                      {selectedItem ? (
                        <img 
                          src={selectedItem.image || `https://placehold.co/50x50/1e263d/94a3b8?text=${slot.id}`} 
                          alt="" 
                          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', padding: '2px' }}
                          onError={(e) => { e.target.src = `https://placehold.co/50x50/f1f5f9/64748b?text=${slot.id}`; }}
                        />
                      ) : (
                        slot.icon
                      )}
                    </div>
                    <div>
                      <h4 style={{ fontSize: '0.8125rem', color: '#64748b' }}>{slot.label}</h4>
                      {selectedItem ? (
                        <p style={{ fontSize: '0.95rem', fontWeight: 600, color: '#0f172a', marginTop: '0.125rem' }}>
                          <Link 
                            to={`/product/${selectedItem.id}`} 
                            target="_blank"
                            style={{ color: '#0f172a', textDecoration: 'none' }}
                            onMouseEnter={e => e.currentTarget.style.color = '#2563eb'}
                            onMouseLeave={e => e.currentTarget.style.color = '#0f172a'}
                          >
                            {selectedItem.name}
                          </Link> <span style={{ color: '#64748b', fontSize: '0.8rem' }}>({selectedItem.brand})</span>
                        </p>
                      ) : (
                        <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginTop: '0.125rem' }}>Chưa chọn linh kiện</p>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    {selectedItem && (
                      <span style={{ fontSize: '1rem', fontWeight: 'bold', color: '#dc2626' }}>
                        {formatPrice(selectedItem.price)}
                      </span>
                    )}

                    {selectedItem ? (
                      <button onClick={() => removePart(slot.id)} style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--danger)',
                        cursor: 'pointer',
                        padding: '0.5rem',
                        display: 'flex',
                        alignItems: 'center'
                      }} title="Gỡ linh kiện">
                        <Trash2 size={16} />
                      </button>
                    ) : (
                      <button onClick={() => setActiveSlot(slot.id)} className="btn btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.75rem' }}>
                        Chọn linh kiện
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Compatibility and Action Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', position: 'sticky', top: '100px' }}>
          {/* Compatibility Checks */}
          <div className="card-glass" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem' }}>
              {warnings.length === 0 ? (
                <ShieldCheck size={20} style={{ color: 'var(--success)' }} />
              ) : (
                <ShieldAlert size={20} style={{ color: 'var(--warning)' }} />
              )}
              <h3 style={{ fontSize: '1.1rem' }}>Bộ tương thích linh kiện</h3>
            </div>

            {warnings.length === 0 ? (
              <div style={{
                color: 'var(--success)',
                fontSize: '0.875rem',
                backgroundColor: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                borderRadius: 'var(--radius-md)',
                padding: '0.75rem 1rem'
              }}>
                ✓ Tất cả linh kiện được chọn hiện tại hoàn toàn tương thích với nhau! Bạn có thể yên tâm đặt hàng.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {warnings.map((warn, i) => (
                  <div key={i} style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.5rem',
                    color: warn.level === 'error' ? 'var(--danger)' : 'var(--warning)',
                    fontSize: '0.8125rem',
                    backgroundColor: warn.level === 'error' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                    border: warn.level === 'error' ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(245, 158, 11, 0.2)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.75rem 1rem',
                    lineHeight: '1.4'
                  }}>
                    {warn.level === 'error' ? <XCircle size={15} style={{ flexShrink: 0, marginTop: '2px' }} /> : <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: '2px' }} />}
                    <span>{warn.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* TDP Wattage Estimation */}
          {(() => {
            const estTdp = getEstimatedTdp();
            const psuWatts = getPsuWattage();
            const percent = psuWatts > 0 ? Math.min(100, Math.round((estTdp / psuWatts) * 100)) : 0;
            const isOverloaded = psuWatts > 0 && estTdp > psuWatts * 0.9;
            
            return (
              <div className="card-glass" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
                <h4 style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                  Điện năng tiêu thụ
                </h4>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.375rem' }}>
                  <span>Công suất ước tính:</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{estTdp}W</strong>
                </div>
                {psuWatts > 0 ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                      <span>Nguồn đang chọn:</span>
                      <strong style={{ color: isOverloaded ? 'var(--danger)' : 'var(--success)' }}>{psuWatts}W ({percent}% tải)</strong>
                    </div>
                    <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '99px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${percent}%`, background: isOverloaded ? 'var(--danger)' : 'var(--primary)', borderRadius: '99px', transition: 'width 0.3s ease' }} />
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                    Chưa chọn bộ nguồn (PSU). Khuyên dùng nguồn tối thiểu: <strong style={{ color: 'var(--warning)' }}>{Math.ceil(estTdp * 1.25)}W</strong>.
                  </div>
                )}
              </div>
            );
          })()}

          {/* Detailed System Specifications Monitor */}
          <div className="card-glass" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem' }}>
              <Layers size={18} style={{ color: 'var(--primary)' }} />
              <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Thông số cấu hình theo dõi</h3>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #e2e8f0', paddingBottom: '0.375rem' }}>
                <span style={{ color: '#64748b' }}>Socket CPU:</span>
                <span style={{ fontWeight: 700, color: selectedParts.CPU ? '#0f172a' : '#94a3b8' }}>
                  {selectedParts.CPU ? (getSocket(selectedParts.CPU) || 'Đang phân tích...') : 'Chưa chọn'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #e2e8f0', paddingBottom: '0.375rem' }}>
                <span style={{ color: '#64748b' }}>Socket Bo mạch chủ:</span>
                <span style={{ fontWeight: 700, color: selectedParts.MAINBOARD ? '#0f172a' : '#94a3b8' }}>
                  {selectedParts.MAINBOARD ? (getSocket(selectedParts.MAINBOARD) || 'Đang phân tích...') : 'Chưa chọn'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #e2e8f0', paddingBottom: '0.375rem' }}>
                <span style={{ color: '#64748b' }}>RAM hỗ trợ (Mainboard):</span>
                <span style={{ fontWeight: 700, color: selectedParts.MAINBOARD ? '#0f172a' : '#94a3b8' }}>
                  {selectedParts.MAINBOARD ? (getRamType(selectedParts.MAINBOARD) || 'Đang phân tích...') : 'Chưa chọn'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #e2e8f0', paddingBottom: '0.375rem' }}>
                <span style={{ color: '#64748b' }}>RAM đang chọn:</span>
                <span style={{ fontWeight: 700, color: selectedParts.RAM ? '#0f172a' : '#94a3b8' }}>
                  {selectedParts.RAM ? `${getRamType(selectedParts.RAM) || 'N/A'} (${getRamFormFactor(selectedParts.RAM) === 'SODIMM' ? 'Laptop' : 'Desktop'})` : 'Chưa chọn'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #e2e8f0', paddingBottom: '0.375rem' }}>
                <span style={{ color: '#64748b' }}>Kích thước Bo mạch chủ:</span>
                <span style={{ fontWeight: 700, color: selectedParts.MAINBOARD ? '#0f172a' : '#94a3b8' }}>
                  {selectedParts.MAINBOARD ? (getMbSize(selectedParts.MAINBOARD) || 'N/A') : 'Chưa chọn'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #e2e8f0', paddingBottom: '0.375rem' }}>
                <span style={{ color: '#64748b' }}>Kích thước Case hỗ trợ:</span>
                <span style={{ fontWeight: 700, color: selectedParts.CASE ? '#0f172a' : '#94a3b8' }}>
                  {selectedParts.CASE ? (getCaseSizeSupport(selectedParts.CASE) || 'N/A') : 'Chưa chọn'}
                </span>
              </div>
            </div>
          </div>

          {/* Pricing & Add to Cart summary */}
          <div className="card-glass" style={{ padding: '1.5rem', borderLeft: '4px solid var(--primary)' }}>
            <h3 style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
              Tổng kết cấu hình PC
            </h3>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--success)', marginBottom: '1.25rem' }}>
              {formatPrice(calculateTotalPrice())}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <button
                onClick={handleCopyBuild}
                className="btn btn-secondary"
                style={{ fontSize: '0.8rem', padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
                disabled={Object.values(selectedParts).every(item => !item)}
              >
                <Copy size={13} /> Sao chép văn bản
              </button>
              <button
                onClick={handlePrintBuild}
                className="btn btn-secondary"
                style={{ fontSize: '0.8rem', padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
                disabled={Object.values(selectedParts).every(item => !item)}
              >
                <Printer size={13} /> Tải / In
              </button>
            </div>

            <button
              onClick={addWholeBuildToCart}
              className="btn btn-primary"
              style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', gap: '0.5rem' }}
              disabled={Object.values(selectedParts).every(item => !item)}
            >
              <ShoppingCart size={20} />
              Thêm Toàn Bộ Vào Giỏ Hàng
            </button>
          </div>
        </div>
      </div>
      </div> {/* Close pc-builder-screen-layout */}

      {/* PRINT-ONLY TEMPLATE */}
      <div className="print-only-layout">
        <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif', color: '#000', backgroundColor: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #000', paddingBottom: '1rem', marginBottom: '2rem' }}>
            <div>
              <h1 style={{ fontSize: '24px', margin: 0, fontWeight: 'bold', color: '#000' }}>AetherPC</h1>
              <p style={{ fontSize: '12px', margin: '4px 0 0 0', color: '#555' }}>Hệ thống Quản lý Bán linh kiện máy tính tích hợp AI</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <h2 style={{ fontSize: '16px', margin: 0, fontWeight: 'bold', textTransform: 'uppercase', color: '#000' }}>BẢNG BÁO GIÁ CẤU HÌNH PC</h2>
              <p style={{ fontSize: '12px', margin: '4px 0 0 0', color: '#555' }}>Ngày tạo: {new Date().toLocaleDateString('vi-VN')}</p>
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #000', textAlign: 'left' }}>
                <th style={{ padding: '8px', fontSize: '14px', fontWeight: 'bold', color: '#000', width: '20%' }}>Linh kiện</th>
                <th style={{ padding: '8px', fontSize: '14px', fontWeight: 'bold', color: '#000', width: '50%' }}>Tên sản phẩm</th>
                <th style={{ padding: '8px', fontSize: '14px', fontWeight: 'bold', color: '#000', width: '15%' }}>Hãng</th>
                <th style={{ padding: '8px', fontSize: '14px', fontWeight: 'bold', color: '#000', width: '15%', textAlign: 'right' }}>Đơn giá</th>
              </tr>
            </thead>
            <tbody>
              {COMPONENT_SLOTS.map(slot => {
                const item = selectedParts[slot.id];
                return (
                  <tr key={slot.id} style={{ borderBottom: '1px solid #ddd' }}>
                    <td style={{ padding: '10px 8px', fontSize: '13px', fontWeight: 'bold', color: '#000' }}>{slot.label}</td>
                    <td style={{ padding: '10px 8px', fontSize: '13px', color: '#333' }}>{item ? item.name : 'Chưa chọn'}</td>
                    <td style={{ padding: '10px 8px', fontSize: '13px', color: '#333' }}>{item ? item.brand : '-'}</td>
                    <td style={{ padding: '10px 8px', fontSize: '13px', color: '#000', textAlign: 'right', fontWeight: item ? 'bold' : 'normal' }}>
                      {item ? formatPrice(item.price) : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '2px solid #000', paddingTop: '1rem' }}>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '16px', fontWeight: 'bold', marginRight: '1rem', color: '#000' }}>TỔNG CỘNG THANH TOÁN:</span>
              <strong style={{ fontSize: '22px', color: '#10b981' }}>{formatPrice(calculateTotalPrice())}</strong>
            </div>
          </div>

          <div style={{ marginTop: '4rem', textAlign: 'center', fontSize: '11px', color: '#777', borderTop: '1px dashed #ccc', paddingTop: '1rem' }}>
            <p>Mọi thắc mắc vui lòng liên hệ hotline: 1900 xxxx hoặc truy cập website: http://localhost:3000</p>
            <p>Cảm ơn quý khách đã tin tưởng và mua sắm tại AetherPC!</p>
          </div>
        </div>
      </div>

      {activeSlot && (
        <div style={{
          position: 'fixed',
          top: 0, right: 0, bottom: 0, left: 0,
          backgroundColor: 'rgba(5, 7, 12, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '2rem'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '1000px',
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            padding: '1.5rem',
            position: 'relative',
            color: '#333'
          }}>
            <button
              onClick={() => { setActiveSlot(null); setModalSearch(''); setModalBrandFilter('all'); setModalSortOrder('default'); }}
              style={{
                position: 'absolute',
                top: '1rem', right: '1rem',
                background: 'none', border: 'none',
                color: '#666', fontSize: '1.5rem', cursor: 'pointer'
              }}
            >
              &times;
            </button>

            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', fontWeight: 700, color: '#0f172a' }}>
              Chọn linh kiện: {COMPONENT_SLOTS.find(s => s.id === activeSlot)?.label}
            </h3>

            {/* Professional Compatibility Reason Banner */}
            {(() => {
              const { CPU, MAINBOARD, RAM } = selectedParts;
              let reasonText = null;
              if (activeSlot === 'MAINBOARD' && CPU) {
                reasonText = `✓ Đang đề xuất Bo mạch chủ Socket [${getSocket(CPU) || 'tương thích'}] trùng khớp 100% với CPU ${CPU.name}`;
              } else if (activeSlot === 'CPU' && MAINBOARD) {
                reasonText = `✓ Đang đề xuất CPU Socket [${getSocket(MAINBOARD) || 'tương thích'}] tương thích với Bo mạch chủ ${MAINBOARD.name}`;
              } else if (activeSlot === 'RAM' && MAINBOARD) {
                reasonText = `✓ Đang đề xuất RAM chuẩn [${getRamType(MAINBOARD) || 'DDR4/DDR5'}] chân cắm Desktop DIMM cho Bo mạch chủ ${MAINBOARD.name}`;
              } else if (activeSlot === 'COOLER' && CPU) {
                reasonText = `✓ Đang đề xuất Tản nhiệt hỗ trợ chân gán Socket [${getSocket(CPU) || 'chuẩn'}] cho CPU ${CPU.name}`;
              } else if (activeSlot === 'PSU') {
                const estTdp = getEstimatedTdp();
                const recWatts = Math.ceil(estTdp * 1.25);
                reasonText = `✓ Ước tính công suất hệ thống: ${estTdp}W. Đang ưu tiên Bộ nguồn từ ${recWatts}W trở lên để đảm bảo 25% dư tải an toàn.`;
              }

              if (!reasonText) return null;
              return (
                <div style={{ padding: '0.6rem 0.85rem', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', color: '#15803d', fontSize: '0.825rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ShieldCheck size={18} />
                  <span>{reasonText}</span>
                </div>
              );
            })()}

            {/* Filters Bar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid #eaeaea', paddingBottom: '1rem' }}>
              
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Chọn thương hiệu:</span>
                  <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => setModalBrandFilter('all')}
                      style={{
                        padding: '0.25rem 0.75rem',
                        fontSize: '0.8125rem',
                        border: `1px solid ${modalBrandFilter === 'all' ? '#2563eb' : '#ccc'}`,
                        backgroundColor: modalBrandFilter === 'all' ? '#eff6ff' : '#fff',
                        color: modalBrandFilter === 'all' ? '#2563eb' : '#333',
                        borderRadius: '4px',
                        fontWeight: modalBrandFilter === 'all' ? 700 : 500,
                        cursor: 'pointer'
                      }}
                    >Tất cả</button>
                    {availableBrands.map(brand => (
                      <button
                        key={brand}
                        onClick={() => setModalBrandFilter(brand)}
                        style={{
                          padding: '0.25rem 0.75rem',
                          fontSize: '0.8125rem',
                          border: `1px solid ${modalBrandFilter === brand ? '#2563eb' : '#ccc'}`,
                          backgroundColor: modalBrandFilter === brand ? '#eff6ff' : '#fff',
                          color: modalBrandFilter === brand ? '#2563eb' : '#333',
                          borderRadius: '4px',
                          fontWeight: modalBrandFilter === brand ? 700 : 500,
                          cursor: 'pointer'
                        }}
                      >{brand}</button>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flex: 1, minWidth: '250px' }}>
                  <input
                    type="text"
                    placeholder="Bạn cần tìm gì..."
                    value={modalSearch}
                    onChange={(e) => setModalSearch(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.5rem 1rem',
                      border: '1px solid #cbd5e1',
                      borderRadius: '20px',
                      fontSize: '0.875rem',
                      outline: 'none',
                      color: '#0f172a',
                      backgroundColor: '#fff'
                    }}
                    autoFocus
                  />
                </div>

                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  {['CPU', 'MAINBOARD', 'RAM', 'COOLER', 'PSU'].includes(activeSlot) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <input
                        type="checkbox"
                        id="compat-filter"
                        checked={onlyCompatible}
                        onChange={(e) => setOnlyCompatible(e.target.checked)}
                        style={{ cursor: 'pointer' }}
                      />
                      <label htmlFor="compat-filter" style={{ fontSize: '0.8125rem', cursor: 'pointer', userSelect: 'none', fontWeight: 600, color: '#2563eb' }}>
                        Chỉ hiện linh kiện tương thích 100%
                      </label>
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Sắp xếp:</span>
                    <select
                      value={modalSortOrder}
                      onChange={(e) => setModalSortOrder(e.target.value)}
                      style={{
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.8125rem',
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        outline: 'none',
                        color: '#0f172a',
                        backgroundColor: '#fff'
                      }}
                    >
                      <option value="default">Mặc định (Ưu tiên Tương Thích)</option>
                      <option value="price-asc">Giá tăng dần</option>
                      <option value="price-desc">Giá giảm dần</option>
                    </select>
                  </div>
                </div>
              </div>

            </div>

            {/* Grid List */}
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem' }}>
              {filteredModalProducts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>
                  Không tìm thấy linh kiện nào phù hợp.
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
                  gap: '1rem'
                }}>
                  {filteredModalProducts.map(p => {
                    const originalPrice = p.price * 1.1; // Giả lập giá cũ
                    return (
                    <div key={p.id} style={{
                      display: 'flex',
                      flexDirection: 'column',
                      border: p.isCompatible ? '2px solid #bbf7d0' : '1px solid #eaeaea',
                      borderRadius: '10px',
                      padding: '1rem',
                      backgroundColor: p.isCompatible ? '#f0fdf4' : '#fff',
                      position: 'relative',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.08)'}
                    onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
                    >
                      {p.isCompatible && (
                        <span style={{ position: 'absolute', top: '8px', right: '8px', backgroundColor: '#16a34a', color: '#fff', fontSize: '0.65rem', fontWeight: 800, padding: '2px 6px', borderRadius: '4px' }}>
                          ⭐ ĐỀ XUẤT TỐI ƯU
                        </span>
                      )}

                      <div style={{ height: '130px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.75rem', marginTop: p.isCompatible ? '0.5rem' : '0' }}>
                        <img 
                          src={p.image || `https://placehold.co/120x120/ffffff/cccccc?text=${activeSlot}`} 
                          alt={p.name}
                          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                          onError={(e) => { e.target.src = `https://placehold.co/120x120/ffffff/cccccc?text=${activeSlot}`; }}
                        />
                      </div>
                      <h4 style={{ 
                        fontSize: '0.875rem', 
                        fontWeight: 700, 
                        lineHeight: '1.35', 
                        height: '2.7rem', 
                        overflow: 'hidden', 
                        display: '-webkit-box', 
                        WebkitLineClamp: 2, 
                        WebkitBoxOrient: 'vertical',
                        marginBottom: '0.35rem',
                        color: '#0f172a'
                      }}>
                        {p.name}
                      </h4>

                      {p.compatReason && (
                        <div style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 700, marginBottom: '0.4rem', backgroundColor: '#dcfce7', padding: '2px 6px', borderRadius: '4px', display: 'inline-block' }}>
                          ✓ {p.compatReason}
                        </div>
                      )}

                      <div style={{ marginBottom: '0.75rem', marginTop: 'auto' }}>
                        <div style={{ fontSize: '0.78rem', color: '#94a3b8', textDecoration: 'line-through' }}>
                          {formatPrice(originalPrice)}
                        </div>
                        <div style={{ fontSize: '1rem', fontWeight: 800, color: '#2563eb' }}>
                          {formatPrice(p.price)}
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed #cbd5e1', paddingTop: '0.5rem' }}>
                        <a href={`/product/${p.id}`} target="_blank" rel="noreferrer" style={{ fontSize: '0.78rem', color: '#64748b', textDecoration: 'none', fontWeight: 600 }}>
                          Xem chi tiết
                        </a>
                        <button 
                          onClick={() => selectPart(activeSlot, p)} 
                          style={{ 
                            backgroundColor: '#2563eb', 
                            color: '#fff', 
                            border: 'none', 
                            borderRadius: '6px', 
                            padding: '0.4rem 1rem', 
                            fontSize: '0.8125rem', 
                            fontWeight: 700,
                            cursor: 'pointer',
                            boxShadow: '0 2px 6px rgba(37,99,235,0.2)'
                          }}
                        >
                          Chọn linh kiện
                        </button>
                      </div>
                    </div>
                  )})}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
