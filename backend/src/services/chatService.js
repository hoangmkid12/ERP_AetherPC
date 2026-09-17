const prisma = require('../config/database');

// Định dạng 1 tin nhắn cho client — dùng chung ở mọi hàm trả về session bên
// dưới để tránh lặp lại (và lỡ quên field) ở 4 nơi khác nhau. `timestamp` là
// mốc ISO thật (khác `time` chỉ để hiển thị) — cần cho việc so sánh với
// customerLastReadAt/staffLastReadAt để suy ra trạng thái Đã gửi/Đã nhận/Đã
// xem (kiểu Zalo) ở phía frontend.
const formatMessage = (msg) => ({
  sender: msg.sender,
  text: msg.text,
  time: msg.timestamp.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
  timestamp: msg.timestamp.toISOString(),
  senderName: msg.senderName
});

/**
 * Get all active chat sessions from database
 * @returns {Promise<Array>} Array of chat sessions with messages
 */
const getAllSessions = async (onlineSessionIds = new Set()) => {
  try {
    const sessions = await prisma.chatSession.findMany({
      // Chỉ liệt kê phiên đã có ÍT NHẤT 1 tin nhắn thật — CLIENT_IDENTIFY (gửi
      // ngay khi widget chat kết nối WebSocket, kể cả khi khách chưa gõ gì)
      // trước đây upsert tạo sẵn 1 dòng ChatSession rỗng, khiến CSKH thấy
      // "khách đang chat" dù họ chưa từng gửi tin nào. Lọc ở đây chặn luôn cả
      // các dòng rỗng cũ đã lỡ tạo trước khi sửa markSessionOnlineIfExists.
      where: { messages: { some: {} } },
      include: {
        messages: {
          orderBy: { timestamp: 'asc' }
        }
      },
      orderBy: { lastActivityAt: 'desc' }
    });

    return sessions.map(session => {
      const isOnline = onlineSessionIds instanceof Set
        ? onlineSessionIds.has(session.sessionId)
        : session.status === 'ONLINE';

      return {
        id: session.sessionId,
        sessionId: session.sessionId,
        customerName: session.customerName,
        status: isOnline ? 'ONLINE' : 'OFFLINE',
        isOnline,
        customerLastReadAt: session.customerLastReadAt ? session.customerLastReadAt.toISOString() : null,
        staffLastReadAt: session.staffLastReadAt ? session.staffLastReadAt.toISOString() : null,
        messages: session.messages.map(formatMessage)
      };
    });
  } catch (err) {
    console.error('[ChatService] Error getting sessions:', err);
    return [];
  }
};

/**
 * Get a specific chat session by session ID
 * @param {string} sessionId 
 * @returns {Promise<Object|null>}
 */
const getSessionById = async (sessionId) => {
  try {
    const session = await prisma.chatSession.findUnique({
      where: { sessionId },
      include: {
        messages: {
          orderBy: { timestamp: 'asc' }
        }
      }
    });

    if (!session) return null;

    return {
      id: session.sessionId,
      sessionId: session.sessionId,
      customerName: session.customerName,
      status: session.status,
      customerLastReadAt: session.customerLastReadAt ? session.customerLastReadAt.toISOString() : null,
      staffLastReadAt: session.staffLastReadAt ? session.staffLastReadAt.toISOString() : null,
      messages: session.messages.map(formatMessage)
    };
  } catch (err) {
    console.error('[ChatService] Error getting session:', err);
    return null;
  }
};

/**
 * Create or update a chat session
 * @param {string} sessionId 
 * @param {string} customerName 
 * @param {string} customerId 
 * @param {string} status 
 * @returns {Promise<Object>}
 */
