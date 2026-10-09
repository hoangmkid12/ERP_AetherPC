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
        if (psuWatts > 0 && psuWatts < reqWattage) {
          return { ok: false, reason: `Cấu hình cần tối thiểu ${reqWattage}W nhưng Nguồn chỉ có ${psuWatts}W` };
        }
        return { ok: true, estTdp: estTotalTdp, reqWatts: reqWattage };
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

// CPU có nhân đồ họa tích hợp không (cấu hình văn phòng không mua card rời thì bắt buộc phải có).
// Intel hậu tố F/KF không có iGPU; Ryzen AM4 chỉ dòng G có; Ryzen 7000/9000 (AM5) có, trừ hậu tố F.
export const hasIntegratedGraphics = (cpu) => {
  const name = String(cpu?.name || '').toUpperCase();
  if (/\d{4,5}K?F\b/.test(name)) return false;
  if (name.includes('RYZEN')) {
    if (/\d{4}G/.test(name)) return true;
    return /\b[79]\d{3}(X3D|X)?\b/.test(name);
  }
  return true;
};

/**
 * Thuật toán AI Phân Tích & Lựa Chọn Cấu Hình Tối Ưu Nhất Từ Kho Hàng Thực Tế.
 * availableProducts cần có specs.socket / specs.ram_type / specs.wattage đã chuẩn hóa
 * (PCBuilder.jsx suy ra từ tên sản phẩm khi CSDL thiếu thông số).
 * Nguyên tắc: chỉ chọn linh kiện tương thích — không có lựa chọn tương thích thì để trống
 * và ghi rõ trong missing[], không "lấy đại" món gần giá; tổng tiền giữ trong ngân sách.
 */
