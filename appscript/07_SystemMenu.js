/* ================================================
   SYSTEM MENU SERVICE
   ================================================ */

/**
 * Hiển thị Modal Dialog gộp cả 3 Sidebar.
 */
function showSystemMenuModal() {
  if (!authService.isAuthorized()) {
    showAccessDeniedAlert();
    return;
  }
  const html = HtmlService.createTemplateFromFile('07.1_SystemMenu')
      .evaluate()
      .setWidth(680)
      .setHeight(700);
  SpreadsheetApp.getUi().showModalDialog(html, 'Bảng Điều Khiển Hệ Thống');
}

/**
 * Hàm hỗ trợ lấy nội dung của một file HTML để nhúng vào iframe srcdoc.
 * Đồng thời tiêm (inject) script cầu nối parent.google.script.run để tránh lỗi sandbox.
 *
 * @param {string} filename Tên file HTML (không có phần mở rộng .html)
 * @returns {string} Nội dung HTML đã xử lý
 */
function getSystemMenuIframeContent(filename) {
  try {
    let content = HtmlService.createHtmlOutputFromFile(filename).getContent();
    
    // Đoạn script cầu nối giúp iframe truy cập trực tiếp google.script.run của cửa sổ cha
    const bridgeScript = `
      <script>
        (function() {
          if (!window.google && window.parent && window.parent.google) {
            window.google = window.parent.google;
          }
        })();
      </script>
    `;
    
    // Chèn đoạn script ngay dưới thẻ <head> để chạy sớm nhất có thể
    if (content.indexOf('<head>') !== -1) {
      content = content.replace('<head>', '<head>' + bridgeScript);
    } else {
      content = bridgeScript + content;
    }
    
    return content;
  } catch (e) {
    return 'Lỗi tải nội dung file ' + filename + ': ' + e.toString();
  }
}
