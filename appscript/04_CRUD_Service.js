/* ================================================
   CRUD SERVICE - QUẢN LÝ QUY TẮC VÀ DANH SÁCH DROPDOWN
   ================================================ */

class CRUD_Service {
  constructor() {
    // Không lưu trữ bản sao của Config và logger tại constructor để tránh lỗi tải muộn (lazy-loading) trong Apps Script.
  }

  /* ================================================
     1. METHODS CHO DROPDOWN LISTS
     ================================================ */

  /**
   * Lấy tất cả các Dropdown Lists từ PropertiesService (Dùng DocumentProperties để hoạt động trong thư viện / standalone)
   * @returns {Array} Danh sách các dropdown lists
   */
  getLists() {
    try {
      logger.debug('Đang đọc danh sách dropdown lists từ bộ nhớ...');
      const props = PropertiesService.getDocumentProperties().getProperty(Config.DROPDOWN_LISTS_STORE);
      const lists = props ? JSON.parse(props) : [];
      logger.info(`Đã tải thành công ${lists.length} danh sách dropdown.`);
      return lists;
    } catch (error) {
      logger.error('Lỗi khi lấy danh sách dropdown lists: ' + error.toString());
      return [];
    }
  }

  /**
   * Lưu hoặc cập nhật một Dropdown List, đồng thời tự động cập nhật lại các Rule có liên quan
   * @param {Object} list Đối tượng dropdown list cần lưu
   * @returns {Object} Kết quả lưu hành động
   */
  saveList(list) {
    try {
      logger.info(`Đang tiến hành lưu danh sách dropdown: "${list.name}" (ID: ${list.id})`);
      const lists = this.getLists();
      
      const index = lists.findIndex(function(l) { return l.id === list.id; });
      let isNew = true;
      if (index > -1) {
        lists[index] = list; // Cập nhật list cũ
        isNew = false;
        logger.debug(`Đã cập nhật dropdown list có sẵn (vị trí: ${index})`);
      } else {
        lists.push(list); // Thêm list mới
        logger.debug('Đã thêm mới dropdown list vào danh sách.');
      }
      
      // Lưu lại vào PropertiesService (DocumentProperties)
      PropertiesService.getDocumentProperties().setProperty(
        Config.DROPDOWN_LISTS_STORE, 
        JSON.stringify(lists)
      );
      logger.info('Đã lưu danh sách dropdown vào bộ nhớ PropertiesService.');
      
      activityLogService.log((isNew ? "đã thêm mới danh sách dropdown: " : "đã cập nhật danh sách dropdown: ") + list.name);
      
      // Đồng bộ lại các Rules sử dụng list này lên Spreadsheet
      const rules = this.getRules();
      const linkedRules = rules.filter(function(rule) {
        return rule.dropdowns && rule.dropdowns.some(function(d) { return d.dropdownListId === list.id; });
      });
      
      let syncMsg = "Lưu thành công danh sách.";
      if (linkedRules.length > 0) {
        logger.info(`Tìm thấy ${linkedRules.length} quy tắc liên quan cần cập nhật.`);
        const self = this;
        linkedRules.forEach(function(rule) {
          self.applySingleRule(rule);
        });
        syncMsg += ` Đã đồng bộ lại ${linkedRules.length} quy tắc liên kết.`;
      }
      
      return { success: true, message: syncMsg };
    } catch (e) {
      logger.error(`Lỗi trong quá trình lưu danh sách dropdown: ` + e.toString());
      return { success: false, message: "Lỗi lưu danh sách: " + e.toString() };
    }
  }

  /**
   * Lưu lại toàn bộ danh sách dropdown theo thứ tự mới
   * @param {Array} lists Danh sách dropdown mới đã sắp xếp
   * @returns {Object} Kết quả lưu hành động
   */
  saveListsOrder(lists) {
    try {
      PropertiesService.getDocumentProperties().setProperty(
        Config.DROPDOWN_LISTS_STORE, 
        JSON.stringify(lists)
      );
      logger.info('Đã lưu thứ tự danh sách dropdown mới.');
      activityLogService.log("đã sắp xếp lại thứ tự các danh sách dropdown");
      return { success: true };
    } catch (e) {
      logger.error('Lỗi khi lưu thứ tự danh sách dropdown: ' + e.toString());
      return { success: false, message: e.toString() };
    }
  }

