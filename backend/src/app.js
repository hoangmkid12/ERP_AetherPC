const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const { errorMiddleware } = require('./middlewares/error.middleware');

const app = express();

// Security Middlewares
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true // Allow credentials (cookies)
}));

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
app.use('/api/v1/auth', require('./routes/auth.routes'));
app.use('/api/v1/products', require('./routes/product.routes'));
app.use('/api/v1/orders', require('./routes/order.routes'));
app.use('/api/v1/chat', require('./routes/chat.routes'));
app.use('/api/v1/purchasing', require('./routes/purchase.routes'));
app.use('/api/v1/warehouse', require('./routes/warehouse.routes'));
app.use('/api/v1/hr', require('./routes/hr.routes'));
app.use('/api/v1/employees', require('./routes/hr.routes'));
app.use('/api/v1/customers', require('./routes/customer.routes'));

// Global Error Handler Middleware
app.use(errorMiddleware);

module.exports = app;