const createOrUpdateSession = async (sessionId, customerName, customerId = null, status = 'ONLINE') => {
  try {
    let name = customerName || 'Khách Hàng Vãng Lai';
    if (!name || name.includes('undefined')) {
      name = 'Khách Hàng Vãng Lai';
    }

    const session = await prisma.chatSession.upsert({
      where: { sessionId },
      update: {
        status,
        lastActivityAt: new Date()
      },
      create: {
        sessionId,
        customerName: name,
        customerId,
        status,
        startedAt: new Date(),
        lastActivityAt: new Date()
      },
      include: {
        messages: {
          orderBy: { timestamp: 'asc' }
        }
      }
    });

    return {
      id: session.sessionId,
      sessionId: session.sessionId,
      customerName: session.customerName,
      status: session.status,
      customerLastReadAt: session.customerLastReadAt ? session.customerLastReadAt.toISOString() : null,
      staffLastReadAt: session.staffLastReadAt ? session.staffLastReadAt.toISOString() : null,
      messages: session.messages.map(formatMessage)
    };
  } catch (err) {
    console.error('[ChatService] Error creating/updating session:', err);
    throw err;
  }
};

/**
 * Đánh dấu 1 phiên đang ONLINE — CHỈ khi phiên đó đã tồn tại thật (đã từng
 * gửi ít nhất 1 tin nhắn). Dùng cho CLIENT_IDENTIFY, bắn ngay khi widget chat
 * mở kết nối WebSocket — trước khi khách gõ gì cả — nên KHÔNG được phép tạo
 * mới bản ghi (khác createOrUpdateSession dùng upsert, sẽ tạo 1 dòng rỗng và
 * làm CSKH tưởng khách đang chat dù họ chưa gửi tin nào).
 * Kèm theo toàn bộ lịch sử tin nhắn (định dạng giống createOrUpdateSession) để
 * websocketService có thể gửi thẳng lại lịch sử cho đúng client vừa identify —
 * trước đây INIT_SESSIONS chỉ trả sessions=[] cho khách (không phải staff),
 * nên khách mở lại khung chat không thấy tin nhắn cũ, phải gửi 1 tin mới thì
 * UPDATE_SESSIONS mới vô tình mang lịch sử về.
 * @param {string} sessionId
 * @returns {Promise<Object|null>} session kèm messages nếu tồn tại, null nếu chưa từng chat
 */
const markSessionOnlineIfExists = async (sessionId) => {
  try {
    const existing = await prisma.chatSession.findUnique({ where: { sessionId } });
    if (!existing) return null;
    const session = await prisma.chatSession.update({
      where: { sessionId },
      data: { status: 'ONLINE', lastActivityAt: new Date() },
      include: {
        messages: {
          orderBy: { timestamp: 'asc' }
        }
      }
    });
    return {
      id: session.sessionId,
      sessionId: session.sessionId,
      customerName: session.customerName,
      status: session.status,
      customerLastReadAt: session.customerLastReadAt ? session.customerLastReadAt.toISOString() : null,
      staffLastReadAt: session.staffLastReadAt ? session.staffLastReadAt.toISOString() : null,
      messages: session.messages.map(formatMessage)
    };
  } catch (err) {
    console.error('[ChatService] Error marking session online:', err);
    return null;
  }
};

/**
 * Add a message to a chat session
 * @param {string} sessionId 
 * @param {string} sender 
 * @param {string} text 
 * @param {string} senderName 
 * @returns {Promise<Object>}
 */
const addMessage = async (sessionId, sender, text, senderName = null) => {
  try {
    if (!sessionId || !text) {
      throw new Error('Session ID and text are required');
    }

    // Ensure session exists
    let session = await prisma.chatSession.findUnique({
      where: { sessionId }
    });

    if (!session) {
      session = await prisma.chatSession.create({
        data: {
          sessionId,
          customerName: senderName || 'Khách Hàng Vãng Lai',
          status: 'ONLINE'
        }
      });
    } else {
      // Update last activity
      await prisma.chatSession.update({
        where: { sessionId },
        data: { lastActivityAt: new Date() }
      });
    }

    // Add message
    await prisma.chatMessage.create({
      data: {
        sessionId,
        sender,
        text,
        senderName,
        timestamp: new Date()
      }
    });

    // Return updated session
    const updated = await getSessionById(sessionId);
    return updated;
  } catch (err) {
    console.error('[ChatService] Error adding message:', err);
    throw err;
  }
};

/**
 * Close a chat session
 * @param {string} sessionId 
 * @param {string} notes 
 * @returns {Promise<Object>}
 */