export const runAIOptimizer = ({ promptText, budgetInput, workloadInput, brandInput, gpuBrandInput, mfgBrandInput, availableProducts }) => {
  const parsed = parseCustomerPrompt(promptText);

  const finalBudget = parsed.budget || budgetInput || 25000000;
  const promptWorkload = promptText && promptText.trim() ? parsed.workload : null;
  const finalWorkload = promptWorkload || workloadInput || 'GAMING';
  const finalBrand = parsed.brand !== 'all' ? parsed.brand : (brandInput && brandInput !== 'all' ? brandInput : 'all');

  const profile = HARDWARE_KNOWLEDGE_BASE.workloadProfiles[finalWorkload] || HARDWARE_KNOWLEDGE_BASE.workloadProfiles.GAMING;
  const alloc = profile.allocation;
  const needsVGA = (alloc.VGA || 0) > 0;
  const lower = (v) => String(v || '').toLowerCase();
  const upName = (p) => `${p.brand || ''} ${p.name || ''}`.toUpperCase();

  const getCatList = (cat) => availableProducts.filter(p => (p.category || '').toUpperCase() === cat && Number(p.price) > 0);
  const lists = {
    CPU: getCatList('CPU'),
    MAINBOARD: getCatList('MAINBOARD'),
    RAM: getCatList('RAM'),
    VGA: getCatList('VGA'),
    PSU: getCatList('PSU'),
    STORAGE: getCatList('STORAGE'),
    CASE: getCatList('CASE'),
    COOLER: getCatList('COOLER')
  };

  const preferMfg = (candidates) => {
    if (!mfgBrandInput || mfgBrandInput === 'all') return candidates;
    const key = mfgBrandInput.toUpperCase();
    const branded = candidates.filter(p => upName(p).includes(key));
    return branded.length > 0 ? branded : candidates;
  };

  // Món tương thích đắt nhất mà không vượt mức giá mục tiêu; nếu mọi món đều đắt hơn mục tiêu
  // thì lấy món rẻ nhất. Không có món tương thích → null (không lấy đại món khác loại).
  const findBestFit = (list, targetPrice, filterFn = () => true) => {
    const candidates = preferMfg(list.filter(filterFn));
    if (candidates.length === 0) return null;
    const under = candidates.filter(p => Number(p.price) <= targetPrice);
    if (under.length > 0) return under.reduce((best, p) => (Number(p.price) > Number(best.price) ? p : best));
    return candidates.reduce((best, p) => (Number(p.price) < Number(best.price) ? p : best));
  };

  // Bộ lọc tương thích từng vị trí — dùng cả khi chọn ban đầu và khi hạ cấp cho vừa ngân sách
  const filters = {};
  filters.CPU = (p) => {
    if (finalBrand === 'intel' && !upName(p).includes('INTEL')) return false;
    if (finalBrand === 'amd' && !/AMD|RYZEN/.test(upName(p))) return false;
    if (!p.specs?.socket) return false;
    if (!needsVGA && !hasIntegratedGraphics(p)) return false;
    return true;
  };

  const build = {};
  build.CPU = findBestFit(lists.CPU, finalBudget * alloc.CPU, filters.CPU);
  const cpuSocket = build.CPU?.specs?.socket || '';

  filters.MAINBOARD = (p) => Boolean(cpuSocket) && lower(p.specs?.socket) === lower(cpuSocket) && Boolean(p.specs?.ram_type);
  build.MAINBOARD = findBestFit(lists.MAINBOARD, finalBudget * alloc.MAINBOARD, filters.MAINBOARD);
  const mbRamType = build.MAINBOARD?.specs?.ram_type || '';

  filters.RAM = (p) => Boolean(mbRamType) && lower(p.specs?.ram_type) === lower(mbRamType) && p.specs?.form_factor !== 'SODIMM';
  build.RAM = findBestFit(lists.RAM, finalBudget * alloc.RAM, filters.RAM);

  build.VGA = null;
  if (needsVGA) {
    filters.VGA = () => true;
    if (gpuBrandInput === 'nvidia') filters.VGA = p => /NVIDIA|RTX|GTX/.test(upName(p));
    else if (gpuBrandInput === 'amd') filters.VGA = p => /RADEON|\bRX\s?\d/.test(upName(p));
    else if (finalWorkload === 'AI_DEEP_LEARNING' || finalWorkload === 'RENDER_3D') filters.VGA = p => /NVIDIA|RTX/.test(upName(p));
    build.VGA = findBestFit(lists.VGA, finalBudget * alloc.VGA, filters.VGA);
  }

  const estimateTdp = () => (Number(build.CPU?.specs?.tdp) || 65) + (Number(build.VGA?.specs?.tdp) || (build.VGA ? 200 : 0)) + 100;
  let totalTdp = estimateTdp();
  let requiredWatts = Math.ceil(totalTdp * 1.25);

  filters.PSU = (p) => (Number(p.specs?.wattage) || 0) >= requiredWatts;
  build.PSU = findBestFit(lists.PSU, finalBudget * alloc.PSU, filters.PSU);
  build.STORAGE = findBestFit(lists.STORAGE, finalBudget * alloc.STORAGE);
  build.CASE = findBestFit(lists.CASE, finalBudget * alloc.CASE);
  filters.COOLER = (p) => {
    const support = p.specs?.socket_support;
    if (Array.isArray(support) && support.length > 0 && cpuSocket) return support.some(s => lower(s) === lower(cpuSocket));
    return true;
  };
  build.COOLER = findBestFit(lists.COOLER, finalBudget * 0.03, filters.COOLER);

  const priceOf = (item) => (item ? Number(item.price) || 0 : 0);
  const sumBuild = () => Object.values(build).reduce((sum, item) => sum + priceOf(item), 0);

  // Vượt ngân sách → hạ cấp dần linh kiện cho tiết kiệm nhiều nhất mà vẫn giữ tương thích.
  // CPU/Bo mạch chủ giữ nguyên socket và loại RAM đã chọn nên các ràng buộc khác không bị phá.
  const downgradeFilters = {
    ...filters,
    CPU: (p) => filters.CPU(p) && lower(p.specs?.socket) === lower(cpuSocket),
    MAINBOARD: (p) => filters.MAINBOARD(p) && lower(p.specs?.ram_type) === lower(mbRamType)
  };
  for (let guard = 0; guard < 80 && sumBuild() > finalBudget; guard++) {
    let bestSlot = null;
    let bestItem = null;
    for (const slot of ['VGA', 'CPU', 'MAINBOARD', 'RAM', 'STORAGE', 'CASE', 'COOLER', 'PSU']) {
      const current = build[slot];
      if (!current) continue;
      const filterFn = downgradeFilters[slot] || (() => true);
      const cheaper = lists[slot].filter(p => filterFn(p) && Number(p.price) < priceOf(current));
      if (cheaper.length === 0) continue;
      const next = cheaper.reduce((best, p) => (Number(p.price) > Number(best.price) ? p : best));
      if (!bestItem || priceOf(current) - priceOf(next) > priceOf(build[bestSlot]) - priceOf(bestItem)) {
        bestSlot = slot;
        bestItem = next;
      }
    }
    if (!bestSlot) break;
    build[bestSlot] = bestItem;
  }
  totalTdp = estimateTdp();
  requiredWatts = Math.ceil(totalTdp * 1.25);

  const SLOT_VI = { CPU: 'CPU', MAINBOARD: 'Bo mạch chủ', RAM: 'RAM', VGA: 'Card đồ họa', PSU: 'Nguồn', STORAGE: 'Ổ cứng', CASE: 'Vỏ case', COOLER: 'Tản nhiệt CPU' };
  const missing = Object.keys(SLOT_VI)
    .filter(slot => !build[slot] && !(slot === 'VGA' && !needsVGA))
    .map(slot => SLOT_VI[slot]);

  const totalPrice = sumBuild();
  const withinBudget = totalPrice <= finalBudget;

  const lines = [
    `Dựa trên yêu cầu "${promptText || profile.name}" với ngân sách ${Number(finalBudget).toLocaleString('vi-VN')} đ:`,
    `• Nhu cầu cốt lõi: ${profile.keyPriority}.`
  ];
  if (build.CPU && build.MAINBOARD) lines.push(`• CPU (${build.CPU.name}) và Bo mạch chủ (${build.MAINBOARD.name}) cùng Socket ${cpuSocket}; RAM chọn theo chuẩn ${mbRamType}.`);
  if (!needsVGA && build.CPU) lines.push('• Không lắp card đồ họa rời — CPU được chọn có nhân đồ họa tích hợp.');
  if (build.PSU) lines.push(`• Nguồn ${Number(build.PSU.specs?.wattage) || '?'}W đáp ứng mức đề xuất ${requiredWatts}W (tải ước tính ${totalTdp}W × 1,25).`);
  lines.push(withinBudget
    ? `• Tổng ${totalPrice.toLocaleString('vi-VN')} đ — nằm trong ngân sách.`
    : `• Tổng ${totalPrice.toLocaleString('vi-VN')} đ — VƯỢT ngân sách ${(totalPrice - finalBudget).toLocaleString('vi-VN')} đ: kho hiện không có lựa chọn tương thích rẻ hơn, bạn có thể tăng ngân sách hoặc tự đổi linh kiện.`);
  if (missing.length) lines.push(`• Chưa tìm được linh kiện tương thích trong kho cho: ${missing.join(', ')} — vui lòng chọn thủ công hoặc liên hệ tư vấn.`);

  return {
    parsedPrompt: parsed,
    profile,
    build,
    totalPrice,
    budget: finalBudget,
    withinBudget,
    missing,
    aiExplanation: lines.join('\n'),
    estimatedTdp: totalTdp,
    requiredWatts
  };
};

export const optimizePCBuild = runAIOptimizer;
