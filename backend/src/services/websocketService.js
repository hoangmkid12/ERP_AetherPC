const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const { getAllSessions, createOrUpdateSession, addMessage, closeSession, deleteSession } = require('./chatService');

let wss = null;

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
    try {
      const cookie = request.headers.cookie || '';
      const match = cookie.match(/(?:^|;\s*)authToken=([^;]+)/);
      if (match && process.env.JWT_SECRET) {
        const user = jwt.verify(decodeURIComponent(match[1]), process.env.JWT_SECRET);
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

      broadcast({
        type: 'UPDATE_SESSIONS',
        sessions: [session],
        newMsg: { sender: 'staff', text, time, sessionId }
      });
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
    });

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
    });

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
  addStaffMessage
};
