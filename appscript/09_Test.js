/* ================================================
   09_Test.js - TEST & DEBUG UTILITIES - PHIÊN BẢN CẬP NHẬT
   ================================================ */

/**
 * Hàm kiểm thử tự động chạy toàn bộ quy trình CRUD mới và ghi log kết quả
 */
function runTests() {
  logger.info("=== BAT DAU CHAY THU NGHIEM CRUD_SERVICE MOI ===");
  
  // 1. Kiểm tra lấy danh sách ban đầu
  const initialLists = crudService.getLists();
  const initialRules = crudService.getRules();
  logger.info("So luong dropdown lists ban dau: " + initialLists.length);
  logger.info("So luong rules ban dau: " + initialRules.length);
  
  // 2. Tạo một Dropdown List giả lập
  const testList = {
    id: "list_test_" + new Date().getTime(),
    name: "Danh sach Test Tu dong",
    options: ["Gia tri A", "Gia tri B", "Gia tri C"]
  };
  
  logger.info("--- BUOC 1: KIEM THU THEM MOI DROPDOWN LIST ---");
  const saveListResponse = crudService.saveList(testList);
  logger.info("Ket qua saveList: " + JSON.stringify(saveListResponse));
  
  // Xác minh list đã nằm trong bộ nhớ chưa
  let listsAfterSave = crudService.getLists();
  let foundList = listsAfterSave.find(l => l.id === testList.id);
  if (foundList && foundList.name === testList.name) {
    logger.info("✅ THANH CONG: Danh sach dropdown da duoc ghi nhan trong bo nho.");
  } else {
    logger.error("❌ THAT BAI: Khong tim thay danh sach dropdown vua them.");
    return;
  }
  
  // 3. Tạo một Dropdown Rule liên kết với List trên
  const testRule = {
    id: "rule_test_" + new Date().getTime(),
    name: "Quy tac Test Tu dong",
    matchType: "all",
    matchValue: "",
    dropdowns: [
      {
        dropdownListId: testList.id,
        range: "Z1:Z5" // Dung range an toan de tranh anh huong den nguoi dung
      }
    ]
  };
  
  logger.info("--- BUOC 2: KIEM THU THEM MOI QUY TAC ---");
  const saveRuleResponse = crudService.saveRule(testRule);
  logger.info("Ket qua saveRule: " + JSON.stringify(saveRuleResponse));
  
  // Xác minh rule đã nằm trong bộ nhớ chưa
  let rulesAfterSave = crudService.getRules();
  let foundRule = rulesAfterSave.find(r => r.id === testRule.id);
  if (foundRule && foundRule.name === testRule.name && foundRule.dropdowns.length > 0) {
    logger.info("✅ THANH CONG: Quy tac da duoc ghi nhan va lien ket.");
  } else {
    logger.error("❌ THAT BAI: Khong tim thay quy tac hoac lien ket bi loi.");
    return;
  }
  
  // 4. Cập nhật Dropdown List (Thêm tùy chọn mới) và kiểm tra đồng bộ
  logger.info("--- BUOC 3: KIEM THU CAP NHAT LIST & DONG BO RULE ---");
  testList.options.push("Gia tri moi");
  const updateListResponse = crudService.saveList(testList);
  logger.info("Ket qua cap nhat List: " + JSON.stringify(updateListResponse));
  
  // 5. Xóa Dropdown List và kiểm tra tự động gỡ liên kết trong Rule
  logger.info("--- BUOC 4: KIEM THU XOA DROPDOWN LIST & GO LIEN KET ---");
  const deleteListResponse = crudService.deleteList(testList.id);
  logger.info("Ket qua deleteList: " + JSON.stringify(deleteListResponse));
  
  // Kiểm tra list đã biến mất chưa
  const listsAfterDelete = crudService.getLists();
  const stillFoundList = listsAfterDelete.find(l => l.id === testList.id);
  if (!stillFoundList) {
    logger.info("✅ THANH CONG: Danh sach dropdown da duoc don sach.");
  } else {
    logger.error("❌ THAT BAI: Danh sach dropdown van ton tai trong bo nho.");
  }
  
  // Kiểm tra rule có tự động mất liên kết tới list đó không
  const rulesAfterListDelete = crudService.getRules();
  const ruleToVerify = rulesAfterListDelete.find(r => r.id === testRule.id);
  if (ruleToVerify) {
    const hasDeletedList = ruleToVerify.dropdowns.some(d => d.dropdownListId === testList.id);
    if (!hasDeletedList) {
      logger.info("✅ THANH CONG: Lien ket toi dropdown list bi xoa da tu dong duoc loai bo khoi quy tac.");
    } else {
      logger.error("❌ THAT BAI: Quy tac van giu lien ket toi dropdown list da bi xoa.");
    }
  }
  
  // 6. Xóa Dropdown Rule
  logger.info("--- BUOC 5: KIEM THU XOA QUY TAC ---");
  const deleteRuleResponse = crudService.deleteRule(testRule.id);
  logger.info("Ket qua deleteRule: " + JSON.stringify(deleteRuleResponse));
  
  const rulesAfterDelete = crudService.getRules();
  const stillFoundRule = rulesAfterDelete.find(r => r.id === testRule.id);
  if (!stillFoundRule) {
    logger.info("✅ THANH CONG: Quy tac da duoc don sach khoi bo nho.");
  } else {
    logger.error("❌ THAT BAI: Quy tac van ton tai trong bo nho.");
  }
  
  logger.info("=== KET THUC CHAY THU NGHIEM CRUD_SERVICE MOI ===");
  
  // Chạy tiếp bộ thử nghiệm Sheet Manager
  runSheetManagerTests();

  // Chạy tiếp bộ thử nghiệm Template Manager
  runTemplateManagerTests();
}

