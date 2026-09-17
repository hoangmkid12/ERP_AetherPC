const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const { getAllSessions, createOrUpdateSession, markSessionOnlineIfExists, addMessage, closeSession, deleteSession } = require('./chatService');
const prisma = require('../config/database');

let wss = null; // CSKH chat — path /ws/cskh
let wssTracking = null; // Live GPS giao hàng — path /ws/tracking (tách riêng khỏi chat để 2 tính năng không đụng nhau)

// Live GPS Tracking (Shipper -> Khách hàng / Admin) — vị trí gần nhất mỗi
// orderId đang có Shipper phát tín hiệu. Chỉ giữ trong bộ nhớ để trả ngay khi
// có client mới kết nối; vệt di chuyển đầy đủ được ghi vào bảng LocationHistory
// (xem updateDeliveryLocation), còn Order.lastLat/lastLng vẫn giữ điểm cuối để
// khôi phục nhanh khi khách tải lại trang hoặc server vừa restart.
const activeDeliveries = new Map(); // orderId -> { lat, lng, speed, heading, updatedAt, shipperName }

// Đọc JWT từ cookie authToken — dùng chung cho cả 2 wss (chat và tracking) vì
// cơ chế xác thực kết nối WebSocket giống hệt nhau, chỉ khác tập message xử lý.
const authenticateConnection = (request) => {
  const auth = { userId: null, userRole: null, userName: null, isStaff: false };
  try {
    const cookie = request.headers.cookie || '';
    const match = cookie.match(/(?:^|;\s*)authToken=([^;]+)/);
    if (match && process.env.JWT_SECRET) {
      const user = jwt.verify(decodeURIComponent(match[1]), process.env.JWT_SECRET);
      auth.userId = user.id;
      auth.userRole = user.role;
      auth.userName = user.fullname || user.name || user.email || null;
      auth.isStaff = ['CSKH', 'SALES_MANAGER', 'CEO', 'ADMIN'].includes(user.role);
    }
  } catch (_) {
    // Invalid cookies remain anonymous; they do not grant any privileges.
  }
  return auth;
};

const initWebSocket = async (server) => {
  // ws@8's WebSocketServer, when given {server, path}, does NOT skip
  // non-matching requests — it unconditionally calls handleUpgrade() on every
  // 'upgrade' event and that function itself aborts the handshake (HTTP 400)
  // if the path doesn't match. With 2 such servers on the same HTTP server,
  // whichever registers first intercepts and 400s every request meant for the
  // other. The correct multi-path pattern (per ws's own README) is
  // {noServer: true} on both, plus a single shared 'upgrade' listener that
  // dispatches by pathname to the right server's handleUpgrade().
  wss = new WebSocket.Server({ noServer: true });
  wssTracking = new WebSocket.Server({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const pathname = (req.url || '').split('?')[0];
    if (pathname === '/ws/cskh') {
      wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
    } else if (pathname === '/ws/tracking') {
      wssTracking.handleUpgrade(req, socket, head, (ws) => wssTracking.emit('connection', ws, req));
    } else {
      socket.destroy();
    }
  });

  console.log('==================================================');
  console.log('[WebSocket] Chat server initialized on ws://localhost:5000/ws/cskh');
  console.log('[WebSocket] Tracking server initialized on ws://localhost:5000/ws/tracking');
  console.log('[WebSocket] Storage: PostgreSQL Database');
  console.log('==================================================');

const getOnlineCustomerSessionIds = () => {
  const set = new Set();
  if (!wss) return set;
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN && client._sessionId && !client._isStaff) {
      set.add(client._sessionId);
    }
  }
  return set;
};

