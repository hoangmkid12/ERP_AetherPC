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