/**
 * Bộ kiểm thử tự động cho SheetManagerService
 */
function runSheetManagerTests() {
  logger.info("=== BAT DAU CHAY THU NGHIEM SHEET_MANAGER MOI ===");
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  if (sheets.length === 0) {
    logger.error("❌ Bảng tính không có sheet nào để test.");
    return;
  }
  const firstSheetName = sheets[0].getName();
  
  // 1. Tạo thư mục ảo test
  logger.info("--- BUOC 1: TAO THU MUC AO ---");
  const folderId = "folder_test_" + new Date().getTime();
  const createRes = sheetManagerService.createFolder("Thư mục Test Tự động");
  logger.info("Kết quả tạo thư mục: " + JSON.stringify(createRes));
  
  const data = sheetManagerService.getData();
  const folderKey = Object.keys(data.folders).find(key => data.folders[key].name === "Thư mục Test Tự động");
  if (folderKey) {
    logger.info("✅ THANH CONG: Thư mục ảo đã được tạo.");
    runSheetManagerSubTests(folderKey, firstSheetName);
  } else {
    logger.error("❌ THAT BAI: Thư mục ảo chưa được tạo.");
  }
}

function runSheetManagerSubTests(folderId, firstSheetName) {
  // 2. Gom sheet vào thư mục
  logger.info("--- BUOC 2: GOM SHEET VAO THU MUC ---");
  const moveRes = sheetManagerService.moveSheetToFolder(firstSheetName, folderId);
  logger.info("Kết quả di chuyển: " + JSON.stringify(moveRes));
  
  const dataAfterMove = sheetManagerService.getData();
  if (dataAfterMove.folders[folderId].sheetNames.indexOf(firstSheetName) > -1) {
    logger.info("✅ THANH CONG: Sheet '" + firstSheetName + "' đã được gom vào thư mục.");
  } else {
    logger.error("❌ THAT BAI: Sheet chưa nằm trong thư mục.");
  }

  // 3. Nhân bản sheet
  logger.info("--- BUOC 3: NHAN BAN SHEET ---");
  const dupRes = sheetManagerService.duplicateSheet(firstSheetName);
  logger.info("Kết quả sao chép: " + JSON.stringify(dupRes));
  
  const ssAfterDup = SpreadsheetApp.getActiveSpreadsheet();
  const duplicatedSheet = ssAfterDup.getSheets().find(s => s.getName().indexOf("Bản sao của " + firstSheetName) > -1);
  if (duplicatedSheet) {
    logger.info("✅ THANH CONG: Sheet '" + duplicatedSheet.getName() + "' đã được tạo.");
    
    // 4. Xóa sheet nhân bản
    logger.info("--- BUOC 4: XOA SHEET NHAN BAN ---");
    const delRes = sheetManagerService.deleteSheet(duplicatedSheet.getName());
    logger.info("Kết quả xóa sheet: " + JSON.stringify(delRes));
    
    if (!ssAfterDup.getSheetByName(duplicatedSheet.getName())) {
      logger.info("✅ THANH CONG: Bản sao đã được dọn sạch.");
    } else {
      logger.error("❌ THAT BAI: Bản sao vẫn chưa bị xóa khỏi bảng tính.");
    }
  } else {
    logger.error("❌ THAT BAI: Sao chép sheet thất bại.");
  }

  // 5. Giải phóng di chuyển sheet ra lại root
  logger.info("--- BUOC 5: DI CHUYEN SHEET RA NGOAI ROOT ---");
  sheetManagerService.moveSheetToFolder(firstSheetName, null);
  
  // 6. Xóa thư mục test
  logger.info("--- BUOC 6: XOA THU MUC AO ---");
  const delFolderRes = sheetManagerService.deleteFolder(folderId);
  logger.info("Kết quả xóa thư mục: " + JSON.stringify(delFolderRes));
  
  const finalData = sheetManagerService.getData();
  if (!finalData.folders[folderId]) {
    logger.info("✅ THANH CONG: Thư mục test đã được thu hồi.");
  } else {
    logger.error("❌ THAT BAI: Thư mục test vẫn còn tồn tại.");
  }
  // 7. Kiểm thử tích hợp tạo Sheet mới tùy chỉnh
  logger.info("--- BUOC 7: KIEM THU TAO SHEET MOI TUY CHINH ---");
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 7a. Tạo sheet rỗng
  const emptyRes = sheetManagerService.createCustomSheet({ name: "TEST_INTEGRATED_EMPTY", type: "empty" });
  logger.info("Tạo sheet rỗng: " + JSON.stringify(emptyRes));
  const sheetEmpty = ss.getSheetByName("TEST_INTEGRATED_EMPTY");
  if (sheetEmpty) {
    logger.info("✅ THANH CONG: Da tao sheet rong test.");
  } else {
    logger.error("❌ THAT BAI: Khong the tao sheet rong.");
  }

  // 7b. Tạo sheet copy
  const copyRes = sheetManagerService.createCustomSheet({ 
    name: "TEST_INTEGRATED_COPY", 
    type: "copy", 
    sourceSheetName: "TEST_INTEGRATED_EMPTY" 
  });
  logger.info("Tạo sheet copy: " + JSON.stringify(copyRes));
  const sheetCopy = ss.getSheetByName("TEST_INTEGRATED_COPY");
  if (sheetCopy) {
    logger.info("✅ THANH CONG: Da tao sheet copy test.");
  } else {
    logger.error("❌ THAT BAI: Khong the tao sheet copy.");
  }

  // 7c. Kiểm thử thao tác hàng loạt
  logger.info("--- BUOC 7c: KIEM THU THAO TAC HANG LOAT ---");
  const bulkSheets = ["TEST_INTEGRATED_EMPTY", "TEST_INTEGRATED_COPY"];
  
  // Test changeBulkSheetsColor
  const bulkColorRes = sheetManagerService.changeBulkSheetsColor(bulkSheets, "#EAF4FF");
  logger.info("Đổi màu hàng loạt: " + JSON.stringify(bulkColorRes));
  if (sheetEmpty.getTabColor() === "#eaf4ff") {
    logger.info("✅ THANH CONG: Doi mau hàng loat ok.");
  } else {
    logger.warn("⚠️ CANH BAO: Doi mau hàng loat tab color chưa khop.");
  }

  // Test duplicateBulkSheets
  const bulkDupRes = sheetManagerService.duplicateBulkSheets(bulkSheets);
  logger.info("Nhân bản hàng loạt: " + JSON.stringify(bulkDupRes));
  const emptyCopy = ss.getSheetByName("TEST_INTEGRATED_EMPTY_Bản_sao");
  const copyCopy = ss.getSheetByName("TEST_INTEGRATED_COPY_Bản_sao");
  if (emptyCopy && copyCopy) {
    logger.info("✅ THANH CONG: Nhan ban hàng loat ok.");
    ss.deleteSheet(emptyCopy);
    ss.deleteSheet(copyCopy);
  } else {
    logger.error("❌ THAT BAI: Nhan ban hàng loat loi.");
  }

  // Test deleteBulkSheets
  const bulkDelRes = sheetManagerService.deleteBulkSheets(bulkSheets);
  logger.info("Xóa hàng loạt: " + JSON.stringify(bulkDelRes));
  if (!ss.getSheetByName("TEST_INTEGRATED_EMPTY") && !ss.getSheetByName("TEST_INTEGRATED_COPY")) {
    logger.info("✅ THANH CONG: Xóa hàng loat ok.");
  } else {
    logger.error("❌ THAT BAI: Xóa hàng loat chua sach.");
    // Dọn dẹp thủ công nếu còn
    const s1 = ss.getSheetByName("TEST_INTEGRATED_EMPTY");
    const s2 = ss.getSheetByName("TEST_INTEGRATED_COPY");
    if (s1) ss.deleteSheet(s1);
    if (s2) ss.deleteSheet(s2);
  }

  logger.info("=== KET THUC CHAY THU NGHIEM SHEET_MANAGER MOI ===");
}