const closeSession = async (sessionId, notes = null) => {
  try {
    const session = await prisma.chatSession.update({
      where: { sessionId },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
        notes,
        lastActivityAt: new Date()
      },
      include: {
        messages: {
          orderBy: { timestamp: 'asc' }
        }
      }
    });

    return {
      id: session.sessionId,
      sessionId: session.sessionId,
      customerName: session.customerName,
      status: session.status,
      customerLastReadAt: session.customerLastReadAt ? session.customerLastReadAt.toISOString() : null,
      staffLastReadAt: session.staffLastReadAt ? session.staffLastReadAt.toISOString() : null,
      messages: session.messages.map(formatMessage)
    };
  } catch (err) {
    console.error('[ChatService] Error closing session:', err);
    throw err;
  }
};

/**
 * Delete a chat session and its messages
 * @param {string} sessionId 
 * @returns {Promise<void>}
 */
const deleteSession = async (sessionId) => {
  try {
    await prisma.chatSession.delete({
      where: { sessionId }
    });
  } catch (err) {
    console.error('[ChatService] Error deleting session:', err);
    throw err;
  }
};

/**
 * Get sessions by status
 * @param {string} status 
 * @returns {Promise<Array>}
 */
const getSessionsByStatus = async (status) => {
  try {
    const sessions = await prisma.chatSession.findMany({
      where: { status },
      include: {
        messages: {
          orderBy: { timestamp: 'asc' }
        }
      },
      orderBy: { lastActivityAt: 'desc' }
    });

    return sessions.map(session => ({
      id: session.sessionId,
      sessionId: session.sessionId,
      customerName: session.customerName,
      status: session.status,
      customerLastReadAt: session.customerLastReadAt ? session.customerLastReadAt.toISOString() : null,
      staffLastReadAt: session.staffLastReadAt ? session.staffLastReadAt.toISOString() : null,
      messages: session.messages.map(formatMessage)
    }));
  } catch (err) {
    console.error('[ChatService] Error getting sessions by status:', err);
    return [];
  }
};

/**
 * Clear old sessions (older than X days)
 * @param {number} daysOld - Number of days to keep
 * @returns {Promise<number>} - Number of sessions deleted
 */
const clearOldSessions = async (daysOld = 30) => {
  try {
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
    
    const result = await prisma.chatSession.deleteMany({
      where: {
        status: 'CLOSED',
        closedAt: {
          lt: cutoffDate
        }
      }
    });

    console.log(`[ChatService] Deleted ${result.count} old sessions`);
    return result.count;
  } catch (err) {
    console.error('[ChatService] Error clearing old sessions:', err);
    return 0;
  }
};

/**
 * Đánh dấu 1 bên (customer hoặc staff) vừa xem cuộc hội thoại tới thời điểm
 * hiện tại — dùng để tính trạng thái "Đã xem" (kiểu Zalo) cho tin nhắn của
 * PHÍA BÊN KIA. Không throw nếu phiên chưa tồn tại (vd staff bấm vào 1 phiên
 * vừa bị khách xoá) — chỉ là no-op.
 * @param {string} sessionId
 * @param {'customer'|'staff'} role
 * @returns {Promise<string|null>} ISO timestamp vừa ghi nhận, null nếu phiên không tồn tại
 */
const markRead = async (sessionId, role) => {
  try {
    const readAt = new Date();
    const field = role === 'staff' ? 'staffLastReadAt' : 'customerLastReadAt';
    await prisma.chatSession.update({
      where: { sessionId },
      data: { [field]: readAt }
    });
    return readAt.toISOString();
  } catch (err) {
    // P2025 = record not found — phiên đã bị xoá hoặc sai id, không phải lỗi thật
    if (err.code !== 'P2025') console.error('[ChatService] Error marking read:', err);
    return null;
  }
};

module.exports = {
  getAllSessions,
  getSessionById,
  createOrUpdateSession,
  markSessionOnlineIfExists,
  markRead,
  addMessage,
  closeSession,
  deleteSession,
  getSessionsByStatus,
  clearOldSessions
};
