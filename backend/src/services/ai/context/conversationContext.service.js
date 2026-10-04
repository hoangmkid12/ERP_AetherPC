/**
 * CONVERSATION CONTEXT SERVICE - GIAI ĐOẠN 4
 * Quản lý ngữ cảnh hội thoại nhiều lượt (Multi-turn Conversation Management)
 * 
 * Tính năng chính:
 * 1. Session Context Storage (In-memory LRU với cơ chế tự dọn dẹp TTL).
 * 2. Kế thừa thực thể qua các lượt (Entity Backfill).
 * 3. Xử lý hồi chỉ & đại từ tiếng Việt (Anaphora Resolution: "nó", "con này", "đơn đó"...).
 * 4. Xử lý câu hỏi tỉnh lược (Elliptical queries: "giá bao nhiêu?", "ai đang giao?").
 * 5. Yêu cầu làm rõ khi thiếu tham số bắt buộc (Clarification Prompting).
 */

class ConversationContextService {
  constructor(options = {}) {
    this.maxHistoryPerSession = options.maxHistory || 10;
    this.sessionTtlMs = options.ttlMs || 2 * 60 * 60 * 1000; // 2 giờ
    this.sessions = new Map(); // sessionId -> { lastActive, history: [] }

    // Dọn dẹp session hết hạn định kỳ mỗi 15 phút
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, 15 * 60 * 1000);

    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Dọn dẹp các session không hoạt động quá TTL
   */
  cleanupExpiredSessions() {
    const now = Date.now();
    for (const [sessionId, data] of this.sessions.entries()) {
      if (now - data.lastActive > this.sessionTtlMs) {
        this.sessions.delete(sessionId);
      }
    }
  }

  /**
   * Lấy lịch sử hội thoại của một session
   */
  getSession(sessionId) {
    if (!sessionId) return null;
    let session = this.sessions.get(sessionId);
    if (!session) {
      session = {
        sessionId,
        createdAt: Date.now(),
        lastActive: Date.now(),
        history: []
      };
      this.sessions.set(sessionId, session);
    } else {
      session.lastActive = Date.now();
    }
    return session;
  }

  /**
   * Ghi lại một lượt hội thoại vào Session
   */
  recordTurn(sessionId, turnData) {
    if (!sessionId) return;
    const session = this.getSession(sessionId);
    if (!session) return;

    const turn = {
      turnId: session.history.length + 1,
      timestamp: Date.now(),
      userPrompt: turnData.userPrompt || '',
      role: turnData.role || 'SALES',
      intent: turnData.intent || null,
      skillId: turnData.skillId || null,
      extractedParams: { ...(turnData.extractedParams || {}) },
      response: turnData.response || '',
      status: turnData.status || 'SUCCESS'
    };

    session.history.push(turn);

    // Giữ tối đa maxHistoryPerSession lượt
    if (session.history.length > this.maxHistoryPerSession) {
      session.history.shift();
    }
  }

  /**
   * Lấy danh sách lượt gần nhất (mới nhất xếp trước)
   */
  getRecentTurns(sessionId, limit = 5) {
    const session = this.getSession(sessionId);
    if (!session || !session.history.length) return [];
    return session.history.slice(-limit).reverse();
  }

  /**
   * Lấy thực thể gần nhất từ các lượt trước đó
   */
  findRecentEntity(sessionId, entityKey, maxLookback = 5) {
    const turns = this.getRecentTurns(sessionId, maxLookback);
    for (const turn of turns) {
      if (turn.extractedParams && turn.extractedParams[entityKey] !== undefined && turn.extractedParams[entityKey] !== null) {
        return turn.extractedParams[entityKey];
      }
    }
    return null;
  }

  /**
   * Phân tích và phát hiện từ hồi chỉ (Anaphora) trong câu hỏi
   */
  detectAnaphora(userPrompt) {
    const text = (userPrompt || '').toLowerCase();

    return {
      isProductAnaphora: /(nó|con này|con đó|cái này|cái đó|sản phẩm này|sản phẩm đó|mặt hàng này|mặt hàng đó|chiếc này|chiếc đó|card này|cpu này|ram này|vga này|main này)/i.test(text),
      isOrderAnaphora: /(đơn này|đơn đó|đơn hàng này|đơn hàng đó|kiện này|kiện đó|gói này|gói hàng này|đơn đấy)/i.test(text),
      isPoAnaphora: /(phiếu này|phiếu đó|đơn nhập này|đơn nhập đó|lô hàng này|lô này|lô nhập này)/i.test(text),
      isRmaAnaphora: /(phiếu bảo hành này|phiếu rma này|máy bảo hành này|case bảo hành này)/i.test(text),
      isShipperAnaphora: /(shipper này|tài xế này|người giao này|anh giao này)/i.test(text),
      isCustomerAnaphora: /(khách này|khách đó|người mua này|khách hàng này|bác này|chị này|anh này)/i.test(text),
      isWarehouseAnaphora: /(kho này|kho đó|chi nhánh này|chi nhánh đó)/i.test(text),
      isDateFollowUp: /^(thế còn|còn|thế|vậy còn|thế thì|vậy thì)\s+(hôm qua|hôm nay|tuần này|tháng này|tháng trước|năm nay)/i.test(text)
    };
  }