/**
 * Bộ kiểm thử tự động cho TemplateManagerService
 */
function runTemplateManagerTests() {
  logger.info("=== BAT DAU CHAY THU NGHIEM TEMPLATE_MANAGER MOI ===");
  
  // 1. Tạo một Header định nghĩa giả lập
  const testHeader = {
    id: "header_test_" + new Date().getTime(),
    name: "Header Test Unit",
    dataType: "formula",
    defaultValueType: "userInput",
    defaultValue: "=A2+B2"
  };

  logger.info("--- BUOC 1: KIEM THU THEM MOI HEADER ---");
  const saveHeaderRes = templateManagerService.saveHeader(testHeader);
  logger.info("Ket qua saveHeader: " + JSON.stringify(saveHeaderRes));

  // Xác minh Header tồn tại
  let data = templateManagerService.getData();
  let foundHeader = data.headers.filter(h => h.id === testHeader.id)[0];
  if (foundHeader && foundHeader.name === testHeader.name) {
    logger.info("✅ THANH CONG: Header test da duoc ghi nhan.");
  } else {
    logger.error("❌ THAT BAI: Khong tim thay Header.");
    return;
  }

  // 2. Tạo một Template và liên kết Header trên
  const testTemplate = {
    id: "template_test_" + new Date().getTime(),
    name: "Template Test Unit",
    headers: [
      {
        headerId: testHeader.id,
        isHidden: false,
        color: "#EAF4FF",
        index: 0
      }
    ],
    headerFont: "Georgia",
    headerFontSize: 12,
    headerCellHeight: 35,
    contentFont: "Lexend",
    contentFontSize: 11,
    contentCellHeight: 25
  };

  logger.info("--- BUOC 2: KIEM THU THEM MOI TEMPLATE ---");
  const saveTemplateRes = templateManagerService.saveTemplate(testTemplate);
  logger.info("Ket qua saveTemplate: " + JSON.stringify(saveTemplateRes));

  // Xác minh Template tồn tại
  data = templateManagerService.getData();
  let foundTemplate = data.templates.filter(t => t.id === testTemplate.id)[0];
  if (foundTemplate && foundTemplate.name === testTemplate.name) {
    logger.info("✅ THANH CONG: Template test da duoc ghi nhan.");
  } else {
    logger.error("❌ THAT BAI: Khong tim thay Template.");
    return;
  }

  // 3. Áp dụng template lên một Sheet thử nghiệm
  logger.info("--- BUOC 3: AP DUNG TEMPLATE LEN SHEET THU NGHIEM ---");
  const applyRes = templateManagerService.applyTemplate("MINIHIPPO_TEST_TEMPLATE", testTemplate.id);
  logger.info("Ket qua applyTemplate: " + JSON.stringify(applyRes));

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("MINIHIPPO_TEST_TEMPLATE");
  if (sheet) {
    logger.info("✅ THANH CONG: Sheet test template da duoc khoi tao.");
    const headerVal = sheet.getRange("A1").getValue();
    const cellFormula = sheet.getRange("A2").getFormula();
    const cellBg = sheet.getRange("A1").getBackground();
    
    if (headerVal === testHeader.name) {
      logger.info("✅ THANH CONG: O A1 ghi dung ten tieu de: " + headerVal);
    } else {
      logger.error("❌ THAT BAI: O A1 ghi sai tieu de: " + headerVal);
    }
    
    if (cellFormula === testHeader.defaultValue) {
      logger.info("✅ THANH CONG: O A2 ghi dung cong thuc formula: " + cellFormula);
    } else {
      logger.error("❌ THAT BAI: O A2 ghi sai cong thuc formula: " + cellFormula);
    }

    if (cellBg === testTemplate.headers[0].color.toLowerCase()) {
      logger.info("✅ THANH CONG: O A1 ghi dung mau nen header: " + cellBg);
    } else {
      logger.warn("⚠️ CANH BAO: O A1 ghi sai mau nen: " + cellBg);
    }

    // Xác thực cấu hình định dạng (Formatting) mới
    const hFont = sheet.getRange("A1").getFontFamily();
    const hSize = sheet.getRange("A1").getFontSize();
    const hHeight = sheet.getRowHeight(1);
    const cFont = sheet.getRange("A2").getFontFamily();
    const cSize = sheet.getRange("A2").getFontSize();
    const cHeight = sheet.getRowHeight(2);

    if (hFont === "Georgia" && hSize === 12 && hHeight === 35) {
      logger.info("✅ THANH CONG: Dinh dang ô Tieu de dung (Font Georgia, Size 12, Height 35)");
    } else {
      logger.error(`❌ THAT BAI: Dinh dang ô Tieu de sai (Font: ${hFont}, Size: ${hSize}, Height: ${hHeight})`);
    }

    const cFontRow5 = sheet.getRange("A5").getFontFamily();
    const cSizeRow5 = sheet.getRange("A5").getFontSize();
    const cHeightRow5 = sheet.getRowHeight(5);

    if (cFont === "Lexend" && cSize === 11 && cHeight === 25 &&
        cFontRow5 === "Lexend" && cSizeRow5 === 11 && cHeightRow5 === 25) {
      logger.info("✅ THANH CONG: Dinh dang ô Noi dung dung tren toan bo cot tu dong 2 xuong (Font Lexend, Size 11, Height 25)");
    } else {
      logger.error(`❌ THAT BAI: Dinh dang ô Noi dung sai (A2 Font: ${cFont}, Size: ${cSize}, Height: ${cHeight}; A5 Font: ${cFontRow5}, Size: ${cSizeRow5}, Height: ${cHeightRow5})`);
    }

    // 3b. Kiểm định liên kết và đồng bộ Template
    logger.info("--- BUOC 3b: KIEM THU LIEN KET VA DONG BO TEMPLATE ---");
    const linkRes = templateManagerService.getLinkedSheets(testTemplate.id);
    logger.info("Kết quả getLinkedSheets: " + JSON.stringify(linkRes));
    if (linkRes.success && linkRes.sheets.some(s => s.name === "MINIHIPPO_TEST_TEMPLATE")) {
      logger.info("✅ THANH CONG: Liên kết sheet vật lý với template thành công.");
    } else {
      logger.error("❌ THAT BAI: Không tìm thấy sheet liên kết.");
    }

    // Giả lập người dùng thay đổi định dạng (màu nền và chiều cao hàng)
    sheet.getRange("A1").setBackground("#FF0000");
    sheet.setRowHeight(1, 15);
    sheet.getRange("A2").setValue("Dữ liệu tĩnh thủ công");

    // Đồng bộ lại định dạng
    const syncRes = templateManagerService.syncTemplateSheets(testTemplate.id);
    logger.info("Kết quả syncTemplateSheets: " + JSON.stringify(syncRes));

    const restoredBg = sheet.getRange("A1").getBackground();
    const restoredHeight = sheet.getRowHeight(1);
    const preservedVal = sheet.getRange("A2").getValue();

    if (restoredBg === testTemplate.headers[0].color.toLowerCase() && restoredHeight === testTemplate.headerCellHeight) {
      logger.info("✅ THANH CONG: Đồng bộ định dạng thành công.");
    } else {
      logger.error(`❌ THAT BAI: Đồng bộ định dạng thất bại. Bg: ${restoredBg}, Height: ${restoredHeight}`);
    }

    if (preservedVal === "Dữ liệu tĩnh thủ công") {
      logger.info("✅ THANH CONG: Dữ liệu tĩnh của người dùng không bị ghi đè.");
    } else {
      logger.error("❌ THAT BAI: Dữ liệu tĩnh của người dùng bị ghi đè!");
    }

    // 3c. Kiểm định tính năng DATABASE
    logger.info("--- BUOC 3c: KIEM THU TINH NANG DATABASE (KEM SAP XEP) ---");
    sheet.getRange("A2").setValue(10);
    
    // Tạo sheet thứ 2 để test sắp xếp theo sheet
    const sheet2Name = "MINIHIPPO_TEST_TEMPLATE_2";
    let sheet2 = ss.getSheetByName(sheet2Name);
    if (sheet2) ss.deleteSheet(sheet2);
    sheet2 = ss.insertSheet(sheet2Name);
    templateManagerService.applyTemplate(sheet2Name, testTemplate.id);
    sheet2.getRange("A2").setValue(20);

    try {
      const shManagerMetadata = sheetManagerService._getMetadata();
      if (!shManagerMetadata.templateBindings) shManagerMetadata.templateBindings = {};
      shManagerMetadata.templateBindings["MINIHIPPO_TEST_TEMPLATE"] = {
        templateId: testTemplate.id,
        templateName: testTemplate.name
      };
      shManagerMetadata.templateBindings[sheet2Name] = {
        templateId: testTemplate.id,
        templateName: testTemplate.name
      };
      sheetManagerService._saveMetadata(shManagerMetadata);
    } catch(e) {
      logger.warn("Không thể lưu template binding cho test: " + e.message);
    }

    const dbNameTest = "MINIHIPPO_TEST_DB";
    
    // Test 1: Sắp xếp theo sheet (thứ tự 1 -> 2)
    logger.info("Test 3c.1: Sap xep theo sheet [1, 2]");
    const dbConfigRes = templateManagerService.saveTemplateDatabaseConfig({
      templateId: testTemplate.id,
      dbName: dbNameTest,
      linkedSheets: ["MINIHIPPO_TEST_TEMPLATE", sheet2Name],
      sortMechanism: "sheet"
    });
    
    const dbSheet = ss.getSheetByName(dbNameTest);
    if (dbSheet) {
      logger.info("✅ THANH CONG: Khởi tạo sheet DATABASE vật lý thành công.");
      
      let dbRow2Val = dbSheet.getRange("A2").getValue();
      let dbRow3Val = dbSheet.getRange("A3").getValue();
      if (Number(dbRow2Val) === 10 && Number(dbRow3Val) === 20) {
        logger.info("✅ THANH CONG: Sap xep dung thu tu sheet [1, 2]");
      } else {
        logger.error(`❌ THAT BAI: Sai thu tu sap xep sheet. Row2=${dbRow2Val}, Row3=${dbRow3Val}`);
      }
      
      // Test 2: Sắp xếp theo sheet (đảo thứ tự 2 -> 1)
      logger.info("Test 3c.2: Sap xep theo sheet [2, 1] (Reorder)");
      templateManagerService.saveTemplateDatabaseConfig({
        templateId: testTemplate.id,
        dbName: dbNameTest,
        linkedSheets: [sheet2Name, "MINIHIPPO_TEST_TEMPLATE"],
        sortMechanism: "sheet"
      });
      
      dbRow2Val = dbSheet.getRange("A2").getValue();
      dbRow3Val = dbSheet.getRange("A3").getValue();
      if (Number(dbRow2Val) === 20 && Number(dbRow3Val) === 10) {
        logger.info("✅ THANH CONG: Sap xep dung thu tu sheet sau khi Reorder [2, 1]");
      } else {
        logger.error(`❌ THAT BAI: Sai thu tu sap xep sheet sau Reorder. Row2=${dbRow2Val}, Row3=${dbRow3Val}`);
      }

      // Test 3: Sắp xếp theo cột (giảm dần)
      logger.info("Test 3c.3: Sap xep theo cot so giam dan");
      templateManagerService.saveTemplateDatabaseConfig({
        templateId: testTemplate.id,
        dbName: dbNameTest,
        linkedSheets: ["MINIHIPPO_TEST_TEMPLATE", sheet2Name],
        sortMechanism: "column",
        sortColumnId: testHeader.id,
        sortDirection: "desc"
      });

      dbRow2Val = dbSheet.getRange("A2").getValue();
      dbRow3Val = dbSheet.getRange("A3").getValue();
      if (Number(dbRow2Val) === 20 && Number(dbRow3Val) === 10) {
        logger.info("✅ THANH CONG: Sap xep dung thu tu cot giam dan (20 -> 10)");
      } else {
        logger.error(`❌ THAT BAI: Sai thu tu sap xep cot giam dan. Row2=${dbRow2Val}, Row3=${dbRow3Val}`);
      }

      // Test 4: Sắp xếp theo cột (tăng dần)
      logger.info("Test 3c.4: Sap xep theo cot so tang dan");
      templateManagerService.saveTemplateDatabaseConfig({
        templateId: testTemplate.id,
        dbName: dbNameTest,
        linkedSheets: ["MINIHIPPO_TEST_TEMPLATE", sheet2Name],
        sortMechanism: "column",
        sortColumnId: testHeader.id,
        sortDirection: "asc"
      });

      dbRow2Val = dbSheet.getRange("A2").getValue();
      dbRow3Val = dbSheet.getRange("A3").getValue();
      if (Number(dbRow2Val) === 10 && Number(dbRow3Val) === 20) {
        logger.info("✅ THANH CONG: Sap xep dung thu tu cot tang dan (10 -> 20)");
      } else {
        logger.error(`❌ THAT BAI: Sai thu tu sap xep cot tang dan. Row2=${dbRow2Val}, Row3=${dbRow3Val}`);
      }
      
      // Test 5: Nhập liệu song song
      logger.info("Test 3c.5: Nhap lieu song song");
      ss.setActiveSheet(sheet);
      const testFormData = {};
      testFormData[testHeader.name] = 15;
      
      const submitRes = submitDataEntry(testFormData);
      logger.info("Kết quả submitDataEntry: " + JSON.stringify(submitRes));
      
      const dbRow2 = dbSheet.getRange("A2").getValue();
      const dbRow3 = dbSheet.getRange("A3").getValue();
      const dbRow4 = dbSheet.getRange("A4").getValue();
      
      if (Number(dbRow2) === 10 && Number(dbRow3) === 15 && Number(dbRow4) === 20) {
        logger.info("✅ THANH CONG: Nhap lieu va tu dong sap xep lai theo cot dung vi tri.");
      } else {
        logger.error(`❌ THAT BAI: Nhap lieu hoac sap xep sai. Row2=${dbRow2}, Row3=${dbRow3}, Row4=${dbRow4}`);
      }
      
      ss.deleteSheet(dbSheet);
      logger.info("Đã dọn dẹp sheet database test.");
    } else {
      logger.error("❌ THAT BAI: Sheet DATABASE vật lý không được tạo ra.");
    }

    // Dọn dẹp sheet2
    if (ss.getSheetByName(sheet2Name)) {
      ss.deleteSheet(sheet2);
      logger.info("Đã dọn dẹp sheet test template 2.");
    }

    // Dọn dẹp sheet test
    ss.deleteSheet(sheet);
    logger.info("Đã dọn dẹp sheet test template.");
  } else {
    logger.error("❌ THAT BAI: Không tim thay sheet test sau khi apply.");
  }

  // 4. Xóa Template và Header
  logger.info("--- BUOC 4: DON DEP METADATA TEST ---");
  templateManagerService.deleteTemplate(testTemplate.id);
  templateManagerService.deleteHeader(testHeader.id);
  
  data = templateManagerService.getData();
  const stillHeader = data.headers.some(h => h.id === testHeader.id);
  const stillTemplate = data.templates.some(t => t.id === testTemplate.id);
  
  if (!stillHeader && !stillTemplate) {
    logger.info("✅ THANH CONG: Da xoa sach metadata test.");
  } else {
    logger.error("❌ THAT BAI: Metadata test chua duoc xoa sach.");
  }

  // Chạy thêm bộ kiểm thử phân quyền Admin
  runAuthTests();

  // Chạy thêm bộ kiểm thử nhật ký hoạt động
  runActivityLogTests();

  logger.info("=== KET THUC CHAY THU NGHIEM TEMPLATE_MANAGER MOI ===");
}

