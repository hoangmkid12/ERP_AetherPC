import { create } from 'zustand';
import { api } from '../services/api';

/**
 * @typedef {Object} Product
 * @property {number} id
 * @property {string} name
 * @property {string} category
 * @property {number} price
 * @property {boolean} available
 */

/**
 * @typedef {Object} InventoryItem
 * @property {number} id
 * @property {string} name
 * @property {string} category
 * @property {number} stock
 * @property {number} threshold
 * @property {string} supplier
 * @property {string} location
 * @property {number} price
 * @property {boolean} available
 * @property {string} status
 */

/**
 * @typedef {Object} SerialNumber
 * @property {string} serial
 * @property {number} productId
 * @property {string} status
 */

const INITIAL_STATE = {
  products: [],
  inventory: [],
  serialNumbers: [],
  error: null,
};

const STORAGE_KEYS = {
  products: 'erp_products',
  inventory: 'erp_inventory',
  serialNumbers: 'erp_serials',
};

// Category.slug (already a short English word, seeded from the scraper's
// category_slug) -> the short canonical code the rest of the app already uses
// (Warehouse.jsx's CAT_ALIASES/filter dropdown, the Add/Edit Product forms).
// Keeps the Kho product-list "Phân Nhóm" column to one short English word
// instead of the full bilingual category name (e.g. "GPU - Card màn hình"),
// which was blowing out that column's width.
const CATEGORY_SLUG_TO_CODE = {
  cpu: 'CPU',
  gpu: 'VGA',
  ram: 'RAM',
  ram_laptop: 'RAM',
  ssd: 'STORAGE',
  hdd: 'STORAGE',
  mainboard: 'MAINBOARD',
  case: 'CASE',
  psu: 'PSU',
  cooler: 'COOLER',
  monitor: 'MONITOR',
  keyboard: 'KEYBOARD',
  mouse: 'MOUSE',
};

const loadFromLocalStorage = () => {
  const state = { ...INITIAL_STATE };
  try {
    Object.entries(STORAGE_KEYS).forEach(([key, storageKey]) => {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        state[key] = JSON.parse(stored);
      }
    });
  } catch (e) {
    console.error('Error loading inventory from localStorage:', e);
  }
  return state;
};