  /**
   * Phát hiện câu hỏi tỉnh lược (Elliptical queries)
   * Người dùng không nhắc đến thực thể nhưng câu hỏi hàm ý một thực thể cụ thể
   */
  detectEllipticalType(userPrompt) {
    const text = (userPrompt || '').toLowerCase().trim();

    // 1. Tỉnh lược về sản phẩm / linh kiện
    if (/^(giá bao nhiêu|bao nhiêu tiền|nhiêu tiền|bán bao nhiêu|còn hàng không|còn mấy cái|còn không|thông số thế nào|bảo hành bao lâu|bảo hành mấy năm|có sẵn không)\??$/i.test(text) ||
        /(giá bao nhiêu|bao nhiêu tiền|còn hàng không|còn mấy chiếc|còn mấy cái|thông số.*thế nào)/i.test(text)) {
      return 'PRODUCT';
    }

    // 2. Tỉnh lược về đơn hàng
    if (/(ai đang.*giao|ai giao|đã giao chưa|giao tới đâu|giao chưa|trả tiền chưa|thanh toán chưa|thu bao nhiêu tiền|tiền thu hộ|địa chỉ ở đâu|khi nào giao|tiến độ thế nào|đang ở đâu|khách nhận chưa)/i.test(text)) {
      return 'ORDER';
    }

    // 3. Tỉnh lược về phiếu nhập kho (PO)
    if (/^(đã duyệt chưa|nhập vào kho nào|tổng giá trị bao nhiêu|nhà cung cấp nào|bao giờ về hàng)\??$/i.test(text)) {
      return 'PO';
    }

    // 4. Tỉnh lược về phiếu bảo hành (RMA)
    if (/^(sửa xong chưa|lỗi gì|đã đổi mới chưa|trả khách chưa)\??$/i.test(text)) {
      return 'RMA';
    }

    return null;
  }

  /**
   * Bổ sung tham số từ các lượt trò chuyện trước (Backfilling)
   * @param {string} userPrompt - Câu hỏi hiện tại
   * @param {Object} currentParams - Các tham số đã trích xuất từ câu hỏi hiện tại
   * @param {string} sessionId - ID phiên trò chuyện
   * @param {Object} [options={}] - Các tùy chọn bổ sung
   */
  resolveContextAndBackfill(userPrompt, currentParams = {}, sessionId, options = {}) {
    const resolved = { ...currentParams };
    const anaphora = this.detectAnaphora(userPrompt);
    const ellipticalType = this.detectEllipticalType(userPrompt);
    const recentTurns = this.getRecentTurns(sessionId, 5);

    if (recentTurns.length === 0) {
      return { resolvedParams: resolved, inherited: {} };
    }

    const inherited = {};

    // 1. KẾ THỪA THỰC THỂ SẢN PHẨM (productName / keyword)
    if (!resolved.productName && !resolved.keyword) {
      if (anaphora.isProductAnaphora || ellipticalType === 'PRODUCT') {
        const lastProduct = this.findRecentEntity(sessionId, 'productName');
        if (lastProduct) {
          resolved.productName = lastProduct;
          inherited.productName = lastProduct;
        }
      }
    }

    // 2. KẾ THỪA MÃ ĐƠN HÀNG (orderId)
    if (!resolved.orderId) {
      if (anaphora.isOrderAnaphora || ellipticalType === 'ORDER') {
        const lastOrderId = this.findRecentEntity(sessionId, 'orderId');
        if (lastOrderId) {
          resolved.orderId = lastOrderId;
          inherited.orderId = lastOrderId;
        }
      }
    }

    // 3. KẾ THỪA MÃ PHIẾU NHẬP (poNumber)
    if (!resolved.poNumber) {
      if (anaphora.isPoAnaphora || ellipticalType === 'PO') {
        const lastPo = this.findRecentEntity(sessionId, 'poNumber');
        if (lastPo) {
          resolved.poNumber = lastPo;
          inherited.poNumber = lastPo;
        }
      }
    }

    // 4. KẾ THỪA MÃ BẢO HÀNH (rmaCode)
    if (!resolved.rmaCode) {
      if (anaphora.isRmaAnaphora || ellipticalType === 'RMA') {
        const lastRma = this.findRecentEntity(sessionId, 'rmaCode');
        if (lastRma) {
          resolved.rmaCode = lastRma;
          inherited.rmaCode = lastRma;
        }
      }
    }

    // 5. KẾ THỪA TÊN KHO (warehouseName)
    if (!resolved.warehouseName) {
      if (anaphora.isWarehouseAnaphora) {
        const lastWarehouse = this.findRecentEntity(sessionId, 'warehouseName');
        if (lastWarehouse) {
          resolved.warehouseName = lastWarehouse;
          inherited.warehouseName = lastWarehouse;
        }
      }
    }

    // 6. KẾ THỪA Ý ĐỊNH BÁO CÁO KHI HỎI NỐI TIẾP THỜI GIAN (Follow-up Date Query)
    // Ví dụ: Lượt 1 hỏi "Doanh thu hôm nay" -> Lượt 2 hỏi "Thế còn hôm qua?"
    if (anaphora.isDateFollowUp) {
      const lastTurn = recentTurns[0];
      if (lastTurn && lastTurn.skillId) {
        inherited.followUpSkillId = lastTurn.skillId;
      }
    }

    return {
      resolvedParams: resolved,
      inherited
    };
  }

