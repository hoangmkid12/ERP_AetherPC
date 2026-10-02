const prisma = require('../config/database');
const { getToolsForRole } = require('../services/ai/tools.definition');
const { executeToolCall } = require('../services/ai/tools.executor');

// Khởi tạo Gemini client nếu có GEMINI_API_KEY
let GoogleGenAI = null;
let aiClient = null;

try {
  const genaiPkg = require('@google/genai');
  GoogleGenAI = genaiPkg.GoogleGenAI;
  if (process.env.GEMINI_API_KEY && GoogleGenAI) {
    aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
} catch (e) {
  // @google/genai optional fallback
}

// Prompt hệ thống chuẩn mực chống ảo giác và tuân thủ kiểm soát nội bộ
const SYSTEM_INSTRUCTION = `Bạn là AetherCopilot - Trợ lý Doanh nghiệp Thông minh của hệ thống AetherPC ERP (Chuyên bán lẻ linh kiện máy tính, lắp ráp PC Gaming/Workstation, bảo hành RMA, và giao vận).

NGUYÊN TẮC CỐT LÕI (BẮT BUỘC TUÂN THỦ):
1. BẢO MẬT & GROUNDING: Bạn chỉ được trả lời dựa trên thông tin chính xác từ các công cụ (Tools) được cung cấp. Tuyệt đối KHÔNG tự bịa đặt giá cả, mã đơn hàng, số tồn kho hay chính sách nếu không có dữ liệu trả về từ Tool.
2. NGUYÊN TẮC TRẢ LỜI TÀI LIỆU (KNOWLEDGE BASE): Khi trích dẫn chính sách, quy chế hoặc hướng dẫn, hãy nêu rõ tên tài liệu và điều khoản tương ứng để người dùng có thể đối chiếu.
3. PHÂN QUYỀN RBAC: Không bao giờ tiết lộ thông tin tài chính nhạy cảm hoặc bí mật doanh nghiệp cho người dùng không có thẩm quyền. Nếu kết quả trả về báo lỗi quyền (PERMISSION_DENIED), hãy thông báo lịch sự rằng người dùng cần liên hệ Ban Giám Đốc hoặc Admin để được cấp quyền.
4. PHONG CÁCH: Chuyên nghiệp, nhã nhặn, chuẩn tiếng Việt, sử dụng định dạng Markdown rõ ràng (in đậm, danh sách gạch đầu dòng, bảng nếu có).`;

// Danh sách câu hỏi gợi ý nhanh theo vai trò (Prompt Chips)
const ROLE_PROMPT_CHIPS = {
  SALES: [
    'Chính sách bảo hành và đổi trả 1 đổi 1 của công ty thế nào?',
    'Đơn hàng PC trên 50 triệu có mức chiết khấu gì?',
    'Kiểm tra tồn kho và giá card RTX 4070',
    'Cấu hình i5 13400 + RTX 4060 cần nguồn bao nhiêu Watt?'
  ],
  SALES_MANAGER: [
    'Quy chế duyệt chiết khấu cho khách VIP và B2B?',
    'Kiểm tra tồn kho linh kiện CPU và VGA hiện tại',
    'Chính sách bảo hành phần cứng trong 30 ngày đầu?',
    'Kiểm tra tiến độ đơn hàng gần nhất'
  ],
  WAREHOUSE: [
    'Quy chuẩn đóng gói thùng xốp và chèn túi khí PC khi xuất kho?',
    'Quy trình nộp và đối soát tiền mặt COD với kế toán?',
    'Kiểm tra tồn kho card đồ họa RTX 4070',
    'Tiêu chuẩn kiểm đếm linh kiện khi nhập kho'
  ],
  WAREHOUSE_MANAGER: [
    'Quy trình đối soát tiền COD của shipper với kế toán?',
    'Chính sách lưu kho và đóng gói an toàn linh kiện PC',
    'Kiểm tra tồn kho khả dụng các dòng card đồ họa',
    'Quy chuẩn bàn giao đơn hàng cho shipper'
  ],
  DELIVERY: [
    'Quy định chụp ảnh POD khi giao hàng cho khách?',
    'Quy trình nộp tiền mặt COD về kế toán trước mấy giờ?',
    'Khách quét VietQR chuyển khoản thì dùng tài khoản nào?',
    'Xử lý thế nào khi khách từ chối nhận hàng do móp hộp?'
  ],
  ACCOUNTANT: [
    'Báo cáo doanh thu thực tế hôm nay và số dư các tài khoản?',
    'Tài khoản VietQR mặc định của công ty hiện tại là tài khoản nào?',
    'Quy định phân nhiệm kiểm soát nội bộ (SoD) về tài khoản ngân hàng?',
    'Quy trình đối soát thu tiền COD từ shipper'
  ],
  CEO: [
    'Báo cáo nhanh doanh thu hôm nay và số dư ngân hàng',
    'Quy chế thưởng KPI và chi trả bảng lương hàng tháng?',
    'Chính sách bảo hành và thẩm định đổi trả RMA 1 đổi 1',
    'Nguyên tắc phân nhiệm SoD đối với tài khoản công ty'
  ],
  ADMIN: [
    'Quy định quản lý tài khoản ngân hàng doanh nghiệp và VietQR?',
    'Báo cáo tổng quan tài chính và doanh thu hôm nay',
    'Chính sách chiết khấu và duyệt giảm giá bán lẻ',
    'Tiêu chuẩn kỹ thuật lắp ráp và test benchmark PC'
  ]
};

// GET /api/v1/ai/prompt-chips
const getPromptChips = (req, res) => {
  const role = req.user?.role || 'SALES';
  const chips = ROLE_PROMPT_CHIPS[role] || ROLE_PROMPT_CHIPS.SALES;
  res.json({ success: true, role, chips });
};

// POST /api/v1/ai/chat
const chatWithAi = async (req, res, next) => {
  const startTime = Date.now();
  const { message, conversationHistory = [] } = req.body;
  const user = req.user || { role: 'SALES', name: 'Nhân viên' };

  if (!message || !message.trim()) {
    return res.status(400).json({ success: false, message: 'Nội dung câu hỏi không được để trống.' });
  }

  const promptText = message.trim();
  const allowedTools = getToolsForRole(user.role);
  let toolCallsExecuted = [];
  let finalAiResponse = '';
  let citations = [];

  try {
    // ------------------------------------------------------------------------
    // CÁCH 1: NẾU CÓ GEMINI_API_KEY VÀ SDK SẴN SÀNG -> GỌI LIVE GEMINI MODEL
    // ------------------------------------------------------------------------
    if (process.env.GEMINI_API_KEY && aiClient) {
      try {
        const response = await aiClient.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [
            ...conversationHistory.slice(-4).map(h => ({
              role: h.sender === 'USER' ? 'user' : 'model',
              parts: [{ text: h.content }]
            })),
            { role: 'user', parts: [{ text: promptText }] }
          ],
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            temperature: 0.2 // Giảm temperature để tăng tính chính xác, chống bịa đặt
          }
        });

        finalAiResponse = response.text || '';
      } catch (geminiErr) {
        console.warn('[AetherCopilot] Gemini API error, falling back to Intelligent Agent:', geminiErr.message);
      }
    }

    // ------------------------------------------------------------------------
    // CÁCH 2: LOCAL SEMANTIC AGENT (HOẠT ĐỘNG 100% KỂ CẢ KHI CHƯA NHẬP API KEY)
    // Phân tích ý định câu hỏi và tự động gọi các Tool thực tế
    // ------------------------------------------------------------------------
    if (!finalAiResponse) {
      const lower = promptText.toLowerCase();

      // Cảnh báo Bảo mật 0: Ngăn chặn tuyệt đối việc xin hoặc hỏi mật khẩu cá nhân / tài khoản nhân sự
      if (/(mật khẩu|pass|password).*(của|cho|là gì|nhân viên|shipper|admin|sales|kế toán|tài khoản)|(cho|xin|lấy|xem|biết).*(mật khẩu|pass|password)/.test(lower)) {
        finalAiResponse = `🔒 **Cảnh Báo Bảo Mật & An Toàn Thông Tin (Zero-Trust Security):**\n\n` +
          `- Hệ thống AetherCopilot **tuyệt đối không lưu trữ, không tra cứu và không thể cung cấp mật khẩu** của bất kỳ nhân sự hoặc tài khoản nào trong hệ thống.\n` +
          `- Toàn bộ mật khẩu của nhân viên (kể cả nhân viên giao hàng / Shipper) đều được mã hóa một chiều (Bcrypt Salted Hash) theo tiêu chuẩn an ninh dữ liệu.\n` +
          `- **Quy trình cấp lại:** Nếu nhân sự quên mật khẩu hoặc cần cấp mới, Quản trị viên (Admin) có thể thực hiện tại menu: **Quản Trị Hệ Thống > Tài Khoản & Người Dùng** (nút *Đổi Mật Khẩu*).\n\n` +
          `📄 *Căn cứ: Điều 2 - Quy tắc bảo mật tài khoản & đăng nhập (Chính sách Bảo Mật AetherPC)*`;
        citations.push({ title: 'Chính sách bảo mật', slug: 'chinh-sach-bao-mat', category: 'POLICY' });
      }

      // Ý định 0: Tra cứu số lượng / danh sách nhân sự (chỉ khi hỏi về số lượng, thống kê)
      else if (/(bao nhiêu|số lượng|thống kê|tổng số|danh sách).*(nhân viên|tài khoản|nhân sự)|(nhân viên|tài khoản nhân sự|nhân sự).*(bao nhiêu|số lượng|tổng số)/.test(lower)) {
        if (!['ADMIN', 'CEO', 'HR'].includes(user.role)) {
          finalAiResponse = `⚠️ **Từ chối truy cập:** Vai trò của bạn (**${user.role}**) không có thẩm quyền tra cứu dữ liệu nhân sự của công ty. Vui lòng liên hệ Quản trị viên (Admin) hoặc phòng Nhân sự.`;
        } else {
          const empCount = await prisma.employee.count({ where: { status: 'ACTIVE' } }).catch(() => 0);
          const totalEmp = await prisma.employee.count().catch(() => 0);
          const rolesGroup = await prisma.employee.groupBy({
            by: ['role'],
            _count: { id: true }
          }).catch(() => []);
          
          finalAiResponse = `👥 **Thống kê Tài Khoản & Nhân Sự AetherPC:**\n\n- **Tổng số tài khoản nhân viên:** **${totalEmp} tài khoản** (${empCount} nhân sự đang hoạt động ACTIVE)\n- **Phân bổ theo vai trò chức năng:**\n` +
            rolesGroup.map(r => `  • **${r.role}:** ${r._count.id} nhân sự`).join('\n') +
            `\n\n*Ghi chú: Bạn có thể xem và quản lý chi tiết danh sách tại menu **Quản Trị Hệ Thống > Tài Khoản & Người Dùng**.*`;
        }
      }

      // Ý định 1: Tra cứu chính sách, quy chế, bảo mật, bảo hành, đổi trả, chiết khấu, SOP, quy chuẩn đóng gói...
      else if (/bảo mật|mật khẩu|an ninh|an toàn|rò rỉ|bảo hành|đổi trả|1 đổi 1|chính sách|quy chế|chiết khấu|quy trình|tiêu chuẩn|quy chuẩn|đóng gói|hướng dẫn|thưởng|kpi|nộp tiền|đối soát|vietqr|sod|lắp ráp|benchmark|furmark|nghỉ việc|sa thải/.test(lower)) {
        const toolResult = await executeToolCall('lookup_knowledge_base', { query: promptText }, user);
        toolCallsExecuted.push({ tool: 'lookup_knowledge_base', params: { query: promptText }, result: toolResult });

        if (toolResult.found && toolResult.documents?.length > 0) {
          const doc = toolResult.documents[0];
          citations.push({ title: doc.title, slug: doc.slug, category: doc.category });
          const excerpt = (doc.relevantSection || doc.contentSnippet || '').trim();

          // Nếu có Gemini API Key, nhờ Gemini tóm tắt trả lời trực tiếp câu hỏi dựa trên đoạn trích xuất
          let synthesized = false;
          if (process.env.GEMINI_API_KEY && aiClient) {
            try {
              const aiGen = await aiClient.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [{
                  role: 'user',
                  parts: [{
                    text: `Bạn là trợ lý ERP AetherPC. Dựa trên trích đoạn tài liệu sau:\n"""\n${excerpt}\n"""\nHãy trả lời trực tiếp, rõ ràng và gãy gọn câu hỏi của nhân viên: "${promptText}". Không sao chép các phần không liên quan.`
                  }]
                }]
              });
              if (aiGen.text) {
                finalAiResponse = `${aiGen.text}\n\n📄 *Căn cứ văn bản: [${doc.title}](/admin/system?tab=knowledge&doc=${doc.slug})*`;
                synthesized = true;
              }
            } catch (e) {}
          }

          if (!synthesized) {
            finalAiResponse = `📋 **Quy định về "${promptText}" tại AetherPC:**\n\n${excerpt}\n\n📄 *Căn cứ văn bản: [${doc.title}](/admin/system?tab=knowledge&doc=${doc.slug})*`;
          }
        } else {
          finalAiResponse = `Không tìm thấy văn bản quy định hoặc chính sách nào phù hợp với yêu cầu "${promptText}". Vui lòng liên hệ Trưởng bộ phận hoặc Admin để được cập nhật tài liệu chính thức.`;
        }
      }

      // Ý định 2: Tra cứu tài chính, doanh thu, tài khoản ngân hàng
      else if (/doanh thu|tài chính|số dư|ngân hàng|mbbank|vcb|vietcombank|quỹ tiền|hôm nay kiếm được/.test(lower)) {
        const toolResult = await executeToolCall('get_finance_kpi', { period: 'TODAY' }, user);
        toolCallsExecuted.push({ tool: 'get_finance_kpi', params: { period: 'TODAY' }, result: toolResult });

        if (!toolResult.success && toolResult.error === 'PERMISSION_DENIED') {
          finalAiResponse = `⚠️ **Từ chối truy cập:** Vai trò của bạn (**${user.role}**) không có thẩm quyền tra cứu dữ liệu tài chính của doanh nghiệp. Vui lòng liên hệ Ban Giám Đốc (CEO) hoặc Kế Toán Trưởng.`;
        } else if (toolResult.data) {
          finalAiResponse = `📊 **Báo cáo Dòng Tiền & Tài Khoản Doanh Nghiệp (Hôm nay):**\n\n- **Doanh thu thực thu trong ngày:** **${toolResult.data.todayRevenue}**\n- **Tài khoản VietQR nhận tiền mặc định:** **${toolResult.data.defaultQrAccount}**\n- **Số lượng tài khoản hoạt động:** ${toolResult.data.activeBankCount} tài khoản.\n\n*Lưu ý: Dữ liệu được trích xuất từ Sổ cái kế toán thời gian thực theo chuẩn phân nhiệm SoD.*`;
        }
      }

      // Ý định 3: Kiểm tra tương thích linh kiện PC
      else if (/tương thích|socket|lắp vừa|nguồn bao nhiêu|nguồn.*watt|có đi cùng|lắp chung/.test(lower)) {
        // Tách sơ bộ linh kiện
        let cpuMatch = promptText.match(/i[3579]-?\d{4,5}[A-Z]?|ryzen\s?[3579]\s?\d{4}[A-Z]?/i)?.[0] || 'Intel Core i5-13400F';
        let mbMatch = promptText.match(/[hbz]\d{3}[A-Z]?|a620|b650|x670/i)?.[0] || 'B760M';
        let gpuMatch = promptText.match(/rtx\s?\d{4}[A-Z\s]*|gtx\s?\d{4}|rx\s?\d{4}[A-Z]*/i)?.[0] || 'RTX 4060';
        let psuMatch = parseInt(promptText.match(/(\d{3})\s?w/i)?.[1] || '0', 10);

        const compResult = executeToolCall('check_pc_compatibility', {
          cpuName: cpuMatch,
          mainboardName: mbMatch,
          gpuName: gpuMatch,
          psuWattage: psuMatch
        });
        toolCallsExecuted.push({ tool: 'check_pc_compatibility', result: compResult });

        finalAiResponse = `🔧 **Kết quả thẩm định tương thích linh kiện PC:**\n\n- **Cấu hình kiểm tra:** CPU ${cpuMatch} + Mainboard ${mbMatch} + Card ${gpuMatch} ${psuMatch > 0 ? `(Nguồn ${psuMatch}W)` : ''}\n- **Đánh giá:** **${compResult.summary}**\n\n${compResult.issues.length > 0 ? `⚠️ **Vấn đề cảnh báo:**\n` + compResult.issues.map(i => `- ${i}`).join('\n') + '\n\n' : ''}${compResult.notes.map(n => `✅ ${n}`).join('\n')}`;
      }

      // Ý định 4: Tra cứu đơn hàng
      else if (/đơn|đơn hàng|dh-|tiến độ|giao hàng|shipper/.test(lower)) {
        const orderMatch = promptText.match(/dh-?\d+|0\d{9}/i)?.[0] || promptText;
        const orderResult = await executeToolCall('lookup_order_status', { orderIdOrPhone: orderMatch }, user);
        toolCallsExecuted.push({ tool: 'lookup_order_status', params: { orderIdOrPhone: orderMatch }, result: orderResult });

        if (orderResult.found && orderResult.order) {
          const o = orderResult.order;
          finalAiResponse = `📦 **Thông tin Đơn hàng #${o.orderId}:**\n\n- **Trạng thái:** **${o.status}**\n- **Khách hàng:** ${o.customerName} (${o.customerPhone})\n- **Tổng giá trị:** ${o.totalAmount}\n- **Thanh toán:** ${o.paymentSummary}\n- **Shipper phụ trách:** ${o.shipper}\n- **Linh kiện trong đơn:** ${o.itemNames || 'Chi tiết đơn lẻ'}`;
        } else {
          finalAiResponse = `Không tìm thấy đơn hàng nào khớp với thông tin "${orderMatch}". Vui lòng kiểm tra lại Mã đơn hàng hoặc Số điện thoại người nhận.`;
        }
      }

      // Ý định 5: Tra cứu linh kiện & tồn kho sản phẩm
      else if (/rtx|gtx|intel|core|ryzen|ram|ddr4|ddr5|mainboard|ssd|màn hình|vga|cpu|nguồn|psu|tồn kho|còn hàng|giá bao nhiêu/.test(lower)) {
        const productResult = await executeToolCall('lookup_products', { keyword: promptText }, user);
        toolCallsExecuted.push({ tool: 'lookup_products', params: { keyword: promptText }, result: productResult });

        if (productResult.found && productResult.products?.length > 0) {
          finalAiResponse = `🔍 **Tìm thấy ${productResult.products.length} linh kiện phù hợp trong kho AetherPC:**\n\n` +
            productResult.products.map(p => 
              `- **${p.name}**\n  • Giá bán lẻ: **${p.retailPriceFormatted}**\n  • Tồn kho khả dụng: **${p.availableStock} sản phẩm** (${p.stockLocations || 'Kho chính'})\n  • Mã SKU: \`${p.sku || 'N/A'}\``
            ).join('\n\n');
        } else {
          finalAiResponse = `Hiện tại kho của AetherPC không tìm thấy linh kiện nào có tên "${promptText}". Bạn có thể kiểm tra danh mục trên trang Kho hoặc tạo Phiếu yêu cầu nhập hàng (PR).`;
        }
      }

      // Thử tra cứu Knowledge Base cho bất kỳ câu hỏi nào khác
      else {
        const fallbackKb = await executeToolCall('lookup_knowledge_base', { query: promptText }, user).catch(() => null);
        if (fallbackKb && fallbackKb.found && fallbackKb.documents?.length > 0) {
          const doc = fallbackKb.documents[0];
          toolCallsExecuted.push({ tool: 'lookup_knowledge_base', params: { query: promptText }, result: fallbackKb });
          citations.push({ title: doc.title, slug: doc.slug, category: doc.category });
          const excerpt = (doc.relevantSection || doc.contentSnippet || '').trim();
          finalAiResponse = `📋 **Quy định về "${promptText}" tại AetherPC:**\n\n${excerpt}\n\n📄 *Căn cứ văn bản: [${doc.title}](/admin/system?tab=knowledge&doc=${doc.slug})*`;
        } else {
          finalAiResponse = `Xin chào **${user.name || 'bạn'}**! Tôi là **AetherCopilot** - Trợ lý Doanh nghiệp AetherPC ERP.\n\nTôi có thể hỗ trợ bạn:\n- 📖 **Tra cứu quy trình & chính sách:** Bảo hành 1 đổi 1, chính sách bảo mật, chiết khấu VIP, đối soát COD.\n- 🔍 **Tra cứu linh kiện & tồn kho:** Kiểm tra số lượng tồn thực tế, vị trí ngăn kệ và giá bán lẻ.\n- ⚙️ **Kiểm tra tương thích cấu hình PC:** Socket CPU vs Mainboard, chuẩn RAM DDR4/DDR5, nguồn PSU.\n- 📦 **Tra cứu tiến độ đơn hàng:** Trạng thái giao vận, thông tin Shipper, đối soát thanh toán.\n${['CEO', 'ADMIN', 'ACCOUNTANT'].includes(user.role) ? '- 💰 **Báo cáo tài chính & VietQR:** Doanh thu hôm nay, số dư tài khoản ngân hàng công ty.\n' : ''}\nBạn cần tôi hỗ trợ việc gì ngay bây giờ?`;
        }
      }
    }

    const latencyMs = Date.now() - startTime;

    // Ghi vết vào bảng AiAuditLog để phục vụ kiểm toán an toàn thông tin
    await prisma.aiAuditLog.create({
      data: {
        userId: user.id || null,
        userEmail: user.email || 'internal@aetherpc.com',
        userName: user.fullName || user.name || 'Nhân viên ERP',
        userRole: user.role || 'SALES',
        userPrompt: promptText,
        toolCalls: toolCallsExecuted.length > 0 ? toolCallsExecuted : null,
        aiResponse: finalAiResponse,
        latencyMs,
        status: 'SUCCESS'
      }
    }).catch(err => console.warn('[AetherCopilot] Ghi Audit Log thất bại:', err.message));

    res.json({
      success: true,
      data: {
        reply: finalAiResponse,
        response: finalAiResponse,
        citations,
        toolCalls: toolCallsExecuted.map(t => t.tool),
        latencyMs
      }
    });
  } catch (err) {
    const latencyMs = Date.now() - startTime;

    await prisma.aiAuditLog.create({
      data: {
        userId: user.id || null,
        userEmail: user.email || null,
        userName: user.fullName || user.name || null,
        userRole: user.role || null,
        userPrompt: promptText,
        toolCalls: null,
        aiResponse: null,
        latencyMs,
        status: 'ERROR',
        errorMessage: err.message
      }
    }).catch(() => {});

    next(err);
  }
};

// GET /api/v1/ai/audit-logs (Chỉ Admin / CEO)
const getAiAuditLogs = async (req, res, next) => {
  try {
    const logs = await prisma.aiAuditLog.findMany({
      take: 50,
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: logs });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  chatWithAi,
  getPromptChips,
  getAiAuditLogs
};
