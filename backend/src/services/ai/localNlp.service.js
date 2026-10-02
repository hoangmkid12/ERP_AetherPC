const fs = require('fs');
const path = require('path');
const { NlpManager } = require('node-nlp');

let manager = null;
let isModelReady = false;

const MODEL_PATH = path.join(__dirname, 'model.nlp');
const DATASET_PATH = path.join(__dirname, '../../../../ai_training/dataset_intent.json');

/**
 * Đăng ký các thực thể đặc trưng ERP vào bộ nhận diện thực thể (NER - Named Entity Recognition)
 */
const registerErpEntities = (nlpManager) => {
  // 1. Thực thể Trạng thái đơn hàng (orderStatus)
  nlpManager.addNamedEntityText('orderStatus', 'SHIPPED', ['vi'], ['đang giao', 'đang ship', 'trên đường giao', 'shipped', 'đang đi giao']);
  nlpManager.addNamedEntityText('orderStatus', 'READY_TO_SHIP', ['vi'], ['chờ giao', 'chờ ship', 'chờ lấy hàng', 'ready to ship', 'đóng gói xong']);
  nlpManager.addNamedEntityText('orderStatus', 'COMPLETED', ['vi'], ['đã giao', 'giao thành công', 'hoàn tất', 'completed', 'delivered']);
  nlpManager.addNamedEntityText('orderStatus', 'CANCELLED', ['vi'], ['bị hủy', 'hủy đơn', 'cancelled', 'đã hủy']);
  nlpManager.addNamedEntityText('orderStatus', 'AWAITING_STOCK', ['vi'], ['chờ hàng', 'chờ nhập hàng', 'thiếu hàng', 'awaiting stock']);

  // 2. Thực thể Hãng linh kiện (brand)
  nlpManager.addNamedEntityText('brand', 'ASUS', ['vi'], ['asus', 'rog', 'tuf']);
  nlpManager.addNamedEntityText('brand', 'MSI', ['vi'], ['msi', 'mag', 'mpg']);
  nlpManager.addNamedEntityText('brand', 'GIGABYTE', ['vi'], ['gigabyte', 'aorus']);
  nlpManager.addNamedEntityText('brand', 'INTEL', ['vi'], ['intel', 'core i3', 'core i5', 'core i7', 'core i9']);
  nlpManager.addNamedEntityText('brand', 'AMD', ['vi'], ['amd', 'ryzen 5', 'ryzen 7', 'ryzen 9']);
  nlpManager.addNamedEntityText('brand', 'CORSAIR', ['vi'], ['corsair']);
  nlpManager.addNamedEntityText('brand', 'KINGSTON', ['vi'], ['kingston', 'fury']);
  nlpManager.addNamedEntityText('brand', 'SAMSUNG', ['vi'], ['samsung']);
  nlpManager.addNamedEntityText('brand', 'LOGITECH', ['vi'], ['logitech']);

  // 3. Thực thể Trạng thái tồn kho (stockStatus)
  nlpManager.addNamedEntityText('stockStatus', 'OUT_OF_STOCK', ['vi'], ['hết hàng', 'tồn bằng 0', 'tồn = 0', 'hết tồn', 'cháy hàng']);
  nlpManager.addNamedEntityText('stockStatus', 'LOW_STOCK', ['vi'], ['sắp hết hàng', 'tồn kho thấp', 'cảnh báo tồn', 'sắp hết']);

  // 4. Thực thể Loại tài liệu / Nghiệp vụ tổng hợp (domainTopic)
  nlpManager.addNamedEntityText('domainTopic', 'RMA', ['vi'], ['đổi trả', 'rma', 'bảo hành', 'phiếu bảo hành']);
  nlpManager.addNamedEntityText('domainTopic', 'COMPLAINT', ['vi'], ['khiếu nại', 'ticket', 'phàn nàn', 'khẩn cấp']);
  nlpManager.addNamedEntityText('domainTopic', 'SUPPLIER', ['vi'], ['nhà cung cấp', 'ncc', 'supplier']);
  nlpManager.addNamedEntityText('domainTopic', 'PURCHASE_ORDER', ['vi'], ['nhập hàng', 'mua hàng', 'purchase order', 'po']);
  nlpManager.addNamedEntityText('domainTopic', 'VIP_CUSTOMER', ['vi'], ['khách hàng vip', 'khách vip', 'mua nhiều nhất', 'điểm cao nhất']);
};

