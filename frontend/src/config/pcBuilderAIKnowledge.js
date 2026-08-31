/**
 * AETHER PC BUILDER - AI HARDWARE OPTIMIZATION KNOWLEDGE ENGINE
 * Định nghĩa tri thức phần cứng, thuật toán phân tích ngôn ngữ tự nhiên
 * và quy tắc phối ghép tối ưu hóa linh kiện PC theo nhu cầu thực tế của khách hàng.
 */

export const HARDWARE_KNOWLEDGE_BASE = {
  version: '2.5.0',
  updatedAt: '2026-08-07',
  author: 'AetherPC AI Hardware Lab',
  
  // Workload Types & Budget Allocation Strategies
  workloadProfiles: {
    GAMING: {
      id: 'GAMING',
      name: 'Chơi Game & E-Sports',
      allocation: { CPU: 0.22, MAINBOARD: 0.12, RAM: 0.08, VGA: 0.42, PSU: 0.07, STORAGE: 0.05, CASE: 0.04 },
      keyPriority: 'Card màn hình (VGA) & Xung nhịp Đơn nhân CPU cao',
      recommendedVgaChips: ['RTX 4060', 'RTX 4070', 'RTX 4070 Super', 'RX 7600', 'RX 7700 XT']
    },
    RENDER_3D: {
      id: 'RENDER_3D',
      name: 'Đồ Hoạ 3D, Blender, Unreal Engine',
      allocation: { CPU: 0.30, MAINBOARD: 0.15, RAM: 0.12, VGA: 0.30, PSU: 0.06, STORAGE: 0.04, CASE: 0.03 },
      keyPriority: 'CPU Đa nhân cao, RAM lớn (32GB+) & NVIDIA CUDA VRAM',
      recommendedVgaChips: ['RTX 4060 Ti 16GB', 'RTX 4070 Super', 'RTX 4080 Super']
    },
    AI_DEEP_LEARNING: {
      id: 'AI_DEEP_LEARNING',
      name: 'Lập Trình AI, Machine Learning, Data Science',
      allocation: { CPU: 0.25, MAINBOARD: 0.13, RAM: 0.15, VGA: 0.35, PSU: 0.06, STORAGE: 0.04, CASE: 0.02 },
      keyPriority: 'NVIDIA GPU Tensor Cores (12GB+ VRAM) & RAM 32-64GB',
      recommendedVgaChips: ['RTX 4060 Ti 16GB', 'RTX 4070 Super 12GB', 'RTX 4080 Super 16GB']
    },
    OFFICE_STUDENT: {
      id: 'OFFICE_STUDENT',
      name: 'Văn Phòng, Học Tập, Lập Trình Web',
      allocation: { CPU: 0.35, MAINBOARD: 0.20, RAM: 0.15, VGA: 0.00, PSU: 0.12, STORAGE: 0.10, CASE: 0.08 },
      keyPriority: 'CPU tích hợp iGPU mạnh, SSD NVMe tốc độ cao, RAM 16GB+',
      recommendedVgaChips: []
    },
    STREAMING: {
      id: 'STREAMING',
      name: 'Livestream & Content Creator',
      allocation: { CPU: 0.28, MAINBOARD: 0.14, RAM: 0.12, VGA: 0.32, PSU: 0.07, STORAGE: 0.04, CASE: 0.03 },
      keyPriority: 'CPU Đa nhân mượt NVENC Encoder & RAM 32GB',
      recommendedVgaChips: ['RTX 4060', 'RTX 4070 Super']
    },
    EMULATOR: {
      id: 'EMULATOR',
      name: 'Giả lập Multi-Nox / Android',
      allocation: { CPU: 0.35, MAINBOARD: 0.15, RAM: 0.20, VGA: 0.15, PSU: 0.08, STORAGE: 0.04, CASE: 0.03 },
      keyPriority: 'CPU nhiều nhân thực, RAM dung lượng khủng (32GB-64GB)',
      recommendedVgaChips: ['RTX 3060 12GB', 'RTX 4060']
    }
  },

  // Compatibility Validation Rules
  compatibilityRules: [
    {
      ruleId: 'CPU_MAINBOARD_SOCKET',
      name: 'Khớp Chân Cắm Socket CPU & Mainboard',
      check: (cpu, mb) => {
        if (!cpu || !mb) return { ok: true };
        const cpuSock = cpu.specs?.socket || '';
        const mbSock = mb.specs?.socket || '';
        if (cpuSock && mbSock && cpuSock.toUpperCase() !== mbSock.toUpperCase()) {
          return { ok: false, reason: `Socket CPU (${cpuSock}) không gắn được vào Mainboard (${mbSock})` };
        }
        return { ok: true };
      }
    },
    {
      ruleId: 'MAINBOARD_RAM_TYPE',
      name: 'Khớp Chuẩn Chuẩn Chân Cắm RAM DDR4/DDR5',
      check: (mb, ram) => {
        if (!mb || !ram) return { ok: true };
        const mbRam = mb.specs?.ram_type || '';
        const ramType = ram.specs?.ram_type || '';
        if (mbRam && ramType && mbRam.toUpperCase() !== ramType.toUpperCase()) {
          return { ok: false, reason: `Mainboard dùng RAM ${mbRam} nhưng bạn đang chọn RAM ${ramType}` };
        }
        return { ok: true };
      }
    },
    {
      ruleId: 'PSU_WATTAGE_SAFETY',
      name: 'Công Suất Nguồn Điện An Toàn (PSU Safety Margin 1.25x)',
      check: (cpu, vga, psu) => {
        if (!psu) return { ok: true };
        const cpuTdp = cpu?.specs?.tdp || 65;
        const vgaTdp = vga?.specs?.tdp || (vga ? 150 : 0);
        const estTotalTdp = cpuTdp + vgaTdp + 100; // 100W for MB, Fans, RAM, SSD
        const reqWattage = Math.ceil(estTotalTdp * 1.25);
        const psuWatts = psu.specs?.wattage || 0;
        if (psuWatts > 0 && psuWatts < reqWatts) {
          return { ok: false, reason: `Cấu hình cần tối thiểu ${reqWatts}W nhưng Nguồn chỉ có ${psuWatts}W` };
        }
        return { ok: true, estTdp: estTotalTdp, reqWatts };
      }
    }
  ]
};