/**
 * Bộ kiểm thử tự động cho AuthService
 */
function runAuthTests() {
  logger.info("=== BAT DAU CHAY THU NGHIEM AUTHORIZATION ===");
  
  // 1. Lưu lại danh sách admin ban đầu để khôi phục
  const originalEmails = authService.getEmails();
  logger.info("Danh sach email whitelist ban dau: " + JSON.stringify(originalEmails));
  
  try {
    // 2. Thêm email whitelist giả lập
    const testEmail = "test-admin-" + new Date().getTime() + "@gmail.com";
    logger.info("--- BUOC 1: KIEM THU THEM MOI ADMIN WHITELIST ---");
    const addRes = authService.addEmail(testEmail);
    logger.info("Ket qua addEmail: " + JSON.stringify(addRes));
    
    // Xác minh email đã ở trong whitelist
    let emails = authService.getEmails();
    if (emails.indexOf(testEmail) !== -1) {
      logger.info("✅ THANH CONG: Da them email vao whitelist.");
    } else {
      logger.error("❌ THAT BAI: Khong tim thay email vua them.");
    }
    
    // 3. Kiểm tra tính năng duplicate email
    logger.info("--- BUOC 2: KIEM THU THEM TRUNG LAP ADMIN ---");
    const duplicateRes = authService.addEmail(testEmail);
    logger.info("Ket qua duplicateRes: " + JSON.stringify(duplicateRes));
    
    // 4. Kiểm tra validate định dạng email
    logger.info("--- BUOC 3: KIEM THU VALIDATE DINH DANG EMAIL ---");
    const invalidRes = authService.addEmail("invalid-email-format");
    logger.info("Ket qua validate email loi: " + JSON.stringify(invalidRes));
    if (!invalidRes.success) {
      logger.info("✅ THANH CONG: He thong chan dung email sai dinh dang.");
    } else {
      logger.error("❌ THAT BAI: He thong cho phep email sai dinh dang.");
    }
    
    // 5. Kiểm tra phân quyền truy cập
    logger.info("--- BUOC 4: KIEM THU PHAN QUYEN TRUY CAP ---");
    const authStatus = authService.getAuthStatus();
    logger.info("Trang thai auth hien tai: " + JSON.stringify(authStatus));
    
    // 6. Xóa email whitelist và khôi phục
    logger.info("--- BUOC 5: KIEM THU XOA ADMIN WHITELIST ---");
    const delRes = authService.deleteEmail(testEmail);
    logger.info("Ket qua deleteEmail: " + JSON.stringify(delRes));
    
    emails = authService.getEmails();
    if (emails.indexOf(testEmail) === -1) {
      logger.info("✅ THANH CONG: Da xoa email khoi whitelist.");
    } else {
      logger.error("❌ THAT BAI: Email van ton tai trong whitelist.");
    }
  } finally {
    // Khôi phục danh sách cũ
    authService._saveEmails(originalEmails);
    logger.info("Da khoi phuc lai danh sach whitelist ban dau.");
  }
  
  logger.info("=== KET THUC CHAY THU NGHIEM AUTHORIZATION ===");
}