  /**
   * Xóa một Dropdown List khỏi hệ thống theo ID và tự động loại bỏ liên kết trong Rules
   * @param {string} listId ID của danh sách dropdown cần xóa
   * @returns {Object} Kết quả xóa
   */
  deleteList(listId) {
    try {
      logger.info(`Đang tiến hành xóa danh sách dropdown có ID: ${listId}`);
      const lists = this.getLists();
      const targetList = lists.find(function(l) { return l.id === listId; });
      const listName = targetList ? targetList.name : listId;
      
      const updatedLists = lists.filter(function(l) { return l.id !== listId; });
      
      PropertiesService.getDocumentProperties().setProperty(
        Config.DROPDOWN_LISTS_STORE, 
        JSON.stringify(updatedLists)
      );
      logger.info(`Đã xóa danh sách dropdown khỏi bộ nhớ. Còn lại: ${updatedLists.length}`);
      activityLogService.log("đã xóa danh sách dropdown: " + listName);

      // Loại bỏ list này khỏi các quy tắc (rules)
      const rules = this.getRules();
      let ruleChanged = false;
      const self = this;
      const updatedRules = rules.map(function(rule) {
        if (rule.dropdowns) {
          const initialLen = rule.dropdowns.length;
          rule.dropdowns = rule.dropdowns.filter(function(d) { return d.dropdownListId !== listId; });
          if (rule.dropdowns.length !== initialLen) {
            ruleChanged = true;
            // Áp dụng lại quy tắc này vì đã mất một dropdown liên kết
            self.applySingleRule(rule);
          }
        }
        return rule;
      });

      if (ruleChanged) {
        PropertiesService.getDocumentProperties().setProperty(
          Config.DROPDOWN_RULES_STORE, 
          JSON.stringify(updatedRules)
        );
        logger.info('Đã cập nhật và đồng bộ lại các quy tắc bị ảnh hưởng do xóa dropdown list.');
      }

      return { success: true };
    } catch (e) {
      logger.error('Lỗi khi xóa danh sách dropdown: ' + e.toString());
      return { success: false, message: e.toString() };
    }
  }


  /* ================================================
     2. METHODS CHO DROPDOWN RULES
     ================================================ */

  /**
   * Lấy tất cả các Rules đã lưu từ PropertiesService (Dùng DocumentProperties)
   * @returns {Array} Danh sách các quy tắc
   */
  getRules() {
    try {
      logger.debug('Đang đọc danh sách rules từ bộ nhớ...');
      const props = PropertiesService.getDocumentProperties().getProperty(Config.DROPDOWN_RULES_STORE);
      const rules = props ? JSON.parse(props) : [];
      logger.info(`Đã tải thành công ${rules.length} quy tắc.`);
      return rules;
    } catch (error) {
      logger.error('Lỗi khi lấy danh sách rules: ' + error.toString());
      return [];
    }
  }

  /**
   * Lưu hoặc cập nhật một Rule, đồng thời tự động áp dụng trực tiếp lên các Sheet
   * @param {Object} rule Đối tượng rule cần lưu
   * @returns {Object} Kết quả lưu hành động
   */
  saveRule(rule) {
    try {
      logger.info(`Đang tiến hành lưu quy tắc: "${rule.name}" (ID: ${rule.id})`);
      const rules = this.getRules();
      
      // Tìm xem Rule đã tồn tại chưa (dựa vào ID)
      const index = rules.findIndex(function(r) { return r.id === rule.id; });
      let isNew = true;
      if (index > -1) {
        rules[index] = rule; // Cập nhật rule cũ
        isNew = false;
        logger.debug(`Đã cập nhật rule có sẵn (vị trí: ${index})`);
      } else {
        rules.push(rule); // Thêm rule mới
        logger.debug('Đã thêm mới rule vào danh sách.');
      }
      
      // Lưu lại vào PropertiesService (DocumentProperties)
      PropertiesService.getDocumentProperties().setProperty(
        Config.DROPDOWN_RULES_STORE, 
        JSON.stringify(rules)
      );
      logger.info('Đã lưu quy tắc vào bộ nhớ PropertiesService.');
      
      activityLogService.log((isNew ? "đã thêm mới quy tắc dropdown: " : "đã cập nhật quy tắc dropdown: ") + rule.name);
      
      // Áp dụng trực tiếp Rule này lên các sheet thỏa mãn điều kiện
      const applyResult = this.applySingleRule(rule);
      
      return { success: true, message: applyResult };
    } catch (e) {
      logger.error(`Lỗi trong quá trình lưu quy tắc: ` + e.toString());
      return { success: false, message: "Lỗi lưu: " + e.toString() };
    }
  }

