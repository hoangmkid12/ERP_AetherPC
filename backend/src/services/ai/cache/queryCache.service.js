/**
 * QUERY CACHE SERVICE - GIAI ĐOẠN 5: TỐI ƯU HIỆU NĂNG & PHẢN HỒI DƯỚI 10MS
 * 
 * Tính năng chính:
 * 1. Fast In-Memory LRU Cache cho các câu hỏi thường gặp.
 * 2. Phân cấp TTL thông minh:
 *    - Dữ liệu tĩnh (Quy chuẩn SOP, Chính sách, Hướng dẫn): TTL 10 phút.
 *    - Dữ liệu bán tĩnh (Danh mục sản phẩm, cấu hình): TTL 2 phút.
 *    - Dữ liệu động (Đơn hàng, Doanh thu, Tồn kho realtime): TTL 30 giây.
 * 3. Hỗ trợ cách ly cache theo vai trò (Role-Isolated Cache) và người dùng (User-Isolated).
 * 4. Thu thập chỉ số hiệu năng (Hits, Misses, Hit Ratio, Average Latency).
 */

class QueryCacheService {
  constructor(options = {}) {
    this.maxSize = options.maxSize || 500;
    this.defaultTtlMs = options.defaultTtlMs || 60 * 1000; // 60s
    this.cache = new Map(); // key -> { value, expiresAt, hits, createdAt }

    // Thống kê hiệu năng cache
    this.metrics = {
      hits: 0,
      misses: 0,
      totalQueries: 0,
      evictions: 0
    };

    // Tự động dọn dẹp cache hết hạn mỗi 30 giây
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired();
    }, 30 * 1000);

    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Tạo khóa cache chuẩn hóa
   */
  generateKey(prompt, role, userId = null, isPersonal = false) {
    const cleanPrompt = (prompt || '').toLowerCase().trim().replace(/\s+/g, ' ');
    const userScope = isPersonal && userId ? `:u_${userId}` : '';
    return `${role || 'GLOBAL'}${userScope}::${cleanPrompt}`;
  }

  /**
   * Xác định TTL tối ưu theo loại kỹ năng / dữ liệu
   */
  getTtlForSkill(skillType, intentId) {
    if (skillType === 'KNOWLEDGE_SOP' || (intentId && intentId.startsWith('SOP_'))) {
      return 10 * 60 * 1000; // 10 phút cho văn bản quy chế
    }
    if (intentId && (intentId.includes('PRICE') || intentId.includes('COMPATIBILITY') || intentId.includes('PROMOTION'))) {
      return 2 * 60 * 1000; // 2 phút cho giá và cấu hình
    }
    return 30 * 1000; // 30s cho dữ liệu thời gian thực (đơn hàng, doanh thu)
  }

  /**
   * Lấy kết quả từ cache nếu còn hạn
   */
  get(key) {
    this.metrics.totalQueries++;
    const entry = this.cache.get(key);

    if (!entry) {
      this.metrics.misses++;
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.metrics.misses++;
      return null;
    }

    entry.hits++;
    this.metrics.hits++;

    // Đưa key lên đầu (LRU update)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return {
      ...entry.value,
      fromCache: true,
      cacheAgeMs: Date.now() - entry.createdAt
    };
  }

  /**
   * Lưu kết quả vào cache
   */
  set(key, value, customTtlMs = null) {
    if (!key || !value) return;

    // Cơ chế LRU eviction khi vượt quá maxSize
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
      this.metrics.evictions++;
    }

    const ttl = customTtlMs || this.defaultTtlMs;
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttl,
      hits: 0,
      createdAt: Date.now()
    });
  }

  /**
   * Xóa toàn bộ cache hết hạn
   */
  cleanupExpired() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Xóa toàn bộ cache (khi có cập nhật lớn trên DB)
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Xóa cache theo vai trò cụ thể
   */
  invalidateByRole(role) {
    const prefix = `${role}::`;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Xuất báo cáo thống kê hiệu năng cache
   */
  getStats() {
    const total = this.metrics.totalQueries;
    const hitRate = total > 0 ? (this.metrics.hits / total) * 100 : 0;
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.metrics.hits,
      misses: this.metrics.misses,
      evictions: this.metrics.evictions,
      totalQueries: total,
      hitRate: Number(hitRate.toFixed(1))
    };
  }
}

// Singleton cache instance
const queryCache = new QueryCacheService();

module.exports = {
  QueryCacheService,
  queryCache
};