const isCustomerSessionOnline = (sessionId) => {
  if (!wss || !sessionId) return false;
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN && client._sessionId === sessionId && !client._isStaff) {
      return true;
    }
  }
  return false;
};

  wss.on('connection', async (ws, request) => {
    // Browser WebSockets automatically include the HttpOnly auth cookie.
    // Unauthenticated connections are treated as guest customers and never
    // receive the staff session list or execute staff-only commands.
    const auth = authenticateConnection(request);
    ws._userId = auth.userId;
    ws._userRole = auth.userRole;
    ws._userName = auth.userName;
    ws._isStaff = auth.isStaff;
    ws._sessionId = null;

    try {
      // Load all sessions from database on connection with true online status
      const onlineSet = getOnlineCustomerSessionIds();
      const sessions = ws._isStaff ? await getAllSessions(onlineSet) : [];
      ws.send(JSON.stringify({
        type: 'INIT_SESSIONS',
        sessions
      }));
    } catch (err) {
      console.error('[WebSocket] Error initializing sessions:', err);
    }

    // Nhân viên CSKH vừa vào — báo ngay cho mọi khách đang mở sẵn widget chat
    // biết là đã có người trực, không cần đợi họ tự gửi CLIENT_IDENTIFY lại.
    if (ws._isStaff) {
      broadcast({ type: 'STAFF_ONLINE_STATUS', online: true }, client => !client._isStaff);
    }

    ws.on('message', async (messageStr) => {
      try {
        const data = JSON.parse(messageStr);
        await handleWSMessage(ws, data);
      } catch (err) {
        console.error('[WebSocket] Error parsing/handling message:', err);
      }
    });

    ws.on('close', () => {
      console.log('[WebSocket] Chat client disconnected');
      const sessionId = ws._sessionId;
      if (sessionId && !ws._isStaff) {
        setTimeout(async () => {
          const stillOnline = isCustomerSessionOnline(sessionId);
          if (!stillOnline) {
            try {
              await prisma.chatSession.updateMany({
                where: { sessionId },
                data: { status: 'OFFLINE' }
              });
            } catch (_) {}

            broadcast({
              type: 'ONLINE_STATUS_UPDATE',
              payload: {
                sessionId,
                status: 'OFFLINE',
                isOnline: false
              }
            }, client => client._isStaff);
          }
        }, 300);
      }

      // Nhân viên CSKH vừa thoát — chỉ báo "hết người trực" cho khách khi
      // KHÔNG còn ai khác đang trực (setTimeout để tránh báo sai khi họ chỉ
      // đang F5/chuyển mạng, giống cách xử lý customer offline ở trên).
      if (ws._isStaff) {
        setTimeout(() => {
          if (!isAnyStaffOnline()) {
            broadcast({ type: 'STAFF_ONLINE_STATUS', online: false }, client => !client._isStaff);
          }
        }, 300);
      }
    });

    ws.on('error', (err) => {
      console.error('[WebSocket] Chat error:', err);
    });
  });

  wssTracking.on('connection', (ws, request) => {
    const auth = authenticateConnection(request);
    ws._userId = auth.userId;
    ws._userRole = auth.userRole;
    ws._userName = auth.userName;
    ws._isStaff = auth.isStaff;
    // Delivery-tracking tags: which order (if any) this connection is either
    // broadcasting GPS for (shipper) or listening to (customer/admin).
    ws._shipperOrderId = null;
    ws._trackingOrderId = null;

    ws.on('message', async (messageStr) => {
      try {
        const data = JSON.parse(messageStr);
        await handleTrackingMessage(ws, data);
      } catch (err) {
        console.error('[WebSocket] Error parsing/handling tracking message:', err);
      }
    });

    ws.on('close', () => {
      console.log('[WebSocket] Tracking client disconnected');
    });

    ws.on('error', (err) => {
      console.error('[WebSocket] Tracking error:', err);
    });
  });
};

const broadcast = (data, predicate = () => true, target = wss) => {
  if (!target) return;
  const payload = JSON.stringify(data);
  target.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && predicate(client)) {
      client.send(payload);
    }
  });
};

const broadcastTracking = (data, predicate = () => true) => broadcast(data, predicate, wssTracking);

// Có ít nhất 1 nhân viên CSKH/quản lý đang mở kết nối /ws/cskh hay không — dùng
// để bao cho widget chat khach hang biet ("Da ket noi" vs "Dang doi ket noi")
// thay vi luon hien "San sang chat live" du chang co ai truc.
const isAnyStaffOnline = () => {
  if (!wss) return false;
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN && client._isStaff) return true;
  }
  return false;
};

