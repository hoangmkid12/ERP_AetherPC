const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const { getAllSessions, createOrUpdateSession, addMessage, closeSession, deleteSession } = require('./chatService');
const prisma = require('../config/database');

let wss = null;

// Live GPS Tracking (Shipper -> Khách hàng / Admin) — vị trí gần nhất mỗi
// orderId đang có Shipper phát tín hiệu. Chỉ giữ trong bộ nhớ (không phải
// lịch sử toạ độ), đồng thời ghi đè Order.lastLat/lastLng trong DB để một
// client mới kết nối (khách tải lại trang, hoặc server vừa restart) vẫn
// khôi phục được điểm cuối cùng đã biết.
const activeDeliveries = new Map(); // orderId -> { lat, lng, speed, heading, updatedAt, shipperName }

const initWebSocket = async (server) => {
  wss = new WebSocket.Server({ server, path: '/ws/cskh' });

  console.log('==================================================');
  console.log('[WebSocket] Server initialized on ws://localhost:5000/ws/cskh');
  console.log('[WebSocket] Chat storage: PostgreSQL Database');
  console.log('==================================================');

  wss.on('connection', async (ws, request) => {
    // Browser WebSockets automatically include the HttpOnly auth cookie.
    // Unauthenticated connections are treated as guest customers and never
    // receive the staff session list or execute staff-only commands.
    ws._isStaff = false;
    ws._sessionId = null;
    // Delivery-tracking tags: which order (if any) this connection is either
    // broadcasting GPS for (shipper) or listening to (customer/admin).
    ws._shipperOrderId = null;
    ws._trackingOrderId = null;
    try {
      const cookie = request.headers.cookie || '';
      const match = cookie.match(/(?:^|;\s*)authToken=([^;]+)/);
      if (match && process.env.JWT_SECRET) {
        const user = jwt.verify(decodeURIComponent(match[1]), process.env.JWT_SECRET);
        ws._userId = user.id;
        ws._userRole = user.role;
        ws._userName = user.fullname || user.name || user.email || null;
        ws._isStaff = ['CSKH', 'SALES_MANAGER', 'CEO', 'ADMIN'].includes(user.role);
      }
    } catch (_) {
      // Invalid cookies remain anonymous; they do not grant any privileges.
    }
    try {
      // Load all sessions from database on connection
      const sessions = ws._isStaff ? await getAllSessions() : [];
      ws.send(JSON.stringify({
        type: 'INIT_SESSIONS',
        sessions
      }));
    } catch (err) {
      console.error('[WebSocket] Error initializing sessions:', err);
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
      console.log('[WebSocket] Client disconnected');
    });

    ws.on('error', (err) => {
      console.error('[WebSocket] Error:', err);
    });
  });
};

const broadcast = (data, predicate = () => true) => {
  if (!wss) return;
  const payload = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && predicate(client)) {
      client.send(payload);
    }
  });
};

const handleWSMessage = async (ws, data) => {
  if (!data || !data.type) return;

  const { type, payload } = data;
  const time = payload?.time || new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

  try {
    if (type === 'CUSTOMER_SEND_MSG') {
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
        sessions: [session],
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
    // ─── Live GPS Tracking (giao hàng) ───────────────────────────────────
    else if (type === 'SHIPPER_JOIN_DELIVERY') {
      const { orderId } = payload || {};
      if (!orderId) return;
      const allowedRoles = ['DELIVERY', 'CEO', 'ADMIN', 'SALES_MANAGER', 'WAREHOUSE_MANAGER', 'WAREHOUSE'];
      if (!allowedRoles.includes(ws._userRole)) {
        return ws.send(JSON.stringify({ type: 'ERROR', message: 'Chỉ Shipper hoặc Quản trị viên được phát vị trí giao hàng.' }));
      }
      const order = await prisma.order.findUnique({
        where: { orderId: String(orderId) },
        select: { assignedShipperId: true }
      });
      if (!order) return ws.send(JSON.stringify({ type: 'ERROR', message: `Không tìm thấy đơn hàng: ${orderId}` }));

      // Nếu shipper đăng nhập và đơn chưa gán ai, tự động liên kết đơn cho shipper
      if (ws._userRole === 'DELIVERY') {
        if (!order.assignedShipperId && ws._userId) {
          await prisma.order.update({
            where: { orderId: String(orderId) },
            data: { assignedShipperId: Number(ws._userId) }
          }).catch(() => {});
        } else if (order.assignedShipperId && Number(order.assignedShipperId) !== Number(ws._userId) && !['CEO', 'ADMIN'].includes(ws._userRole)) {
          return ws.send(JSON.stringify({ type: 'ERROR', message: 'Bạn không phải Shipper được giao đơn này.' }));
        }
      }
      ws._shipperOrderId = String(orderId);
      ws.send(JSON.stringify({ type: 'SHIPPER_JOIN_ACK', orderId }));
    }
    else if (type === 'SHIPPER_UPDATE_LOCATION') {
      const { orderId, lat, lng, speed, heading } = payload || {};
      if (!orderId || typeof lat !== 'number' || typeof lng !== 'number') return;
      if (ws._shipperOrderId !== String(orderId)) {
        return ws.send(JSON.stringify({ type: 'ERROR', message: 'Chưa tham gia phiên phát vị trí cho đơn này (gửi SHIPPER_JOIN_DELIVERY trước).' }));
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
    console.error('[WebSocket] Error handling message:', err);
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
  } catch (err) {
    console.error('[WebSocket] Failed to persist delivery location:', err.message);
  }

  broadcast({
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