  /**
   * Kiểm tra xem kỹ năng có bắt buộc tham số nào mà hiện tại đang bị thiếu không
   * Nếu thiếu, trả về câu hỏi làm rõ (Clarification Prompt)
   */
  checkClarificationNeeded(skill, params = {}, userPrompt = '') {
    if (!skill) return null;

    const skillId = skill.id;

    // 1. Kỹ năng tra cứu giá & tồn kho sản phẩm đơn lẻ
    if (['PRODUCT_PRICE_STOCK', 'HARDWARE_COMPATIBILITY'].includes(skillId)) {
      const hasProduct = Boolean(params.productName || params.keyword);
      // Nếu câu hỏi hoàn toàn không có tên sản phẩm và là câu hỏi chung chung cộc lốc
      const isGeneric = /^(giá bao nhiêu|bao nhiêu tiền|còn hàng không|còn mấy cái|báo giá|kiểm tra tồn kho)\??$/i.test(userPrompt.trim());
      if (!hasProduct && isGeneric) {
        return {
          type: 'MISSING_PARAM',
          missingParam: 'productName',
          message: '❓ **Bạn muốn tra cứu giá hoặc tồn kho của linh kiện / sản phẩm nào?**\n\n*(Ví dụ: Card RTX 4070 Super, CPU Intel i5-13400F, RAM Corsair DDR5, Nguồn Corsair 750W...)*'
        };
      }
    }

    // 2. Kỹ năng tra cứu tiến độ đơn hàng cụ thể
    if (['DELIVERY_TRACK_ORDER', 'ORDER_DETAIL_LOOKUP', 'DELIVERY_CHECK_SHIPPER', 'DELIVERY_CHECK_PAYMENT'].includes(skillId)) {
      if (!params.orderId && !params.phone) {
        const isGeneric = /(đơn hàng|tiến độ|giao tới đâu|ai giao|khách trả tiền chưa)/i.test(userPrompt);
        if (isGeneric) {
          return {
            type: 'MISSING_PARAM',
            missingParam: 'orderId',
            message: '📦 **Vui lòng cung cấp mã đơn hàng hoặc số điện thoại người nhận** để em tra cứu chính xác nhé!\n\n*(Ví dụ: DH-1002, ORD-1005 hoặc SĐT 0912345678)*'
          };
        }
      }
    }

    // 3. Kỹ năng tra cứu phiếu nhập kho
    if (['PO_LOOKUP_DETAIL', 'PO_CHECK_STATUS'].includes(skillId)) {
      if (!params.poNumber) {
        return {
          type: 'MISSING_PARAM',
          missingParam: 'poNumber',
          message: '📋 **Vui lòng cung cấp mã phiếu nhập hàng (PO)** cần kiểm tra!\n\n*(Ví dụ: PO-2026-001 hoặc PO-002)*'
        };
      }
    }

    // 4. Kỹ năng tra cứu phiếu bảo hành RMA
    if (['RMA_LOOKUP_DETAIL', 'RMA_CHECK_STATUS'].includes(skillId)) {
      if (!params.rmaCode) {
        return {
          type: 'MISSING_PARAM',
          missingParam: 'rmaCode',
          message: '🔧 **Vui lòng cung cấp mã phiếu tiếp nhận bảo hành RMA** để em kiểm tra tiến độ xử lý linh kiện nhé!\n\n*(Ví dụ: RMA-2026-01 hoặc RMA-005)*'
        };
      }
    }

    return null;
  }
}

// Singleton instance
const conversationContext = new ConversationContextService();

module.exports = {
  ConversationContextService,
  conversationContext
};
