/* ================================================
   08_Main.js - SINGLE ENTRY POINT ARCHITECTURE
   ================================================ */

/**
 * Cổng kết nối duy nhất (Single Entry Point) cho các yêu cầu từ Client-side.
 * Giúp tối giản hoá hàm cầu nối bên phía file Google Sheets đích của khách hàng.
 * 
 * @param {Object} request Đối tượng yêu cầu chứa { action, data }
 * @returns {*} Kết quả trả về từ nghiệp vụ CRUD tương ứng
 */
function handleApiRequest(request) {
  if (!request || !request.action) {
    throw new Error("Yêu cầu API không hợp lệ: Thiếu thuộc tính 'action'.");
  }

  const action = request.action;
  const data = request.data;

  // Kiểm tra phân quyền truy cập hệ thống (Chủ sở hữu hoặc Gmail Whitelist)
  const authStatus = authService.getAuthStatus();
  if (action !== 'getAuthStatus' && action !== 'showAccessDeniedAlert' && !authStatus.isAuthorized) {
    throw new Error("Bạn không có quyền truy cập, vui lòng liên hệ người có thẩm quyền đối với Spreadsheet này để được cấp quyền truy cập.");
  }

  // Tự động cập nhật timestamp nếu hành động là ghi dữ liệu (mutation)
  const readActions = [
    'getLists', 'getRules', 'getSheetNames', 'getSheetManagerData', 
    'getTemplateManagerData', 'getLastChangedTimestamp', 'getLinkedSheets', 
    'getDefaultFormats', 'getDataEntryConfig', 'checkDatabaseSheets',
    'getAuthEmails', 'getAuthStatus', 'showAccessDeniedAlert', 'getActivityLogs'
  ];
  if (readActions.indexOf(action) === -1) {
    updateLastChangedTimestamp();
  }

  switch (action) {
    case 'getLists':
      return crudService.getLists();
      
    case 'saveList':
      return crudService.saveList(data);
      
    case 'saveListsOrder':
      return crudService.saveListsOrder(data);
      
    case 'deleteList':
      return crudService.deleteList(data);
      
    case 'getRules':
      return crudService.getRules();
      
    case 'saveRule':
      return crudService.saveRule(data);
      
    case 'saveRulesOrder':
      return crudService.saveRulesOrder(data);
      
    case 'deleteRule':
      return crudService.deleteRule(data);
      
    case 'cleanupProperties':
      return crudService.cleanupProperties();
      
    case 'getSheetNames':
      return crudService.getSheetNames();

    // Các Case cho SheetManagerService
    case 'getSheetManagerData':
      return sheetManagerService.getData();
      
    case 'createCustomSheet':
      return sheetManagerService.createCustomSheet(data);
      
    case 'createFolder':
      return sheetManagerService.createFolder(data);
      
    case 'deleteFolder':
      return sheetManagerService.deleteFolder(data);
      
    case 'renameFolder':
      return sheetManagerService.renameFolder(data.folderId, data.newName);
      
    case 'moveSheetToFolder':
      return sheetManagerService.moveSheetToFolder(data.sheetName, data.folderId);
      
    case 'renameSheet':
      return sheetManagerService.renameSheet(data.oldName, data.newName);
      
    case 'duplicateSheet':
      return sheetManagerService.duplicateSheet(data);
      
    case 'deleteSheet':
      return sheetManagerService.deleteSheet(data);
      
    case 'changeSheetColor':
      return sheetManagerService.changeSheetColor(data.sheetName, data.color);
      
    case 'toggleSheetVisibility':
      return sheetManagerService.toggleSheetVisibility(data);

    case 'toggleFolderVisibility':
      return sheetManagerService.toggleFolderVisibility(data);

    case 'changeFolderColor':
      return sheetManagerService.changeFolderColor(data.folderId, data.color);
      
    case 'duplicateFolder':
      return sheetManagerService.duplicateFolder(data);
      
    case 'saveSheetOrder':
      return sheetManagerService.saveOrder(data.rootOrder, data.folders);

    case 'saveSheetComponents':
      return sheetManagerService.saveSheetComponents(data.sheetName, data.components);

    case 'changeBulkSheetsColor':
      return sheetManagerService.changeBulkSheetsColor(data.sheetNames, data.color);

    case 'deleteBulkSheets':
      return sheetManagerService.deleteBulkSheets(data.sheetNames);

    case 'moveBulkSheetsToFolder':
      return sheetManagerService.moveBulkSheetsToFolder(data.sheetNames, data.folderId);

    case 'duplicateBulkSheets':
      return sheetManagerService.duplicateBulkSheets(data.sheetNames);

    // Các Case cho TemplateManagerService
    case 'getTemplateManagerData':
      return templateManagerService.getData();

    case 'getLinkedSheets':
      return templateManagerService.getLinkedSheets(data.templateId);

    case 'syncTemplateSheets':
      return templateManagerService.syncTemplateSheets(data.templateId);

    case 'saveHeader':
      return templateManagerService.saveHeader(data);

    case 'deleteHeader':
      return templateManagerService.deleteHeader(data);

    case 'saveTemplate':
      return templateManagerService.saveTemplate(data);

    case 'deleteTemplate':
      return templateManagerService.deleteTemplate(data);

    case 'applyTemplate':
      return templateManagerService.applyTemplate(data.sheetName, data.templateId);

    case 'getDefaultFormats':
      return templateManagerService.getDefaultFormats();

    case 'saveDefaultFormats':
      return templateManagerService.saveDefaultFormats(data);

    case 'saveTemplateDatabaseConfig':
      return templateManagerService.saveTemplateDatabaseConfig(data);

    case 'initializeDatabaseSheet':
      return templateManagerService.initializeDatabaseSheet(data.templateId, data.dbName, data.linkedSheets);

    case 'checkDatabaseSheets':
      return templateManagerService.checkDatabaseSheets(data.sheetNames);

    case 'protectDatabaseSheets':
      return templateManagerService.protectDatabaseSheets(data);

    case 'unprotectDatabaseSheets':
      return templateManagerService.unprotectDatabaseSheets(data);

    // Các Case cho Nhập Liệu (Data Entry)
    case 'getDataEntryConfig':
      return getDataEntryConfig();

    case 'submitDataEntry':
      return submitDataEntry(data);

    // Các Case cho Authorization (Cấp quyền Admin)
    case 'getAuthEmails':
      return {
        success: true,
        emails: authService.getEmails(),
        ownerEmail: SpreadsheetApp.getActiveSpreadsheet().getOwner() ? SpreadsheetApp.getActiveSpreadsheet().getOwner().getEmail() : "",
        isOwner: authService.getAuthStatus().isOwner
      };
      
    case 'addAuthEmail':
      if (!authService.getAuthStatus().isOwner) {
        return { success: false, message: "Chỉ chủ sở hữu mới có quyền cấp Admin." };
      }
      return authService.addEmail(data);
      
    case 'deleteAuthEmail':
      if (!authService.getAuthStatus().isOwner) {
        return { success: false, message: "Chỉ chủ sở hữu mới có quyền xóa Admin." };
      }
      return authService.deleteEmail(data);
      
    case 'getAuthStatus':
      return authService.getAuthStatus();

    case 'showAccessDeniedAlert':
      showAccessDeniedAlert();
      return { success: true };

    case 'getActivityLogs':
      return { success: true, logs: activityLogService.getLogs() };

    // Optional stateless compute engine. Disabled unless explicitly configured.
    case 'compute':
      return engineClient.compute(
        data && data.operation,
        data && data.input,
        data && data.request_id
      );
      
    case 'clearActivityLogs':
      if (!authService.getAuthStatus().isOwner) {
        return { success: false, message: "Chỉ chủ sở hữu mới có quyền xóa nhật ký." };
      }
      return activityLogService.clearLogs();
      
    case 'getLastChangedTimestamp':
      return PropertiesService.getDocumentProperties().getProperty('LAST_CHANGED_TIMESTAMP') || '0';
      
    default:
      throw new Error("Hành động API không được hỗ trợ: '" + action + "'");
  }
}