  /**
   * Lưu lại toàn bộ danh sách quy tắc theo thứ tự mới
   * @param {Array} rules Danh sách quy tắc mới đã sắp xếp
   * @returns {Object} Kết quả lưu hành động
   */
  saveRulesOrder(rules) {
    try {
      PropertiesService.getDocumentProperties().setProperty(
        Config.DROPDOWN_RULES_STORE, 
        JSON.stringify(rules)
      );
      logger.info('Đã lưu thứ tự quy tắc mới.');
      activityLogService.log("đã sắp xếp lại thứ tự các quy tắc dropdown");
      return { success: true };
    } catch (e) {
      logger.error('Lỗi khi lưu thứ tự quy tắc: ' + e.toString());
      return { success: false, message: e.toString() };
    }
  }

  /**
   * Xóa một Rule khỏi hệ thống theo ID
   * @param {string} ruleId ID của quy tắc cần xóa
   * @returns {Object} Kết quả xóa
   */
  deleteRule(ruleId) {
    try {
      logger.info(`Đang tiến hành xóa quy tắc có ID: ${ruleId}`);
      const rules = this.getRules();
      const targetRule = rules.find(function(r) { return r.id === ruleId; });
      const ruleName = targetRule ? targetRule.name : ruleId;
      
      const updatedRules = rules.filter(function(r) { return r.id !== ruleId; });
      
      PropertiesService.getDocumentProperties().setProperty(
        Config.DROPDOWN_RULES_STORE, 
        JSON.stringify(updatedRules)
      );
      logger.info(`Đã xóa quy tắc khỏi bộ nhớ. Tổng số quy tắc còn lại: ${updatedRules.length}`);
      activityLogService.log("đã xóa quy tắc dropdown: " + ruleName);
      return { success: true };
    } catch (e) {
      logger.error('Lỗi khi xóa quy tắc: ' + e.toString());
      return { success: false, message: e.toString() };
    }
  }

  /**
   * Áp dụng cấu hình Validation của Rule lên các Sheet thỏa mãn điều kiện
   * @param {Object} rule Đối tượng quy tắc cần áp dụng
   * @returns {string} Thông điệp kết quả
   */
  applySingleRule(rule) {
    logger.info(`Bắt đầu áp dụng quy tắc "${rule.name}" lên các sheet...`);
    const ss = Config.DESTINATION_SPREADSHEET_ID 
      ? SpreadsheetApp.openById(Config.DESTINATION_SPREADSHEET_ID) 
      : SpreadsheetApp.getActiveSpreadsheet();
    const sheets = ss.getSheets();
    
    // Đọc danh sách tất cả các dropdown lists có sẵn để tra cứu options
    const lists = this.getLists();
    const listMap = {};
    lists.forEach(function(l) {
      listMap[l.id] = l;
    });

    if (!rule.dropdowns || rule.dropdowns.length === 0) {
      logger.warn(`Quy tắc "${rule.name}" không có dropdown nào được liên kết.`);
      return "Lưu thành công nhưng quy tắc không có dropdown liên kết nào.";
    }

    const updatedSheets = [];
    const matchVal = (rule.matchValue || "").trim().toLowerCase();
    
    sheets.forEach((sheet) => {
      const sheetName = sheet.getName();
      const nameLower = sheetName.toLowerCase();
      let isMatch = false;
      
      // Kiểm tra điều kiện khớp tên Sheet
      if (rule.matchType === 'all') {
        isMatch = true;
      } else if (rule.matchType === 'selected') {
        isMatch = rule.selectedSheets && rule.selectedSheets.indexOf(sheetName) > -1;
      } else if (matchVal !== "") {
        if (rule.matchType === 'starts_with') {
          isMatch = nameLower.indexOf(matchVal) === 0;
        } else if (rule.matchType === 'ends_with') {
          isMatch = nameLower.slice(-matchVal.length) === matchVal;
        } else if (rule.matchType === 'exact') {
          isMatch = nameLower === matchVal;
        }
      }
      
      // Nếu khớp, tiến hành áp dụng validation cho từng dropdown liên kết
      if (isMatch) {
        let appliedCount = 0;
        rule.dropdowns.forEach(function(item) {
          const dl = listMap[item.dropdownListId];
          if (!dl || !dl.options || dl.options.length === 0) {
            logger.warn(`Không tìm thấy hoặc danh sách dropdown trống cho ID: ${item.dropdownListId}`);
            return;
          }
          
          try {
            const rangeStr = item.range || Config.DEFAULT_RANGE;
            const validationRule = SpreadsheetApp.newDataValidation()
              .requireValueInList(dl.options, true)
              .setAllowInvalid(false)
              .build();
              
            const range = sheet.getRange(rangeStr);
            range.setDataValidation(validationRule);
            appliedCount++;
            logger.debug(`Đã áp dụng Dropdown "${dl.name}" thành công cho Sheet: "${sheetName}" tại ô: ${rangeStr}`);
          } catch (e) {
            logger.warn(`Không thể áp dụng Dropdown "${dl ? dl.name : item.dropdownListId}" cho Sheet: "${sheetName}". Lỗi dải ô hoặc cú pháp: ` + e.toString());
          }
        });
        
        if (appliedCount > 0) {
          updatedSheets.push(sheetName);
        }
      }
    });
    
    if (updatedSheets.length > 0) {
      const successMsg = "Đã đồng bộ thành công cho: " + updatedSheets.join(", ");
      logger.info(successMsg);
      return successMsg;
    } else {
      const warnMsg = "Lưu thành công nhưng không tìm thấy sheet nào khớp điều kiện.";
      logger.warn(warnMsg);
      return warnMsg;
    }
  }