/**
 * Bộ kiểm thử tự động cho ActivityLogService
 */
function runActivityLogTests() {
  logger.info("=== BAT DAU CHAY THU NGHIEM ACTIVITY_LOG ===");
  
  // 1. Lưu lại danh sách logs ban đầu để khôi phục
  const originalLogs = activityLogService.getLogs();
  logger.info("So luong logs ban dau: " + originalLogs.length);
  
  try {
    // 2. Thêm log mới
    logger.info("--- BUOC 1: GHI LOG MOI ---");
    activityLogService.log("test_integrated_action_1");
    activityLogService.log("test_integrated_action_2");
    
    let logs = activityLogService.getLogs();
    if (logs.length >= 2 && logs[0].action === "test_integrated_action_2" && logs[1].action === "test_integrated_action_1") {
      logger.info("✅ THANH CONG: Ghi log va sap xep dung thu tu.");
    } else {
      logger.error("❌ THAT BAI: Logs khong dung thu tu hoac thieu.");
    }
    
    // 3. Kiểm tra giới hạn 100 dòng
    logger.info("--- BUOC 2: KIEM THU GIOI HAN 100 DONG ---");
    const fakeLogs = [];
    for (let i = 0; i < 105; i++) {
      fakeLogs.push({
        email: "test@gmail.com",
        action: "action_" + i,
        timestamp: new Date().getTime() - i * 1000
      });
    }
    activityLogService._saveLogs(fakeLogs);
    
    // Ghi thêm 1 log để kích hoạt cắt tỉa (splice)
    activityLogService.log("action_new_trigger");
    
    logs = activityLogService.getLogs();
    logger.info("So luong logs sau khi ghi dong thu 106: " + logs.length);
    if (logs.length === 100) {
      logger.info("✅ THANH CONG: Log da duoc cat tỉa giu dung 100 dong.");
      if (logs[0].action === "action_new_trigger") {
        logger.info("✅ THANH CONG: Log moi nhat nam o dau.");
      } else {
        logger.error("❌ THAT BAI: Log moi nhat khong nam o dau.");
      }
    } else {
      logger.error("❌ THAT BAI: So luong log vuot qua 100 (Hien tai: " + logs.length + ").");
    }
    
    // 4. Kiểm tra xóa logs
    logger.info("--- BUOC 3: KIEM THU XOA TOAN BO LOG ---");
    const clearRes = activityLogService.clearLogs();
    logs = activityLogService.getLogs();
    if (clearRes.success && logs.length === 0) {
      logger.info("✅ THANH CONG: Da xoa sach lich su log.");
    } else {
      logger.error("❌ THAT BAI: Khong the xoa log hoac danh sach khong trong.");
    }
  } finally {
    // Khôi phục logs cũ
    activityLogService._saveLogs(originalLogs);
    logger.info("Da khoi phuc lai danh sach logs ban dau.");
  }
  
  logger.info("=== KET THUC CHAY THU NGHIEM ACTIVITY_LOG ===");
}
