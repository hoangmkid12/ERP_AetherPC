import { useEffect, useState } from 'react';
import { api } from '../../services/api';

// Danh mục sản phẩm dùng chung cho storefront: hiện ngay từ bộ nhớ đệm (localStorage, cùng
// khóa 'aetherpc_products' các trang cũ đang dùng), rồi làm mới từ máy chủ một lần cho mỗi
// lần tải trang — chuyển qua lại giữa các trang không gọi lại API.
const KEY = 'aetherpc_products';
let memo = null;
let inflight = null;
const listeners = new Set();

function readCache() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function refresh() {
  if (!inflight) {
    inflight = api.get('/products')
      .then(list => {
        if (Array.isArray(list) && list.length > 0) {
          memo = list;
          try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* bộ nhớ đầy: bỏ qua */ }
          listeners.forEach(fn => fn(list));
        }
      })
      .catch(() => {});
  }
  return inflight;
}

export default function useCatalog() {
  const [products, setProducts] = useState(() => memo || readCache() || []);
  const [loading, setLoading] = useState(() => !(memo || readCache()));

  useEffect(() => {
    listeners.add(setProducts);
    refresh().finally(() => setLoading(false));
    return () => listeners.delete(setProducts);
  }, []);

  return { products, loading };
}
