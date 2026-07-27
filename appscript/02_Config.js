/* ================================================
   CONFIGURATION FILE
   ================================================ */

const Config = {
  // Key dùng để lưu trữ danh sách Dropdown trong DocumentProperties
  DROPDOWN_LISTS_STORE: 'DROPDOWN_LISTS_STORE',
  
  // Key dùng để lưu trữ cấu hình Rules trong DocumentProperties của Google Sheets
  DROPDOWN_RULES_STORE: 'DROPDOWN_RULES_STORE',
  
  // Key dùng để lưu trữ danh sách các Templates thiết lập
  TEMPLATE_STORE: 'TEMPLATE_STORE',
  
  // Key dùng để lưu trữ danh sách các định nghĩa Header toàn cục
  HEADER_STORE: 'HEADER_STORE',
  
  // Key dùng để lưu trữ danh sách Email được cấp quyền Admin
  AUTH_EMAILS_STORE: 'AUTH_EMAILS_STORE',
  
  // Key dùng để lưu trữ cấu hình định dạng mặc định (Default Formats)
  DEFAULT_FORMATS_STORE: 'DEFAULT_FORMATS_STORE',
  
  // ID file Spreadsheet đích cần áp dụng dropdown rules
  DESTINATION_SPREADSHEET_ID: '1dvI6gw4gaTGvOZusYFtFVsgPgSikTDYKmv1RIfWIuBQ',
  
  // Dải ô áp dụng mặc định nếu bỏ trống
  DEFAULT_RANGE: 'A1:A100',
  
  // Cấp độ log hoạt động (DEBUG | INFO | WARN | ERROR)
  LOG_LEVEL: 'INFO'
};