/**
 * Khởi tạo và nạp mô hình AI tự huấn luyện (Self-Trained Local NLP Model)
 */
const initLocalNlpModel = async () => {
  if (isModelReady && manager) return manager;

  try {
    manager = new NlpManager({ languages: ['vi', 'en'], forceNER: true, nlu: { log: false } });
    registerErpEntities(manager);

    if (fs.existsSync(MODEL_PATH)) {
      console.log('[SelfTrainedAI] Đang nạp trọng số mô hình đã huấn luyện từ model.nlp...');
      manager.load(MODEL_PATH);
      isModelReady = true;
      console.log('✅ [SelfTrainedAI] Đã nạp thành công mô hình NLP tự huấn luyện cục bộ!');
    } else if (fs.existsSync(DATASET_PATH)) {
      console.log('[SelfTrainedAI] Chưa có file model.nlp, tự động huấn luyện trên dataset_intent.json...');
      const rawData = JSON.parse(fs.readFileSync(DATASET_PATH, 'utf8'));
      rawData.forEach(item => {
        manager.addDocument('vi', item.text, item.intent);
      });
      await manager.train();
      manager.save(MODEL_PATH);
      isModelReady = true;
      console.log('✅ [SelfTrainedAI] Huấn luyện hoàn tất và đã lưu model.nlp!');
    }
  } catch (err) {
    console.warn('[SelfTrainedAI] Không thể khởi tạo mô hình cục bộ:', err.message);
  }

  return manager;
};

// Tự động nạp khi module được require
initLocalNlpModel().catch(() => {});

/**
 * Phân loại ý định bằng Mô hình AI tự huấn luyện (Self-Trained Model Inference)
 * @param {string} promptText 
 * @returns {Promise<{intent: string, confidence: number, entities: any}|null>}
 */
const classifyIntentLocal = async (promptText) => {
  if (!promptText || !promptText.trim()) return null;

  try {
    if (!isModelReady || !manager) {
      await initLocalNlpModel();
    }
    if (!manager) return null;

    const result = await manager.process('vi', promptText.trim());
    if (result && result.intent && result.intent !== 'None') {
      return {
        intent: result.intent,
        confidence: Number(result.score || 0),
        entities: result.entities || []
      };
    }
  } catch (err) {
    console.warn('[SelfTrainedAI] Inference error:', err.message);
  }

  return null;
};

/**
 * Trích xuất khe thực thể (Slot/Entity Extraction) và sinh câu lệnh SQL động
 * @param {string} promptText 
 * @returns {Promise<{sql: string, intent: string, slots: Object}|null>}
 */