  /* ================================================
     3. UTILITY METHODS - DỌN DẸP PROPERTIES & SHEET UTILS
     ================================================ */

  /**
   * Quét và dọn dẹp các key không cần thiết trong Document Properties
   * @returns {Object} Kết quả dọn dẹp
   */
  cleanupProperties() {
    try {
      logger.info("Bắt đầu dọn dẹp các thuộc tính không cần thiết trong DocumentProperties...");
      const docProps = PropertiesService.getDocumentProperties();
      const allProps = docProps.getProperties();
      const allowedKeys = [
        Config.DROPDOWN_LISTS_STORE,
        Config.DROPDOWN_RULES_STORE,
        Config.TEMPLATE_STORE,
        Config.HEADER_STORE,
        'SHEET_MANAGER_DATA'
      ];
      let deletedCount = 0;
      
      for (let key in allProps) {
        if (allowedKeys.indexOf(key) === -1) {
          docProps.deleteProperty(key);
          deletedCount++;
          logger.info(`Đã xóa key thuộc tính cũ/thừa: "${key}"`);
        }
      }
      
      const successMsg = `Đã dọn dẹp xong. Đã xóa ${deletedCount} thuộc tính không còn sử dụng.`;
      logger.info(successMsg);
      return { success: true, message: successMsg };
    } catch (e) {
      logger.error('Lỗi khi dọn dẹp Document Properties: ' + e.toString());
      return { success: false, message: "Lỗi dọn dẹp: " + e.toString() };
    }
  }

  /**
   * Lấy danh sách tên tất cả các sheet trong Spreadsheet
   * @returns {Array} Danh sách tên các sheet
   */
  getSheetNames() {
    try {
      logger.info("Đang lấy danh sách tên các sheet...");
      const ss = Config.DESTINATION_SPREADSHEET_ID 
        ? SpreadsheetApp.openById(Config.DESTINATION_SPREADSHEET_ID) 
        : SpreadsheetApp.getActiveSpreadsheet();
      const sheets = ss.getSheets();
      const names = sheets.map(function(s) { return s.getName(); });
      logger.info(`Đã tải thành công ${names.length} tên sheet.`);
      return names;
    } catch (e) {
      logger.error('Lỗi khi lấy danh sách tên sheet: ' + e.toString());
      return [];
    }
  }
}

// Khởi tạo instance dịch vụ toàn cục
const crudService = new CRUD_Service();