const handleWSMessage = async (ws, data) => {
  if (!data || !data.type) return;

  const { type, payload } = data;
  const time = payload?.time || new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

  try {
    if (type === 'CLIENT_IDENTIFY') {
      const { sessionId, customerName } = payload || {};
      if (!sessionId) return;
      ws._sessionId = sessionId;
      ws._customerName = customerName;

      // CLIENT_IDENTIFY bắn ngay khi widget chat (Chatbot.jsx) hoặc app Shipper
      // (DeliveryAppShell.jsx) mở kết nối WebSocket — TRƯỚC KHI khách/shipper
      // gõ chữ nào. Trước đây dùng createOrUpdateSession (upsert) nên mọi
      // khách ghé site đều tự động tạo 1 phiên chat rỗng, khiến CSKH thấy họ
      // "đang chat" dù chưa gửi tin nào. Chỉ cập nhật trạng thái ONLINE nếu
      // phiên đó đã tồn tại thật (đã từng gửi ít nhất 1 tin) — phiên mới chỉ
      // được tạo thật sự ở CUSTOMER_SEND_MSG khi có tin nhắn đầu tiên.
      let existingSession = null;
      try {
        existingSession = await markSessionOnlineIfExists(sessionId);
      } catch (_) {}

      if (existingSession) {
        // Gửi thẳng lịch sử hội thoại lại cho đúng client vừa identify — không
        // phải staff nên INIT_SESSIONS lúc connect luôn nhận sessions=[], phải
        // trả riêng ở đây thì khung chat mới hiện được tin nhắn cũ ngay khi mở
        // lại (trước đây phải gửi 1 tin mới thì UPDATE_SESSIONS mới vô tình
        // mang lịch sử về).
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'UPDATE_SESSIONS',
            sessions: [existingSession]
          }));
        }

        // Broadcast ONLINE status to staff — chỉ khi đây là 1 cuộc chat có thật
        broadcast({
          type: 'ONLINE_STATUS_UPDATE',
          payload: {
            sessionId,
            status: 'ONLINE',
            isOnline: true
          }
        }, client => client._isStaff);
      }

      // Bao cho khach biet ngay CSKH co dang truc hay khong (STAFF_ONLINE_STATUS) —
      // chi gui cho client khong phai staff, staff tu biet minh dang online.
      if (!ws._isStaff && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'STAFF_ONLINE_STATUS', online: isAnyStaffOnline() }));
      }
    }
    else if (type === 'CUSTOMER_SEND_MSG') {
      const { sessionId, text, customerName } = payload || {};
      if (!text || !sessionId) return;
      ws._sessionId = sessionId;
      
      let name = customerName;
      if (!name || name.includes('undefined')) {
        name = 'Khách Hàng Vãng Lai';
      }

      // Create session if needed, then add message
      await createOrUpdateSession(sessionId, name);
      const session = await addMessage(sessionId, 'customer', text, name);

      // Broadcast to all connected clients
      broadcast({
        type: 'UPDATE_SESSIONS',
        sessions: [{ ...session, status: 'ONLINE', isOnline: true }],
        newMsg: { sender: 'customer', text, time, sessionId: session.sessionId }
      }, client => client._isStaff || client === ws || client._sessionId === session.sessionId);
    } 
    else if (type === 'STAFF_SEND_MSG') {
      const { sessionId, text } = payload || {};
      if (!text || !sessionId) return;
      if (!ws._isStaff) return ws.send(JSON.stringify({ type: 'ERROR', message: 'Staff authorization required' }));

      const session = await addMessage(sessionId, 'staff', text, 'Staff');

      // Only staff (need the full session list) and the customer this
      // session belongs to should receive this — never every connected
      // client, or one customer's chat would leak into another's.
      broadcast({
        type: 'UPDATE_SESSIONS',
        sessions: [session],
        newMsg: { sender: 'staff', text, time, sessionId }
      }, client => client._isStaff || client._sessionId === sessionId);
    }
    else if (type === 'DELETE_SESSION') {
      const { sessionId } = payload || {};
      if (!sessionId) return;
      if (!ws._isStaff) return ws.send(JSON.stringify({ type: 'ERROR', message: 'Staff authorization required' }));

      await deleteSession(sessionId);

      broadcast({
        type: 'UPDATE_SESSIONS',
        deletedSessionId: sessionId
      });
    }
    else if (type === 'CLOSE_SESSION') {
      const { sessionId, notes } = payload || {};
      if (!sessionId) return;
      if (!ws._isStaff) return ws.send(JSON.stringify({ type: 'ERROR', message: 'Staff authorization required' }));

      const session = await closeSession(sessionId, notes);

      broadcast({
        type: 'SESSION_CLOSED',
        session,
        sessionId
      });
    }
  } catch (err) {
    console.error('[WebSocket] Error handling message:', err);
    ws.send(JSON.stringify({
      type: 'ERROR',
      message: 'Failed to process message',
      error: err.message
    }));
  }
};