const extractSlotsAndGenerateSql = async (promptText) => {
  if (!promptText || !promptText.trim()) return null;

  try {
    if (!isModelReady || !manager) {
      await initLocalNlpModel();
    }
    if (!manager) return null;

    const result = await manager.process('vi', promptText.trim());
    const entities = result.entities || [];

    // Bóc tách các khe (Slots) từ thực thể AI nhận diện
    const slots = {
      orderStatus: null,
      brand: null,
      stockStatus: null,
      domainTopic: null,
      limitNum: null,
      isTopAgg: false,
      isGroupStatus: false
    };

    entities.forEach(ent => {
      if (ent.entity === 'orderStatus') slots.orderStatus = ent.option;
      if (ent.entity === 'brand') slots.brand = ent.option;
      if (ent.entity === 'stockStatus') slots.stockStatus = ent.option;
      if (ent.entity === 'domainTopic') slots.domainTopic = ent.option;
      if (ent.entity === 'number') {
        const num = parseInt(ent.resolution?.strValue || ent.utteranceText, 10);
        if (!isNaN(num) && num > 0) slots.limitNum = Math.min(num, 25);
      }
    });

    const lower = promptText.toLowerCase();

    // Nhận diện số lượng nếu chưa có trong entities
    if (!slots.limitNum) {
      const matchNum = lower.match(/(\d+)/);
      if (matchNum) {
        slots.limitNum = Math.min(parseInt(matchNum[1], 10), 25);
      }
    }

    // Nhận diện xem câu hỏi có phải dạng xếp hạng Top hoặc Thống kê nhóm
    if (/(top|giá trị cao|nhiều tiền|cao nhất|lớn nhất)/.test(lower)) {
      slots.isTopAgg = true;
    }
    if (/(thống kê|tổng số|bao nhiêu đơn).*(trạng thái|status)/.test(lower) || /(từng trạng thái|mỗi trạng thái)/.test(lower)) {
      slots.isGroupStatus = true;
    }

    // SINH SQL DỰA TRÊN SLOTS ĐÃ TRÍCH XUẤT:
    
    // 0. Doanh thu & Tài chính theo mốc thời gian (năm nay, tháng này, quý này, hôm nay, từng tháng...)
    if (/(doanh thu|doanh số|tiền thu|thu được)/.test(lower)) {
      if (/(năm nay|cả năm|năm 2026)/.test(lower)) {
        return {
          sql: `SELECT SUM(total_amount) AS doanh_thu_nam_nay FROM orders WHERE status IN ('DELIVERED', 'COMPLETED') AND created_at >= date_trunc('year', now() AT TIME ZONE 'Asia/Ho_Chi_Minh');`,
          intent: 'FINANCE_REPORT',
          slots
        };
      }
      if (/(tháng trước)/.test(lower)) {
        return {
          sql: `SELECT SUM(total_amount) AS doanh_thu_thang_truoc FROM orders WHERE status IN ('DELIVERED', 'COMPLETED') AND created_at >= date_trunc('month', now() AT TIME ZONE 'Asia/Ho_Chi_Minh') - INTERVAL '1 month' AND created_at < date_trunc('month', now() AT TIME ZONE 'Asia/Ho_Chi_Minh');`,
          intent: 'FINANCE_REPORT',
          slots
        };
      }
      if (/(tháng này|trong tháng)/.test(lower)) {
        return {
          sql: `SELECT SUM(total_amount) AS doanh_thu_thang_nay FROM orders WHERE status IN ('DELIVERED', 'COMPLETED') AND created_at >= date_trunc('month', now() AT TIME ZONE 'Asia/Ho_Chi_Minh');`,
          intent: 'FINANCE_REPORT',
          slots
        };
      }
      if (/(quý này|quý)/.test(lower)) {
        return {
          sql: `SELECT SUM(total_amount) AS doanh_thu_quy_nay FROM orders WHERE status IN ('DELIVERED', 'COMPLETED') AND created_at >= date_trunc('quarter', now() AT TIME ZONE 'Asia/Ho_Chi_Minh');`,
          intent: 'FINANCE_REPORT',
          slots
        };
      }
      if (/(hôm qua)/.test(lower)) {
        return {
          sql: `SELECT SUM(total_amount) AS doanh_thu_hom_qua FROM orders WHERE status IN ('DELIVERED', 'COMPLETED') AND created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Ho_Chi_Minh') - INTERVAL '1 day' AND created_at < date_trunc('day', now() AT TIME ZONE 'Asia/Ho_Chi_Minh');`,
          intent: 'FINANCE_REPORT',
          slots
        };
      }
      if (/(hôm nay|trong ngày)/.test(lower)) {
        return {
          sql: `SELECT SUM(total_amount) AS doanh_thu_hom_nay FROM orders WHERE status IN ('DELIVERED', 'COMPLETED') AND created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Ho_Chi_Minh');`,
          intent: 'FINANCE_REPORT',
          slots
        };
      }
      if (/(từng tháng|mỗi tháng)/.test(lower)) {
        return {
          sql: `SELECT to_char(created_at, 'YYYY-MM') AS thang, COUNT(*) AS so_don, SUM(total_amount) AS doanh_thu FROM orders WHERE status IN ('DELIVERED', 'COMPLETED') AND created_at >= date_trunc('year', now() AT TIME ZONE 'Asia/Ho_Chi_Minh') GROUP BY thang ORDER BY thang ASC;`,
          intent: 'FINANCE_REPORT',
          slots
        };
      }
      // Mặc định doanh thu năm nay nếu không rõ mốc
      return {
        sql: `SELECT SUM(total_amount) AS doanh_thu_nam_nay FROM orders WHERE status IN ('DELIVERED', 'COMPLETED') AND created_at >= date_trunc('year', now() AT TIME ZONE 'Asia/Ho_Chi_Minh');`,
        intent: 'FINANCE_REPORT',
        slots
      };
    }

    // 1. Thống kê theo trạng thái
    if (slots.isGroupStatus) {
      return {
        sql: `SELECT status, COUNT(*) AS so_luong, SUM(total_amount) AS tong_gia_tri FROM orders GROUP BY status ORDER BY so_luong DESC;`,
        intent: result.intent,
        slots
      };
    }

    // 2. Tra cứu đơn hàng theo Trạng thái (đang giao, chờ giao, hoàn tất, bị hủy...)
    if (slots.orderStatus) {
      const limit = slots.limitNum || 15;
      const orderCol = slots.isTopAgg ? 'total_amount DESC' : 'created_at DESC';
      return {
        sql: `SELECT order_id, total_amount, shipping_address, status, created_at FROM orders WHERE status = '${slots.orderStatus}' ORDER BY ${orderCol} LIMIT ${limit};`,
        intent: result.intent,
        slots
      };
    }

    // 3. Top đơn hàng giá trị cao
    if (slots.isTopAgg && /đơn/.test(lower)) {
      const limit = slots.limitNum || 5;
      return {
        sql: `SELECT order_id, total_amount, payment_method, status, created_at FROM orders ORDER BY total_amount DESC LIMIT ${limit};`,
        intent: result.intent,
        slots
      };
    }

    // 4. Tồn kho linh kiện (hết hàng, sắp hết...)
    if (slots.stockStatus === 'OUT_OF_STOCK') {
      return {
        sql: `SELECT product_id, name, price, stock_quantity, status FROM products WHERE stock_quantity = 0 AND status = 'ACTIVE' LIMIT 15;`,
        intent: result.intent,
        slots
      };
    }
    if (slots.stockStatus === 'LOW_STOCK') {
      return {
        sql: `SELECT product_id, name, price, stock_quantity FROM products WHERE stock_quantity < 5 AND status = 'ACTIVE' ORDER BY stock_quantity ASC LIMIT 15;`,
        intent: result.intent,
        slots
      };
    }

    // 5. Linh kiện theo Hãng sản xuất (ASUS, MSI, GIGABYTE, INTEL...)
    if (slots.brand) {
      const limit = slots.limitNum || 12;
      return {
        sql: `SELECT p.product_id, p.name, p.price, p.stock_quantity FROM products p JOIN brands b ON p.brand_id = b.id WHERE b.name ILIKE '%${slots.brand}%' AND p.status = 'ACTIVE' LIMIT ${limit};`,
        intent: result.intent,
        slots
      };
    }

    // 6. Các nghiệp vụ chuyên biệt khác (RMA, Complaint, Supplier, PO)
    if (slots.domainTopic === 'RMA') {
      return {
        sql: `SELECT rma_code, order_id, type, reason, status, refund_amount, created_at FROM return_requests ORDER BY created_at DESC LIMIT 10;`,
        intent: result.intent,
        slots
      };
    }
    if (slots.domainTopic === 'COMPLAINT') {
      return {
        sql: `SELECT ticket_code, subject, priority, status, created_at FROM complaints ORDER BY created_at DESC LIMIT 10;`,
        intent: result.intent,
        slots
      };
    }
    if (slots.domainTopic === 'SUPPLIER') {
      return {
        sql: `SELECT code, name, phone, email, status FROM suppliers WHERE status = 'ACTIVE' LIMIT 15;`,
        intent: result.intent,
        slots
      };
    }
    if (slots.domainTopic === 'PURCHASE_ORDER') {
      return {
        sql: `SELECT po_number, supplier_code, total_amount, status, created_at FROM purchase_orders ORDER BY created_at DESC LIMIT 10;`,
        intent: result.intent,
        slots
      };
    }
    if (slots.domainTopic === 'VIP_CUSTOMER') {
      return {
        sql: `SELECT customer_id, name, phone, city, tier, loyalty_points FROM customers ORDER BY loyalty_points DESC LIMIT 10;`,
        intent: result.intent,
        slots
      };
    }

  } catch (err) {
    console.warn('[SelfTrainedAI] Slot extraction error:', err.message);
  }

  return null;
};

module.exports = {
  initLocalNlpModel,
  classifyIntentLocal,
  extractSlotsAndGenerateSql,
  registerErpEntities
};