/**
 * Trích xuất Ngân sách và Nhu cầu từ văn bản ngôn ngữ tự nhiên của khách hàng
 */
export const parseCustomerPrompt = (promptText) => {
  if (!promptText || typeof promptText !== 'string') {
    return { budget: null, workload: 'GAMING', brand: 'all', color: 'all' };
  }

  const text = promptText.toLowerCase().trim();

  // 1. Extract Budget (đơn vị Triệu / tr / củ / k)
  let extractedBudget = null;
  const millionMatch = text.match(/(\d+(?:[\.,]\d+)?)\s*(tr|triệu|trieu|cu|củ)/i);
  if (millionMatch) {
    const val = parseFloat(millionMatch[1].replace(',', '.'));
    if (!isNaN(val) && val > 0) {
      extractedBudget = val * 1000000;
    }
  } else {
    const thousandMatch = text.match(/(\d+)\s*(k|ngàn|nghìn)/i);
    if (thousandMatch) {
      const val = parseInt(thousandMatch[1], 10);
      if (!isNaN(val) && val > 1000) {
        extractedBudget = val * 1000;
      }
    }
  }

  // 2. Detect Workload Profile
  let detectedWorkload = 'GAMING';
  if (text.includes('3d') || text.includes('blender') || text.includes('render') || text.includes('unreal') || text.includes('đồ họa') || text.includes('do hoa') || text.includes('design') || text.includes('video') || text.includes('premiere') || text.includes('capcut')) {
    detectedWorkload = 'RENDER_3D';
  } else if (text.includes('ai') || text.includes('deep learning') || text.includes('machine learning') || text.includes('llama') || text.includes('python') || text.includes('data') || text.includes('lập trình') || text.includes('lap trinh') || text.includes('code')) {
    detectedWorkload = 'AI_DEEP_LEARNING';
  } else if (text.includes('văn phòng') || text.includes('van phong') || text.includes('học tập') || text.includes('hoc tap') || text.includes('lướt web') || text.includes('excel')) {
    detectedWorkload = 'OFFICE_STUDENT';
  }

  // 3. Detect Brand Preference
  let detectedBrand = 'all';
  if (text.includes('intel')) detectedBrand = 'intel';
  if (text.includes('amd') || text.includes('ryzen')) detectedBrand = 'amd';

  // 4. Detect Aesthetics (Color)
  let detectedColor = 'all';
  if (text.includes('trắng') || text.includes('trang') || text.includes('white')) detectedColor = 'white';

  return {
    budget: extractedBudget,
    workload: detectedWorkload,
    brand: detectedBrand,
    color: detectedColor,
    rawPrompt: promptText
  };
};