// ─── Live GPS Tracking (giao hàng) — kênh /ws/tracking, tách biệt khỏi chat ──
const handleTrackingMessage = async (ws, data) => {
  if (!data || !data.type) return;
  const { type, payload } = data;

  try {
    if (type === 'SHIPPER_JOIN_DELIVERY') {
      const { orderId } = payload || {};
      if (!orderId) return;
      ws._shipperOrderId = String(orderId);

      const allowedRoles = ['DELIVERY', 'CEO', 'ADMIN', 'SALES_MANAGER', 'WAREHOUSE_MANAGER', 'WAREHOUSE'];
      if (!allowedRoles.includes(ws._userRole)) {
        ws._shipperOrderId = null;
        return ws.send(JSON.stringify({ type: 'ERROR', message: 'Chỉ Shipper hoặc Quản trị viên được phát vị trí giao hàng.' }));
      }
      const order = await prisma.order.findUnique({
        where: { orderId: String(orderId) },
        select: { assignedShipperId: true }
      });
      if (!order) {
        ws._shipperOrderId = null;
        return ws.send(JSON.stringify({ type: 'ERROR', message: `Không tìm thấy đơn hàng: ${orderId}` }));
      }

      // Nếu shipper đăng nhập và đơn chưa gán ai, tự động liên kết đơn cho shipper
      if (ws._userRole === 'DELIVERY') {
        if (!order.assignedShipperId && ws._userId) {
          await prisma.order.update({
            where: { orderId: String(orderId) },
            data: { assignedShipperId: Number(ws._userId) }
          }).catch(() => {});
        } else if (order.assignedShipperId && Number(order.assignedShipperId) !== Number(ws._userId) && !['CEO', 'ADMIN'].includes(ws._userRole)) {
          ws._shipperOrderId = null;
          return ws.send(JSON.stringify({ type: 'ERROR', message: 'Bạn không phải Shipper được giao đơn này.' }));
        }
      }
      ws.send(JSON.stringify({ type: 'SHIPPER_JOIN_ACK', orderId }));
    }
    else if (type === 'SHIPPER_UPDATE_LOCATION') {
      const { orderId, lat, lng, speed, heading } = payload || {};
      if (!orderId || typeof lat !== 'number' || typeof lng !== 'number') return;
      if (!ws._shipperOrderId) {
        ws._shipperOrderId = String(orderId);
      }
      await updateDeliveryLocation(String(orderId), { lat, lng, speed, heading, shipperName: ws._userName });
    }
    else if (type === 'SHIPPER_LEAVE_DELIVERY') {
      ws._shipperOrderId = null;
    }
    else if (type === 'CUSTOMER_TRACK_ORDER') {
      const { orderId } = payload || {};
      if (!orderId) return;
      const order = await prisma.order.findUnique({
        where: { orderId: String(orderId) },
        select: { customerId: true, lastLat: true, lastLng: true, locationUpdatedAt: true }
      });
      if (!order) return ws.send(JSON.stringify({ type: 'ERROR', message: `Không tìm thấy đơn hàng: ${orderId}` }));

      // Cho phép theo dõi vị trí trực tiếp theo mã đơn hàng hợp lệ
      ws._trackingOrderId = String(orderId);
      const live = activeDeliveries.get(String(orderId));
      const lat = live?.lat ?? order.lastLat;
      const lng = live?.lng ?? order.lastLng;
      if (lat != null && lng != null) {
        ws.send(JSON.stringify({
          type: 'DELIVERY_LOCATION_UPDATE',
          orderId,
          lat,
          lng,
          speed: live?.speed ?? null,
          heading: live?.heading ?? null,
          shipperName: live?.shipperName ?? null,
          updatedAt: live?.updatedAt ?? order.locationUpdatedAt
        }));
      }
    }
  } catch (err) {
    console.error('[WebSocket] Error handling tracking message:', err);
    ws.send(JSON.stringify({
      type: 'ERROR',
      message: 'Failed to process message',
      error: err.message
    }));
  }
};