export const useInventoryStore = create((set, get) => ({
  ...INITIAL_STATE,

  /**
   * Initialize state: hydrate from localStorage for an instant paint, then
   * always refresh from the API so the store reflects the server, not
   * whatever happened to be cached in this browser.
   */
  initialize: async () => {
    const state = loadFromLocalStorage();
    set(state);
    await Promise.allSettled([
      get().getProducts(),
      get().getInventory(),
      get().getSerialNumbers(),
    ]);
  },

  /**
   * Fetch all products from API
   */
  getProducts: async () => {
    try {
      set({ error: null });
      const data = await api.get('/products');
      const products = Array.isArray(data) ? data : (data?.data || []);
      
      set({ products });
      try {
        localStorage.setItem(STORAGE_KEYS.products, JSON.stringify(products));
      } catch (e) {}
      
      return products;
    } catch (err) {
      const errorMsg = err.message || 'Failed to fetch products';
      set({ error: errorMsg });
      console.error('Error fetching products:', err);
      throw err;
    }
  },

  /**
   * Fetch all inventory items from API
   */
  getInventory: async () => {
    try {
      set({ error: null });
      // The real backend route is /warehouse/inventory (see warehouse.routes.js) —
      // plain /inventory doesn't exist and always 404'd, so this never actually
      // synced with the DB. Every consumer of `inventory` (stock tables, GRN
      // intake, low-stock checks) silently fell back to whatever was last cached
      // in localStorage, which is why on-hand quantities looked frozen even after
      // QA passed and the warehouse validated a receipt (which does correctly
      // write Inventory.quantityOnHand / Product.stockQuantity server-side).
      // The backend already aggregates each product's Inventory rows across every
      // warehouse into one row (there are 2 real warehouses — HCM + Hà Nội — so
      // without that every product would otherwise appear twice here, each copy
      // showing only that warehouse's fractional stock count).
      const data = await api.get('/warehouse/inventory');
      const rawRows = Array.isArray(data) ? data : (data?.data || []);
      // Flatten the backend's aggregated shape ({ productId, quantityOnHand,
      // locations: [...], product: {...} }) into the flat InventoryItem shape (see
      // typedef above) that the rest of the app reads directly off `.id` / `.name` / `.stock`.
      const inventory = rawRows.map(row => ({
        id: row.productId ?? row.product?.productId ?? row.id,
        name: row.product?.name || row.name || 'Sản phẩm',
        category: CATEGORY_SLUG_TO_CODE[row.product?.category?.slug] || row.category || 'STORAGE',
        stock: row.quantityOnHand ?? row.product?.stockQuantity ?? 0,
        threshold: row.reorderPoint ?? 5,
        // Backend `supplierName`: the product's most recent fulfilled-PO supplier if it
        // has real purchase history, else its catalog default distributor (derived from
        // supplied_brands in suppliers.json). Genuinely blank only for the ~35% of
        // seeded brands no supplier record claims to carry — not a fake placeholder.
        supplier: row.supplierName || '',
        // WarehouseLocation is zone/shelf/bin, and a product can hold stock in more
        // than one warehouse — join every assigned shelf into one string, matching
        // the literal 'Chưa xếp kệ' sentinel the location filter compares against.
        location: Array.isArray(row.locations) && row.locations.length > 0
          ? row.locations.map(l => `${l.zone}-${l.shelf}-${l.bin}`).join(', ')
          : 'Chưa xếp kệ',
        price: row.product?.price ?? row.price ?? 0,
        available: row.product?.available ?? true,
        status: row.product?.status || 'ACTIVE',
      }));

      set({ inventory });
      try {
        localStorage.setItem(STORAGE_KEYS.inventory, JSON.stringify(inventory));
      } catch (e) {}
      
      return inventory;
    } catch (err) {
      const errorMsg = err.message || 'Failed to fetch inventory';
      set({ error: errorMsg });
      console.error('Error fetching inventory:', err);
      throw err;
    }
  },

  /**
   * Fetch all serial numbers from API
   */
  getSerialNumbers: async () => {
    try {
      set({ error: null });
      const data = await api.get('/serials');
      const serialNumbers = Array.isArray(data) ? data : (data?.data || []);
      
      set({ serialNumbers });
      try {
        localStorage.setItem(STORAGE_KEYS.serialNumbers, JSON.stringify(serialNumbers));
      } catch (e) {}
      
      return serialNumbers;
    } catch (err) {
      const errorMsg = err.message || 'Failed to fetch serial numbers';
      set({ error: errorMsg });
      console.error('Error fetching serial numbers:', err);
      throw err;
    }
  },

  /**
   * Create a new product
   */
  createProduct: async (productData) => {
    try {
      set({ error: null });
      const newProduct = await api.post('/products', productData);
      
      set(state => {
        const updated = [...state.products, newProduct];
        try {
          localStorage.setItem(STORAGE_KEYS.products, JSON.stringify(updated));
        } catch (e) {}
        return { products: updated };
      });
      
      return newProduct;
    } catch (err) {
      const errorMsg = err.message || 'Failed to create product';
      set({ error: errorMsg });
      console.error('Error creating product:', err);
      throw err;
    }
  },

  /**
   * Update a product
   */
  updateProduct: async (productId, productData) => {
    try {
      set({ error: null });
      const updated = await api.put(`/products/${productId}`, productData);
      
      set(state => {
        const products = state.products.map(p => p.id === productId ? updated : p);
        try {
          localStorage.setItem(STORAGE_KEYS.products, JSON.stringify(products));
        } catch (e) {}
        return { products };
      });
      
      return updated;
    } catch (err) {
      const errorMsg = err.message || 'Failed to update product';
      set({ error: errorMsg });
      console.error('Error updating product:', err);
      throw err;
    }
  },

  /**
   * Update inventory for a product
   */
  updateInventory: async (inventoryId, inventoryData) => {
    try {
      set({ error: null });
      const updated = await api.put(`/inventory/${inventoryId}`, inventoryData);
      
      set(state => {
        const inventory = state.inventory.map(i => i.id === inventoryId ? updated : i);
        try {
          localStorage.setItem(STORAGE_KEYS.inventory, JSON.stringify(inventory));
        } catch (e) {}
        return { inventory };
      });
      
      return updated;
    } catch (err) {
      const errorMsg = err.message || 'Failed to update inventory';
      set({ error: errorMsg });
      console.error('Error updating inventory:', err);
      throw err;
    }
  },

  /**
   * Delete a product
   */
  deleteProduct: async (productId) => {
    try {
      set({ error: null });
      await api.delete(`/products/${productId}`);
      
      set(state => {
        const products = state.products.filter(p => p.id !== productId);
        try {
          localStorage.setItem(STORAGE_KEYS.products, JSON.stringify(products));
        } catch (e) {}
        return { products };
      });
    } catch (err) {
      const errorMsg = err.message || 'Failed to delete product';
      set({ error: errorMsg });
      console.error('Error deleting product:', err);
      throw err;
    }
  },

  /**
   * Create serial numbers locally (offline support)
   */
  addLocalSerialNumber: (serial) => {
    set(state => {
      const updated = [...state.serialNumbers, serial];
      try {
        localStorage.setItem(STORAGE_KEYS.serialNumbers, JSON.stringify(updated));
      } catch (e) {}
      return { serialNumbers: updated };
    });
  },

  /**
   * Add multiple serial numbers locally
   */
  addLocalSerialNumbers: (serials) => {
    set(state => {
      const updated = [...state.serialNumbers, ...serials];
      try {
        localStorage.setItem(STORAGE_KEYS.serialNumbers, JSON.stringify(updated));
      } catch (e) {}
      return { serialNumbers: updated };
    });
  },

  /**
   * Update serial number status
   */
  updateSerialNumber: async (serial, status) => {
    try {
      set({ error: null });
      const data = await api.patch(`/serials/${serial}`, { status });
      
      set(state => {
        const serialNumbers = state.serialNumbers.map(s => 
          s.serial === serial ? { ...s, status: data.status } : s
        );
        try {
          localStorage.setItem(STORAGE_KEYS.serialNumbers, JSON.stringify(serialNumbers));
        } catch (e) {}
        return { serialNumbers };
      });
      
      return data;
    } catch (err) {
      const errorMsg = err.message || 'Failed to update serial number';
      set({ error: errorMsg });
      console.error('Error updating serial number:', err);
      throw err;
    }
  },

  /**
   * Clear all inventory data
   */
  clearAll: () => {
    set(INITIAL_STATE);
    try {
      Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
      });
    } catch (e) {}
  },

  /**
   * Get a specific product by ID
   */
  getProductById: (productId) => {
    return get().products.find(p => p.id === productId);
  },

  /**
   * Get inventory item by product ID
   */
  getInventoryByProductId: (productId) => {
    return get().inventory.find(i => i.id === productId);
  },

  /**
   * Search products by name
   */
  searchProducts: (query) => {
    const lowerQuery = query.toLowerCase();
    return get().products.filter(p => 
      p.name.toLowerCase().includes(lowerQuery) || 
      (p.sku && p.sku.toLowerCase().includes(lowerQuery))
    );
  },

  /**
   * Get low stock items
   */
  getLowStockItems: () => {
    return get().inventory.filter(item => item.stock <= item.threshold);
  },

  /**
   * Get out of stock items
   */
  getOutOfStockItems: () => {
    return get().inventory.filter(item => item.stock === 0);
  },

  /**
   * Get products by category
   */
  getProductsByCategory: (category) => {
    return get().products.filter(p => p.category === category);
  },
}));
