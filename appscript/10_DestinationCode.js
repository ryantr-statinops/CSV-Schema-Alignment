// ====================================================================
// MÃ NGUỒN THAM KHẢO CHO FILE GOOGLE SHEETS ĐÍCH (CUSTOMER SIDE)
// TẤT CẢ CODE TRONG FILE NÀY ĐÃ ĐƯỢC COMMENT LẠI VÌ KHÔNG CHẠY TRÊN SOURCE
// ====================================================================
// 
// function onOpen() {
//   SpreadsheetApp.getUi().createMenu('Hệ thống')
//       .addItem('1. Quản lý Dropdown', 'showDropdownSidebar')
//       .addItem('2. Quản lý Sheets', 'showSheetManagerSidebar')
//       .addItem('3. Quản lý Template', 'showTemplateManagerSidebar')
//       .addSeparator()
//       .addItem('4. System Menu', 'showSystemMenuModal')
//       .addToUi();
// 
//   SpreadsheetApp.getUi().createMenu('Tính năng')
//       .addItem('Nhập liệu', 'showDataEntrySidebar')
//       .addToUi();
// }
// 
// /**
//  * Cổng kết nối duy nhất (Single Entry Point) chuyển tiếp toàn bộ
//  * yêu cầu từ các Sidebar sang Thư viện xử lý bảo mật.
//  */
// function handleApiRequest(request) {
//   // Bắn tiếp request sang hàm tổng đại diện của Thư viện
//   return source.handleApiRequest(request);
// }
// 
// // ====================================================================
// // HÀM HIỂN THỊ CÁC SIDEBAR TỪ THƯ VIỆN
// // ====================================================================
// 
// function showDropdownSidebar() {
//   source.showSidebar();
// }
// 
// function showSheetManagerSidebar() {
//   source.showSheetManagerSidebar();
// }
// 
// function showTemplateManagerSidebar() {
//   source.showTemplateManagerSidebar();
// }
// 
// function showSystemMenuModal() {
//   source.showSystemMenuModal();
// }
// 
// function showDataEntrySidebar() {
//   source.showDataEntrySidebar();
// }
// 
