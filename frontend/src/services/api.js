// API client wrapper using native fetch
// Keep the browser on the same origin in deployed environments. The reverse
// proxy routes /api to the backend, avoiding hard-coded localhost URLs.
const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';
const mapSlugToCategory = (slug) => {
  if (!slug) return 'OTHER';
  const s = slug.toLowerCase();
  if (s === 'cpu' || s.includes('cpu')) return 'CPU';
  if (s === 'mainboard' || s.includes('main')) return 'MAINBOARD';
  if (s === 'ram' || s.includes('ram')) return 'RAM';
  if (s === 'gpu' || s === 'vga' || s.includes('vga') || s.includes('card')) return 'VGA';
  if (s === 'psu' || s === 'nguồn' || s.includes('psu') || s.includes('nguon')) return 'PSU';
  if (s.includes('ssd') || s.includes('hdd') || s === 'storage' || s.includes('o-cung')) return 'STORAGE';
  if (s === 'case' || s.includes('case')) return 'CASE';
  if (s === 'cooler' || s.includes('tản') || s.includes('cooler')) return 'COOLER';
  return s.toUpperCase();
};

const normalizeProductSpecs = (specs) => {
  let parsedSpecs = {};
  try {
    parsedSpecs = typeof specs === 'string' ? JSON.parse(specs) : (specs || {});
  } catch (err) {
    parsedSpecs = specs || {};
  }

  const normalizedSpecs = {};
  if (parsedSpecs) {
    Object.entries(parsedSpecs).forEach(([key, val]) => {
      const lowerKey = key.toLowerCase()
        .replace(/loại ram hỗ trợ/g, 'ram_type')
        .replace(/loại ram/g, 'ram_type')
        .replace(/số nhân/g, 'cores')
        .replace(/số luồng/g, 'threads')
        .replace(/tốc độ bus/g, 'speed')
        .replace(/dung lượng/g, 'capacity')
        .replace(/công suất/g, 'wattage')
        .replace(/điện năng tiêu thụ/g, 'tdp')
        .replace(/ /g, '_');
      
      let cleanVal = val;
      if (lowerKey === 'tdp' || lowerKey === 'wattage') {
        const num = parseInt(val);
        if (!isNaN(num)) cleanVal = num;
      }
      normalizedSpecs[lowerKey] = cleanVal;
    });
  }

  // Clean up socket names
  let socket = normalizedSpecs.socket;
  if (socket) {
    socket = socket.toString().toUpperCase().trim();
    if (socket === '1700') socket = 'LGA1700';
    if (socket === '1200') socket = 'LGA1200';
    if (socket === '1851') socket = 'LGA1851';
    if (!socket.startsWith('LGA') && (socket.includes('1700') || socket.includes('1200') || socket.includes('1151') || socket.includes('2066') || socket.includes('1851'))) {
      socket = 'LGA' + socket.replace(/[^0-9]/g, '');
    }
    normalizedSpecs.socket = socket;
  }

  // Clean up RAM type names
  let ramType = normalizedSpecs.ram_type;
  if (ramType) {
    ramType = ramType.toString().toUpperCase().trim();
    if (ramType.includes('DDR5')) ramType = 'DDR5';
    else if (ramType.includes('DDR4')) ramType = 'DDR4';
    normalizedSpecs.ram_type = ramType;
  }

  return normalizedSpecs;
};

async function request(endpoint, options = {}) {
  // Intercept and handle '/products' endpoint for fallback dataset
  if (endpoint === '/products') {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const response = await fetch(`${BASE_URL}${endpoint}`, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (response.ok) {
        const resData = await response.json().catch(() => null);
        if (resData) {
          let list = [];
          if (Array.isArray(resData)) list = resData;
          else if (resData.success && Array.isArray(resData.data)) list = resData.data;

          if (list.length > 0) {
            return list.map(p => {
              const dbUrls = p.images ? p.images.map(img => img.url) : [p.primaryImage || p.image || ''];
              return {
                id: p.productId ? parseInt(p.productId) : p.id,
                sku: p.sku || `SKU-${p.productId || p.id}`,
                name: p.name,
                brand: p.brand?.name || p.brand || 'Khác',
                price: p.price ? parseFloat(p.price) : 0,
                originalPrice: p.originalPrice ? parseFloat(p.originalPrice) : (p.price ? parseFloat(p.price) : 0),
                discountPercent: p.discountPercent ? parseFloat(p.discountPercent) : 0,
                category: p.category?.slug ? mapSlugToCategory(p.category.slug) : mapSlugToCategory(p.category?.name || p.category || 'OTHER'),
                specs: normalizeProductSpecs(p.specs),
                image: p.primaryImage || p.image || '',
                imageUrls: dbUrls.length > 0 ? dbUrls : [p.primaryImage || p.image || ''],
                available: p.available ?? true,
                stockQuantity: p.stockQuantity !== undefined ? p.stockQuantity : (p.stock_quantity || 0)
              };
            });
          }
        }
      }
    } catch (e) {
      console.warn('Backend API /products offline, serving static products_clean.json fallback dataset.', e);
    }

    // Static products JSON loading
    try {
      const res = await fetch('/products_clean.json');
      const data = await res.json();

      return data.map((p, index) => {
        const rawUrls = p.image_urls || '';
        const imgUrls = rawUrls.split('|').filter(Boolean).map(url => url.trim());
        return {
          id: p.product_id ? parseInt(p.product_id) : (index + 1),
          sku: p.sku || `SKU-${p.product_id || (index + 1)}`,
          name: p.name,
          brand: p.brand || 'Khác',
          price: p.price || 0,
          originalPrice: p.original_price || p.price || 0,
          discountPercent: p.discount_percent || 0,
          category: mapSlugToCategory(p.category_slug),
          specs: normalizeProductSpecs(p.specs),
          image: p.primary_image || '',
          imageUrls: imgUrls.length > 0 ? imgUrls : [p.primary_image || ''],
          available: p.available !== undefined ? p.available : true,
          stockQuantity: p.stock_quantity || 0
        };
      });
    } catch (err) {
      console.error('Failed to load local fallback products dataset:', err);
    }
  }

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const config = {
    ...options,
    headers,
    credentials: 'include' // Session lives in the backend's HTTP-Only authToken cookie
  };

  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, config);

    // Session cookie missing/expired — tell AuthContext to clear the logged-in user.
    if (response.status === 401 && endpoint.includes('/auth/me')) {
      window.dispatchEvent(new Event('auth-change'));
    }

    const data = await response.json().catch(() => null);
    
    if (!response.ok) {
      throw new Error(data?.message || `HTTP error! Status: ${response.status}`);
    }
    
    return data;
  } catch (error) {
    console.error('API Request Error:', error);
    throw error;
  }
}

export const api = {
  get: (endpoint, options) => request(endpoint, { method: 'GET', ...options }),
  post: (endpoint, body, options) => request(endpoint, { method: 'POST', body, ...options }),
  put: (endpoint, body, options) => request(endpoint, { method: 'PUT', body, ...options }),
  patch: (endpoint, body, options) => request(endpoint, { method: 'PATCH', body, ...options }),
  delete: (endpoint, options) => request(endpoint, { method: 'DELETE', ...options }),
};
