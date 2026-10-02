/**
 * Định nghĩa danh mục công cụ (Tool Definitions / Function Calling Schema)
 * dành cho Trợ lý Doanh Nghiệp AetherCopilot (Google Gemini & OpenAI standard).
 */

const ALL_TOOL_DEFINITIONS = [
  {
    name: 'lookup_knowledge_base',
    description: 'Tra cứu quy định, chính sách bảo hành, thẩm định đổi trả RMA 1 đổi 1, quy chế chiết khấu bán hàng, quy chuẩn kỹ thuật lắp ráp PC, hoặc hướng dẫn vận hành ERP nội bộ của AetherPC.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: {
          type: 'STRING',
          description: 'Từ khóa hoặc câu hỏi cần tra cứu chính sách (ví dụ: "chính sách đổi trả vga", "chiết khấu khách vip", "tiêu chuẩn test benchmark", "đối soát cod shipper")'
        },
        category: {
          type: 'STRING',
          enum: ['WARRANTY_RMA', 'SALES_POLICY', 'WAREHOUSE_LOGISTICS', 'TECHNICAL_SOP', 'ERP_MANUAL', 'GENERAL', 'ALL'],
          description: 'Chuyên mục tài liệu cần tra cứu (để trống hoặc ALL nếu tìm toàn bộ)'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'lookup_products',
    description: 'Tra cứu danh mục linh kiện máy tính, cấu hình PC, kiểm tra số lượng tồn kho thực tế, giá bán niêm yết và thông số kỹ thuật (Socket, RAM, TDP, VRAM...).',
    parameters: {
      type: 'OBJECT',
      properties: {
        keyword: {
          type: 'STRING',
          description: 'Tên linh kiện, model hoặc từ khóa (ví dụ: "RTX 4070", "i5 13400", "B760", "DDR5 32GB", "Nguồn 750W")'
        },
        categorySlug: {
          type: 'STRING',
          description: 'Slug danh mục linh kiện nếu có (ví dụ: "vga", "cpu", "mainboard", "ram", "psu-nguon")'
        }
      },
      required: ['keyword']
    }
  },
  {
    name: 'check_pc_compatibility',
    description: 'Kiểm tra tính tương thích giữa các linh kiện trong dàn PC custom: Socket CPU vs Mainboard, chuẩn RAM DDR4/DDR5, công suất nguồn PSU khuyến nghị tối thiểu cho CPU + GPU.',
    parameters: {
      type: 'OBJECT',
      properties: {
        cpuName: { type: 'STRING', description: 'Tên CPU (ví dụ: "Intel Core i5-13400F", "Ryzen 5 7600X")' },
        mainboardName: { type: 'STRING', description: 'Tên Mainboard (ví dụ: "ASUS TUF B760M-PLUS", "MSI B650M")' },
        ramType: { type: 'STRING', description: 'Chuẩn RAM (ví dụ: "DDR4" hoặc "DDR5")' },
        gpuName: { type: 'STRING', description: 'Tên Card đồ họa (ví dụ: "RTX 4070 SUPER", "RTX 3060")' },
        psuWattage: { type: 'NUMBER', description: 'Công suất nguồn dự kiến tính bằng Watt (ví dụ: 650, 750, 850)' }
      }
    }
  },
  {
    name: 'lookup_order_status',
    description: 'Tra cứu thông tin tiến độ đơn hàng, trạng thái thanh toán (COD/VietQR), lộ trình giao hàng của Shipper và danh sách linh kiện trong đơn theo Mã đơn hàng hoặc Số điện thoại khách.',
    parameters: {
      type: 'OBJECT',
      properties: {
        orderIdOrPhone: {
          type: 'STRING',
          description: 'Mã đơn hàng (ví dụ: "DH-1002" hoặc số ID) hoặc Số điện thoại của khách hàng'
        }
      },
      required: ['orderIdOrPhone']
    }
  },
  {
    name: 'get_my_delivery_tasks',
    description: 'Đếm các đơn giao hàng chưa hoàn tất đang được phân công cho shipper hiện đăng nhập. Không nhận ID nhân viên từ người dùng.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'get_my_profile_and_tasks',
    description: 'Tra cứu hồ sơ cá nhân, chỉ số KPI/doanh số bán hàng, ca làm việc, hoặc nhiệm vụ/đơn hàng đang phụ trách của chính nhân viên đang đăng nhập. Không nhận ID nhân viên từ người dùng (tự động gắn theo token đăng nhập).',
    parameters: {
      type: 'OBJECT',
      properties: {
        period: {
          type: 'STRING',
          enum: ['TODAY', 'THIS_MONTH', 'OVERALL'],
          description: 'Khoảng thời gian thống kê số liệu cá nhân (hôm nay, tháng này hoặc toàn bộ)'
        }
      }
    }
  },
  {
    name: 'get_finance_kpi',
    description: 'Tra cứu nhanh tổng quan tài chính: Doanh thu thực tế, số dư quỹ tiền mặt và số dư các tài khoản ngân hàng doanh nghiệp (VietQR/MBBank/VCB). LƯU Ý: Chỉ dành riêng cho CEO, Admin và Kế Toán.',
    parameters: {
      type: 'OBJECT',
      properties: {
        period: {
          type: 'STRING',
          enum: ['TODAY', 'THIS_MONTH', 'OVERALL'],
          description: 'Khoảng thời gian cần xem (hôm nay, tháng này hoặc toàn thời gian)'
        }
      }
    }
  }
];

// Hàm lọc Tool Manifest theo vai trò người dùng (Dynamic Tool Filtering)
const getToolsForRole = (userRole) => {
  const SENSITIVE_FINANCE_ROLES = ['CEO', 'ADMIN', 'ACCOUNTANT'];
  
  return ALL_TOOL_DEFINITIONS.filter(tool => {
    // Nếu là tool tài chính nhạy cảm, chỉ cung cấp cho CEO, ADMIN, ACCOUNTANT
    if (tool.name === 'get_finance_kpi') {
      return SENSITIVE_FINANCE_ROLES.includes(userRole);
    }
    if (tool.name === 'get_my_delivery_tasks') {
      return userRole === 'DELIVERY';
    }
    return true;
  });
};

module.exports = {
  ALL_TOOL_DEFINITIONS,
  getToolsForRole
};
