const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const { cleanupAll } = require('./utils/cleanup');

const app = express();

// Enhanced error handling with structured logging
const logger = {
  info: (message, context = {}) => {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`, 
                Object.keys(context).length > 0 ? JSON.stringify(context, null, 2) : '');
  },
  error: (message, error = null, context = {}) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`);
    if (error) {
      console.error('Error details:', error.stack || error.message || error);
    }
    if (Object.keys(context).length > 0) {
      console.error('Context:', JSON.stringify(context, null, 2));
    }
  },
  warn: (message, context = {}) => {
    console.warn(`[WARN] ${new Date().toISOString()} - ${message}`,
                 Object.keys(context).length > 0 ? JSON.stringify(context, null, 2) : '');
  }
};

// Global error handlers
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  cleanupAll();
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', null, { promise, reason });
  cleanupAll();
  process.exit(1);
});

// Register cleanup handlers for application shutdown
process.on('exit', (code) => {
  logger.info('Process exiting', { code });
  cleanupAll();
});

process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully');
  cleanupAll();
  process.exit();
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  cleanupAll();
  process.exit();
});

// If you're using Express with sessions, add this to clean up when sessions end
if (app && app.use) {
  app.use(session({
    // ...existing session config...
    store: new (require('connect-session-store')(session))({
      // ...existing store config...
      checkPeriod: 86400000, // 24 hours
      // Clean up temp files associated with expired sessions
      unset: 'destroy',
      afterDestroy: function(sessionId) {
        try {
          // Clean up any session-specific temp files
          const sessionTmpDir = path.join(__dirname, 'tmp', sessionId);
          if (fs.existsSync(sessionTmpDir)) {
            fs.rmSync(sessionTmpDir, { recursive: true, force: true });
            logger.info('Cleaned up session temp files', { sessionId });
          }
          
          // Clean up any session-specific processed files
          const sessionProcessedDir = path.join(__dirname, 'processed', sessionId);
          if (fs.existsSync(sessionProcessedDir)) {
            fs.rmSync(sessionProcessedDir, { recursive: true, force: true });
            logger.info('Cleaned up session processed files', { sessionId });
          }
        } catch (err) {
          logger.error('Error cleaning up session files:', err, { sessionId });
        }
      }
    })
  }));
}

// Export logger for use in other modules
module.exports = { app, logger };

module.exports = app;