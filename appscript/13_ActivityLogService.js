/* ================================================
   ACTIVITY LOG SERVICE - GHI NHẬN NHẬT KÝ HỆ THỐNG
   ================================================ */

class ActivityLogService {
  constructor() {
    this.STORE_KEY = 'ACTIVITY_LOGS';
  }

  /**
   * Lấy danh sách nhật ký đã lưu trong DocumentProperties.
   * @returns {Array} Mảng các đối tượng log: { email, action, timestamp }
   */
  getLogs() {
    try {
      const props = PropertiesService.getDocumentProperties();
      const raw = props.getProperty(this.STORE_KEY);
      if (!raw) return [];
      const logs = JSON.parse(raw);
      return Array.isArray(logs) ? logs : [];
    } catch (e) {
      console.error("Lỗi khi đọc Activity Logs: " + e.toString());
      return [];
    }
  }

  /**
   * Lưu lại toàn bộ danh sách nhật ký vào DocumentProperties
   * @param {Array} logs Danh sách nhật ký mới
   */
  _saveLogs(logs) {
    try {
      const props = PropertiesService.getDocumentProperties();
      props.setProperty(this.STORE_KEY, JSON.stringify(logs));
    } catch (e) {
      console.error("Lỗi khi ghi Activity Logs: " + e.toString());
    }
  }

  /**
   * Ghi nhận một thao tác mới của người dùng vào nhật ký
   * @param {string} actionDescription Nội dung mô tả hành động
   */
  log(actionDescription) {
    try {
      const logs = this.getLogs();
      const email = Session.getActiveUser().getEmail() || "Hệ thống";
      
      const newEntry = {
        email: email,
        action: actionDescription,
        timestamp: new Date().getTime()
      };
      
      // Thêm vào đầu danh sách (để tin mới nhất xuất hiện trước)
      logs.unshift(newEntry);
      
      // Giới hạn tối đa 100 dòng nhật ký
      if (logs.length > 100) {
        logs.splice(100);
      }
      
      this._saveLogs(logs);
      
      // Tự động cập nhật LAST_CHANGED_TIMESTAMP để kích hoạt đồng bộ
      if (typeof updateLastChangedTimestamp === 'function') {
        updateLastChangedTimestamp();
      }
    } catch (e) {
      console.error("Lỗi ghi nhận log: " + e.toString());
    }
  }

  /**
   * Xóa toàn bộ lịch sử nhật ký chỉnh sửa
   * @returns {Object} Kết quả hành động
   */
  clearLogs() {
    try {
      this._saveLogs([]);
      
      if (typeof updateLastChangedTimestamp === 'function') {
        updateLastChangedTimestamp();
      }
      return { success: true };
    } catch (e) {
      return { success: false, message: e.toString() };
    }
  }
}

// Đối tượng instance toàn cục sử dụng trong toàn bộ Apps Script
const activityLogService = new ActivityLogService();
