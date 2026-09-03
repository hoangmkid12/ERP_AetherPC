const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const { errorMiddleware } = require('./middlewares/error.middleware');
const { isMaintenanceMode } = require('./services/maintenanceMode');

const app = express();

// Security Middlewares
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true // Allow credentials (cookies)
}));

// Rate limiting: a tight limit on auth endpoints (brute-force/credential
// stuffing target), a looser one for the rest of the API.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Quá nhiều yêu cầu đăng nhập, vui lòng thử lại sau ít phút.' }
});
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Quá nhiều yêu cầu, vui lòng thử lại sau.' }
});

// Cookie Parser Middleware (required for HTTP-Only cookies)
app.use(cookieParser());

// Request Parsing (tăng limit lên 10MB cho base64 proof photos giao hàng)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request Logging
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Basic Status Endpoint
app.get('/status', (req, res) => {
  res.json({
    status: 'UP',
    timestamp: new Date(),
    service: 'KLTN ERP API Service'
  });
});

// Routes API V1
app.use('/api/v1', apiLimiter);

// While /system/restore is disconnecting the shared Prisma pool to run
// `pg_restore`, every other request would otherwise hit a torn-down
// connection mid-query — reject them up front with a clear message instead.
// The restore route itself (and its own DB calls) is exempt so it can run.
app.use('/api/v1', (req, res, next) => {
  if (isMaintenanceMode() && req.path !== '/system/restore') {
    return res.status(503).json({ success: false, message: 'Hệ thống đang trong quá trình khôi phục dữ liệu, vui lòng thử lại sau ít phút.' });
  }
  next();
});
app.use('/api/v1/auth', require('./routes/auth.routes')(authLimiter));
app.use('/api/v1/products', require('./routes/product.routes'));
app.use('/api/v1/orders', require('./routes/order.routes'));
app.use('/api/v1/chat', require('./routes/chat.routes'));
app.use('/api/v1/purchasing', require('./routes/purchase.routes'));
app.use('/api/v1/warehouse', require('./routes/warehouse.routes'));
app.use('/api/v1/assembly-jobs', require('./routes/assembly.routes'));
app.use('/api/v1/hr', require('./routes/hr.routes'));
app.use('/api/v1/employees', require('./routes/hr.routes'));
app.use('/api/v1/customers', require('./routes/customer.routes'));
app.use('/api/v1/ledger', require('./routes/ledger.routes'));
app.use('/api/v1/complaints', require('./routes/complaint.routes'));
app.use('/api/v1/system', require('./routes/system.routes'));
app.use('/api/v1/address', require('./routes/address.routes'));

// Global Error Handler Middleware
app.use(errorMiddleware);

module.exports = app;