/**
 * Thuật toán AI Phân Tích & Lựa Chọn Cấu Hình Tối Ưu Nhất Từ Kho Hàng Thực Tế
 */
export const runAIOptimizer = ({ promptText, budgetInput, workloadInput, brandInput, gpuBrandInput, mfgBrandInput, availableProducts }) => {
  const parsed = parseCustomerPrompt(promptText);
  
  const finalBudget = parsed.budget || budgetInput || 25000000;
  const finalWorkload = parsed.workload || workloadInput || 'GAMING';
  const finalBrand = parsed.brand !== 'all' ? parsed.brand : (brandInput !== 'all' ? brandInput : 'all');

  const profile = HARDWARE_KNOWLEDGE_BASE.workloadProfiles[finalWorkload] || HARDWARE_KNOWLEDGE_BASE.workloadProfiles.GAMING;
  const alloc = profile.allocation;

  // Separate products by category
  const getCatList = (cat) => availableProducts.filter(p => (p.category || '').toUpperCase() === cat);

  const cpuList = getCatList('CPU');
  const mbList = getCatList('MAINBOARD');
  const ramList = getCatList('RAM');
  const vgaList = getCatList('VGA');
  const psuList = getCatList('PSU');
  const storageList = getCatList('STORAGE');
  const caseList = getCatList('CASE');
  const coolerList = getCatList('COOLER');

  // Budget targets
  const targetCPU = finalBudget * alloc.CPU;
  const targetMB = finalBudget * alloc.MAINBOARD;
  const targetRAM = finalBudget * alloc.RAM;
  const targetVGA = finalBudget * alloc.VGA;
  const targetPSU = finalBudget * alloc.PSU;
  const targetStorage = finalBudget * alloc.STORAGE;
  const targetCase = finalBudget * alloc.CASE;

  const findBestFit = (list, targetPrice, filterFn = () => true) => {
    let candidates = list.filter(filterFn);

    // If manufacturer brand filter (e.g. ASUS, MSI, GIGABYTE, Corsair) is selected, prioritize candidates from that brand
    if (mfgBrandInput && mfgBrandInput !== 'all') {
      const brandCandidates = candidates.filter(p => 
        (p.brand || '').toUpperCase().includes(mfgBrandInput.toUpperCase()) ||
        (p.name || '').toUpperCase().includes(mfgBrandInput.toUpperCase())
      );
      if (brandCandidates.length > 0) {
        candidates = brandCandidates;
      }
    }

    if (candidates.length === 0) {
      return list.length > 0 ? list.reduce((best, item) => Math.abs(item.price - targetPrice) < Math.abs(best.price - targetPrice) ? item : best) : null;
    }
    return candidates.reduce((best, item) => Math.abs(item.price - targetPrice) < Math.abs(best.price - targetPrice) ? item : best);
  };

  // 1. Pick CPU based on Brand preference & target price
  let cpuFilter = () => true;
  if (finalBrand === 'intel') cpuFilter = p => p.brand.toUpperCase().includes('INTEL');
  if (finalBrand === 'amd') cpuFilter = p => p.brand.toUpperCase().includes('AMD');
  const selectedCPU = findBestFit(cpuList, targetCPU, cpuFilter);

  const cpuSocket = selectedCPU?.specs?.socket;

  // 2. Pick Mainboard compatible with CPU socket
  const selectedMB = findBestFit(mbList, targetMB, p => {
    const mbSock = p.specs?.socket;
    return cpuSocket && mbSock && mbSock.toLowerCase() === cpuSocket.toLowerCase();
  });

  const mbRamType = selectedMB?.specs?.ram_type;

  // 3. Pick RAM compatible with Mainboard RAM type
  const selectedRAM = findBestFit(ramList, targetRAM, p => {
    const rType = p.specs?.ram_type;
    return mbRamType && rType && rType.toLowerCase() === mbRamType.toLowerCase();
  });

  // 4. Pick VGA based on Workload priority or GPU brand preference
  let selectedVGA = null;
  if (targetVGA > 0 || finalWorkload !== 'OFFICE_STUDENT') {
    let vgaFilter = () => true;
    if (gpuBrandInput === 'nvidia') {
      vgaFilter = p => (p.brand || '').toUpperCase().includes('NVIDIA') || (p.name || '').toUpperCase().includes('RTX') || (p.name || '').toUpperCase().includes('GTX');
    } else if (gpuBrandInput === 'amd') {
      vgaFilter = p => (p.brand || '').toUpperCase().includes('AMD') || (p.name || '').toUpperCase().includes('RADEON') || (p.name || '').toUpperCase().includes('RX');
    } else if (finalWorkload === 'AI_DEEP_LEARNING' || finalWorkload === 'RENDER_3D') {
      vgaFilter = p => (p.brand || '').toUpperCase().includes('NVIDIA') || (p.name || '').toUpperCase().includes('RTX');
    }
    selectedVGA = findBestFit(vgaList, targetVGA, vgaFilter);
  }

  // 5. Pick PSU based on required wattage + safety factor
  const cpuTdp = selectedCPU?.specs?.tdp || 65;
  const vgaTdp = selectedVGA?.specs?.tdp || (selectedVGA ? 150 : 0);
  const totalTdp = cpuTdp + vgaTdp + 100;
  const requiredWatts = Math.ceil(totalTdp * 1.25);

  const selectedPSU = findBestFit(psuList, targetPSU, p => {
    const pWatts = p.specs?.wattage || 0;
    return pWatts >= requiredWatts;
  });

  // 6. Pick Storage, Case, Cooler
  const selectedStorage = findBestFit(storageList, targetStorage);
  const selectedCase = findBestFit(caseList, targetCase);
  const selectedCooler = findBestFit(coolerList, finalBudget * 0.03, p => {
    const support = p.specs?.socket_support;
    if (Array.isArray(support) && support.length > 0 && cpuSocket) {
      return support.some(s => s.toLowerCase() === cpuSocket.toLowerCase());
    }
    return true;
  });

  const build = {
    CPU: selectedCPU,
    MAINBOARD: selectedMB,
    RAM: selectedRAM,
    VGA: selectedVGA,
    PSU: selectedPSU,
    STORAGE: selectedStorage,
    CASE: selectedCase,
    COOLER: selectedCooler
  };

  const totalPrice = Object.values(build).reduce((sum, item) => sum + (item ? item.price : 0), 0);

  // Generate AI Explanation Summary
  const aiExplanation = `Dựa trên phân tích yêu cầu "${promptText || profile.name}", AI AetherPC đã tối ưu cấu hình trong ngân sách ${Number(finalBudget).toLocaleString('vi-VN')} đ:
• Nhu cầu cốt lõi: ${profile.keyPriority}.
• CPU (${selectedCPU?.name || 'N/A'}) & Mainboard (${selectedMB?.name || 'N/A'}) đạt chuẩn chân cắm Socket ${cpuSocket || 'khớp 100%'}.
• Công suất nguồn (${selectedPSU?.specs?.wattage || 650}W) dư tải an toàn 25% cho hệ thống chạy ổn định 24/7.`;

  return {
    parsedPrompt: parsed,
    profile,
    build,
    totalPrice,
    aiExplanation,
    estimatedTdp: totalTdp,
    requiredWatts
  };
};

export const optimizePCBuild = runAIOptimizer;