/**
 * Hiển thị Sidebar quản lý Dropdown Rules.
 * Hàm này được gọi từ hàm cầu nối của File đích (ví dụ: Antigravity.showSidebar())
 */
function showSidebar() {
  if (!authService.isAuthorized()) {
    showAccessDeniedAlert();
    return;
  }
  const html = HtmlService.createHtmlOutputFromFile('04.1_Sidebar')
      .setTitle('Trình Quản Lý Quy Tắc Dropdown')
      .setWidth(320);
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * Hiển thị Sidebar quản lý các Sheets (Sheet Manager).
 * Hàm này được gọi từ hàm cầu nối của File đích (ví dụ: Antigravity.showSheetManagerSidebar())
 */
function showSheetManagerSidebar() {
  if (!authService.isAuthorized()) {
    showAccessDeniedAlert();
    return;
  }
  const html = HtmlService.createHtmlOutputFromFile('05.1_SheetManager')
      .setTitle('Trình Quản Lý Sheets')
      .setWidth(320);
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * Hiển thị Sidebar quản lý Templates và Headers (Template Manager).
 * Hàm này được gọi từ hàm cầu nối của File đích (ví dụ: Antigravity.showTemplateManagerSidebar())
 */
function showTemplateManagerSidebar() {
  if (!authService.isAuthorized()) {
    showAccessDeniedAlert();
    return;
  }
  const html = HtmlService.createHtmlOutputFromFile('06.1_TemplateManager')
      .setTitle('Trình Quản Lý Templates')
      .setWidth(320);
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * Hiển thị popup thông báo lỗi quyền truy cập từ Server-side.
 */
function showAccessDeniedAlert() {
  SpreadsheetApp.getUi().alert("Thông báo", "Bạn không có quyền truy cập, vui lòng liên hệ người có thẩm quyền đối với Spreadsheet này để được cấp quyền truy cập.", SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * Hiển thị Sidebar nhập liệu dựa trên Template (Data Entry).
 * Hàm này được gọi từ hàm cầu nối của File đích (ví dụ: Antigravity.showDataEntrySidebar())
 */
function showDataEntrySidebar() {
  const html = HtmlService.createHtmlOutputFromFile('11.1_DataEntry')
      .setTitle('Nhập Liệu Theo Bản Mẫu')
      .setWidth(320);
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * Cập nhật thời gian thay đổi cấu hình gần nhất vào DocumentProperties.
 */
function updateLastChangedTimestamp() {
  try {
    PropertiesService.getDocumentProperties().setProperty('LAST_CHANGED_TIMESTAMP', new Date().getTime().toString());
  } catch (e) {
    console.error("Lỗi cập nhật LAST_CHANGED_TIMESTAMP: " + e.toString());
  }
}
