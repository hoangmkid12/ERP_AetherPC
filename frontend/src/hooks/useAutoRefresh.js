import { useEffect, useRef } from 'react';

// Nhiều trang admin (Purchasing, Warehouse, QualityControl, SalesPOS...) tự
// quản lý state cục bộ (useState) và chỉ fetch đúng 1 lần lúc mount, khác với
// 5 Zustand store dùng chung (xem App.jsx) — nên không được hưởng cơ chế làm
// mới nền ở đó. Hook này áp cùng kiểu mẫu cho các trang loại này: gọi lại
// hàm fetch định kỳ + ngay khi quay lại tab, NHƯNG luôn ở chế độ "silent"
// (không bật cờ loading) để không làm nháy màn hình mỗi lần làm mới nền —
// khác hẳn lần fetch đầu tiên lúc mount vẫn cần hiện loading như cũ.
//
// Cách dùng: fetchFn phải nhận 1 tham số `silent` (boolean) và tự bỏ qua
// setLoading(true) khi silent === true, vd:
//   const fetchData = async (silent = false) => {
//     if (!silent) setLoading(true);
//     ...
//   };
//   useAutoRefresh(fetchData);
const BACKGROUND_REFRESH_INTERVAL_MS = 45000;
const MIN_REFRESH_GAP_MS = 15000;

export function useAutoRefresh(fetchFn, { enabled = true } = {}) {
  const fetchFnRef = useRef(fetchFn);
  fetchFnRef.current = fetchFn;

  useEffect(() => {
    if (!enabled) return;
    let lastRunAt = Date.now();
    let isRunning = false;
    const runSilentRefresh = () => {
      const now = Date.now();
      if (isRunning || now - lastRunAt < MIN_REFRESH_GAP_MS) return;
      isRunning = true;
      lastRunAt = now;
      Promise.resolve(fetchFnRef.current(true)).finally(() => { isRunning = false; });
    };

    const intervalId = setInterval(runSilentRefresh, BACKGROUND_REFRESH_INTERVAL_MS);
    const handleVisibility = () => { if (document.visibilityState === 'visible') runSilentRefresh(); };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', runSilentRefresh);
    window.addEventListener('online', runSilentRefresh);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', runSilentRefresh);
      window.removeEventListener('online', runSilentRefresh);
    };
  }, [enabled]);
}
