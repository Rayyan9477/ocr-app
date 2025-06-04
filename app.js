const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const { cleanupAll } = require('./utils/cleanup');

const app = express();

// Register cleanup handlers for application shutdown
process.on('exit', cleanupAll);
process.on('SIGINT', () => {
  cleanupAll();
  process.exit();
});
process.on('SIGTERM', () => {
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
          }
          
          // Clean up any session-specific processed files
          const sessionProcessedDir = path.join(__dirname, 'processed', sessionId);
          if (fs.existsSync(sessionProcessedDir)) {
            fs.rmSync(sessionProcessedDir, { recursive: true, force: true });
          }
        } catch (err) {
          console.error('Error cleaning up session files:', err);
        }
      }
    })
  }));
}

// ...existing code...

module.exports = app;