// Shared by the WS handler above and the REST fallback (order.controller.js
// POST /orders/:orderId/location, for when a shipper's WebSocket connection
// drops mid-delivery) — one place persists + broadcasts, so the two entry
// points can never disagree on what a "location update" does.
const updateDeliveryLocation = async (orderId, { lat, lng, speed, heading, shipperName }) => {
  const updatedAt = new Date();
  activeDeliveries.set(orderId, {
    lat, lng,
    speed: speed ?? null,
    heading: heading ?? null,
    shipperName: shipperName || activeDeliveries.get(orderId)?.shipperName || null,
    updatedAt
  });

  try {
    await prisma.order.update({
      where: { orderId },
      data: { lastLat: lat, lastLng: lng, locationUpdatedAt: updatedAt }
    });
    await prisma.locationHistory.create({
      data: { orderId, lat, lng, speed: speed ?? null, heading: heading ?? null }
    });
  } catch (err) {
    console.error('[WebSocket] Failed to persist delivery location:', err.message);
  }

  broadcastTracking({
    type: 'DELIVERY_LOCATION_UPDATE',
    orderId,
    lat,
    lng,
    speed: speed ?? null,
    heading: heading ?? null,
    shipperName: activeDeliveries.get(orderId)?.shipperName || null,
    updatedAt
  }, client => client._isStaff || client._trackingOrderId === orderId);
};

const getSessions = async () => {
  try {
    return await getAllSessions();
  } catch (err) {
    console.error('[WebSocket] Error getting sessions:', err);
    return [];
  }
};

const addCustomerMessage = async ({ sessionId, text, customerName, time }) => {
  try {
    if (!sessionId || !text) return null;

    let name = customerName;
    if (!name || name.includes('undefined')) {
      name = 'Khách Hàng Vãng Lai';
    }

    await createOrUpdateSession(sessionId, name);
    const session = await addMessage(sessionId, 'customer', text, name);

    broadcast({
      type: 'UPDATE_SESSIONS',
      sessions: [session],
      newMsg: { sender: 'customer', text, time: time || new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }), sessionId: session.sessionId }
    }, client => client._isStaff || client._sessionId === session.sessionId);

    return session;
  } catch (err) {
    console.error('[WebSocket] Error adding customer message:', err);
    return null;
  }
};

const addStaffMessage = async ({ sessionId, text, time }) => {
  try {
    if (!sessionId || !text) return null;

    const session = await addMessage(sessionId, 'staff', text, 'Staff');

    broadcast({
      type: 'UPDATE_SESSIONS',
      sessions: [session],
      newMsg: { sender: 'staff', text, time: time || new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }), sessionId }
    }, client => client._isStaff || client._sessionId === sessionId);

    return session;
  } catch (err) {
    console.error('[WebSocket] Error adding staff message:', err);
    return null;
  }
};

module.exports = {
  initWebSocket,
  broadcast,
  getSessions,
  addCustomerMessage,
  addStaffMessage,
  updateDeliveryLocation
};
