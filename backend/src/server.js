require('dotenv').config();
const app = require('./app');
const prisma = require('./config/database');
const { startScheduler } = require('./services/orderScheduler');
const { initWebSocket } = require('./services/websocketService');

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`==================================================`);
  console.log(`  KLTN ERP Server is running on port ${PORT}`);
  console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
  let emailProvider = '⚠️ NOT CONFIGURED';
  if (process.env.RESEND_API_KEY) {
    emailProvider = `Resend HTTP API (Key: ${process.env.RESEND_API_KEY.trim().slice(0, 8)}...)`;
  } else if (process.env.BREVO_API_KEY) {
    emailProvider = `Brevo HTTP API (Sender: ${process.env.BREVO_SENDER_EMAIL || process.env.GMAIL_USER || 'Default'})`;
  } else if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    emailProvider = `Gmail SMTP (${process.env.GMAIL_USER}) [⚠️ Lưu ý: Railway chặn cổng SMTP 465/587]`;
  }
  console.log(`  Email Service: ${emailProvider}`);
  console.log(`  Database status check pending connection...`);
  console.log(`==================================================`);
  
  startScheduler();
  initWebSocket(server);
});

// Handle graceful shutdown
const gracefulShutdown = async () => {
  console.log('\nReceived kill signal, shutting down gracefully...');
  server.close(async () => {
    console.log('Closed remaining HTTP connections.');
    await prisma.$disconnect();
    console.log('Prisma Client disconnected. Exiting process.');
    process.exit(0);
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
});
