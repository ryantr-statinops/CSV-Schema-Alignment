/* ================================================
   AUTHORIZATION SERVICE - QUẢN LÝ QUYỀN TRUY CẬP ADMIN
   ================================================ */

class AuthService {
  constructor() {
    // Không lưu trữ bản sao của Config hay logger trong constructor để tránh lỗi tải muộn (lazy-loading)
  }

  /**
   * Lấy danh sách email được whitelist trong DocumentProperties
   * @returns {Array} Mảng các email chữ thường
   */
  getEmails() {
    try {
      const props = PropertiesService.getDocumentProperties().getProperty(Config.AUTH_EMAILS_STORE);
      const emails = props ? JSON.parse(props) : [];
      return emails.map(function(e) { return e.trim().toLowerCase(); });
    } catch (e) {
      console.error("Lỗi lấy danh sách email: " + e.toString());
      return [];
    }
  }

  /**
   * Lưu danh sách email whitelist vào DocumentProperties
   * @param {Array} emails Mảng danh sách email
   */
  _saveEmails(emails) {
    const cleaned = (emails || []).map(function(e) { return e.trim().toLowerCase(); });
    PropertiesService.getDocumentProperties().setProperty(Config.AUTH_EMAILS_STORE, JSON.stringify(cleaned));
  }

  /**
   * Lấy thông tin trạng thái phân quyền của người dùng hiện tại
   * @returns {Object} Đối tượng chứa trạng thái truy cập, email hiện tại và trạng thái chủ sở hữu
   */
  getAuthStatus() {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const owner = ss.getOwner();
      const ownerEmail = owner ? owner.getEmail().trim().toLowerCase() : "";
      
      const currentUserEmail = Session.getActiveUser().getEmail().trim().toLowerCase();
      
      const isOwner = (currentUserEmail && currentUserEmail === ownerEmail);
      const whitelisted = this.getEmails();
      const isWhitelisted = (currentUserEmail && whitelisted.indexOf(currentUserEmail) !== -1);
      
      return {
        isAuthorized: isOwner || isWhitelisted,
        currentUser: currentUserEmail || "Không xác định",
        isOwner: isOwner
      };
    } catch (e) {
      return {
        isAuthorized: false,
        currentUser: "Lỗi xác thực",
        isOwner: false,
        error: e.toString()
      };
    }
  }

  /**
   * Kiểm tra xem người dùng hiện tại có được phép sử dụng hệ thống hay không
   * @returns {boolean} True nếu được phép, ngược lại False
   */
  isAuthorized() {
    const status = this.getAuthStatus();
    return !!status.isAuthorized;
  }

  /**
   * Thêm một email mới vào danh sách whitelist
   * @param {string} email Email cần thêm
   * @returns {Object} Trạng thái thành công hay thất bại
   */
  addEmail(email) {
    try {
      if (!email || typeof email !== 'string') {
        return { success: false, message: "Email không được để trống." };
      }
      
      const cleanedEmail = email.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanedEmail)) {
        return { success: false, message: "Định dạng Email không hợp lệ." };
      }
      
      const emails = this.getEmails();
      if (emails.indexOf(cleanedEmail) !== -1) {
        return { success: true, message: "Email này đã có trong danh sách cấp quyền." };
      }
      
      emails.push(cleanedEmail);
      this._saveEmails(emails);
      activityLogService.log("đã cấp quyền Admin cho Gmail: " + cleanedEmail);
      return { success: true, message: "Đã thêm Email vào danh sách cấp quyền thành công." };
    } catch (e) {
      return { success: false, message: "Lỗi thêm email: " + e.toString() };
    }
  }

  /**
   * Xóa một email khỏi danh sách whitelist
   * @param {string} email Email cần xóa
   * @returns {Object} Trạng thái thành công hay thất bại
   */
  deleteEmail(email) {
    try {
      if (!email) {
        return { success: false, message: "Email cần xóa không hợp lệ." };
      }
      
      const cleanedEmail = email.trim().toLowerCase();
      const emails = this.getEmails();
      const updated = emails.filter(function(e) { return e !== cleanedEmail; });
      
      if (emails.length === updated.length) {
        return { success: false, message: "Không tìm thấy email này trong danh sách cấp quyền." };
      }
      
      this._saveEmails(updated);
      activityLogService.log("đã thu hồi quyền Admin của Gmail: " + cleanedEmail);
      return { success: true, message: "Đã xóa email khỏi danh sách cấp quyền thành công." };
    } catch (e) {
      return { success: false, message: "Lỗi xóa email: " + e.toString() };
    }
  }
}

// Khởi tạo đối tượng toàn cục
const authService = new AuthService();
