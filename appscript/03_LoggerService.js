/* ================================================
   LOGGER SERVICE
   ================================================ */

class Logger {
  constructor() {
    this.config = Config;
  }

  log(level, message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] ${message}`;
    
    // Hiển thị trong console Google Apps Script
    console.log(logMessage);
  }

  debug(message) {
    if (this.config.LOG_LEVEL === 'DEBUG') {
      this.log('DEBUG', message);
    }
  }

  info(message) {
    if (['DEBUG', 'INFO'].includes(this.config.LOG_LEVEL)) {
      this.log('INFO', message);
    }
  }

  warn(message) {
    if (['DEBUG', 'INFO', 'WARN'].includes(this.config.LOG_LEVEL)) {
      this.log('WARN', message);
    }
  }

  error(message) {
    this.log('ERROR', message);
  }
}

// Khởi tạo đối tượng logger toàn cục
const logger = new Logger();
