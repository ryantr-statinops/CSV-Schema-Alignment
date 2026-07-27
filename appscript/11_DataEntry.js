/* ================================================
   11_DataEntry.js - BACKEND CHO TÍNH NĂNG NHẬP LIỆU
   ================================================ */

/**
 * Lấy cấu hình các trường nhập liệu dựa trên Template liên kết với Sheet hiện tại.
 * 
 * @returns {Object} Cấu hình gồm trạng thái liên kết, tên sheet, tên template và các fields.
 */
function getDataEntryConfig() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const activeSheet = ss.getActiveSheet();
    const sheetName = activeSheet.getName();

    // 1. Đọc metadata từ Sheet Manager để xác định liên kết template
    const props = PropertiesService.getDocumentProperties();
    const rawSheetManager = props.getProperty('SHEET_MANAGER_DATA');
    let templateBindings = {};
    if (rawSheetManager) {
      try {
        const parsed = JSON.parse(rawSheetManager);
        templateBindings = parsed.templateBindings || {};
      } catch (e) {
        console.error("Lỗi parse SHEET_MANAGER_DATA: " + e.message);
      }
    }
    const binding = templateBindings[sheetName];
    const templateId = binding ? binding.templateId : null;

    // 2. Lấy toàn bộ danh sách Template
    const templatesStr = props.getProperty(Config.TEMPLATE_STORE);
    const templates = templatesStr ? JSON.parse(templatesStr) : {};

    // Nếu sheet hiện tại chưa được liên kết với template nào
    if (!templateId) {
      // Kiểm tra xem sheet này có phải là database sheet của template nào không
      for (let id in templates) {
        const t = templates[id];
        if (t && t.databaseConfig && t.databaseConfig.dbName === sheetName) {
          return { success: true, linked: false, isDbSheet: true, sheetName: sheetName, templateName: t.name };
        }
      }
      return { success: true, linked: false, sheetName: sheetName };
    }

    const template = templates[templateId];
    if (!template) {
      return { success: true, linked: false, sheetName: sheetName };
    }

    // 3. Lấy định nghĩa chi tiết của toàn bộ Headers
    const headersStr = props.getProperty(Config.HEADER_STORE);
    const headers = headersStr ? JSON.parse(headersStr) : {};

    // 4. Lấy tất cả các danh sách Dropdown để phục vụ render select
    const crudService = new CRUD_Service();
    const dropdownLists = crudService.getLists();
    const dropdownMap = {};
    dropdownLists.forEach(function(list) {
      dropdownMap[list.id] = list.options || [];
    });

    const templateHeaders = template.headers || [];
    // Sắp xếp thứ tự theo index thiết lập trong template
    templateHeaders.sort(function(a, b) { return a.index - b.index; });

    const formFields = [];
    templateHeaders.forEach(function(item) {
      const hDef = headers[item.headerId];
      if (hDef) {
        const field = {
          id: hDef.id,
          name: hDef.name,
          dataType: hDef.dataType,
          defaultValueType: hDef.defaultValueType,
          defaultValue: hDef.defaultValue,
          required: hDef.required === true
        };
        // Nếu là kiểu danh sách chọn, đính kèm thêm danh sách các options
        if (hDef.dataType === 'dropdown' && hDef.dropdownListId) {
          field.options = dropdownMap[hDef.dropdownListId] || [];
        }
        formFields.push(field);
      }
    });

    return {
      success: true,
      linked: true,
      sheetName: sheetName,
      templateName: template.name,
      templateId: templateId,
      fields: formFields
    };
  } catch (e) {
    return { success: false, message: "Lỗi lấy cấu hình nhập liệu: " + e.toString() };
  }
}

/**
 * Ghi dữ liệu nhập từ Form vào Sheet hiện tại, tự động đối chiếu theo tiêu đề cột (Row 1).
 * 
 * @param {Object} formData Đối tượng dữ liệu gửi lên { "Tên cột 1": "Giá trị 1", ... }
 * @returns {Object} Kết quả ghi dữ liệu.
 */
function submitDataEntry(formData) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getActiveSheet();
    const sheetName = sheet.getName();

    const props = PropertiesService.getDocumentProperties();
    const rawSheetManager = props.getProperty('SHEET_MANAGER_DATA');
    let templateBindings = {};
    if (rawSheetManager) {
      try {
        const parsed = JSON.parse(rawSheetManager);
        templateBindings = parsed.templateBindings || {};
      } catch (e) {
        console.error("Lỗi parse SHEET_MANAGER_DATA trong submitDataEntry: " + e.message);
      }
    }
    const binding = templateBindings[sheetName];
    const templateId = binding ? binding.templateId : null;

    // Kiểm tra nếu sheet là database sheet thì từ chối nhập liệu
    const allTemplatesStr = props.getProperty(Config.TEMPLATE_STORE);
    const allTemplates = allTemplatesStr ? JSON.parse(allTemplatesStr) : {};
    if (!templateId) {
      for (let id in allTemplates) {
        const t = allTemplates[id];
        if (t && t.databaseConfig && t.databaseConfig.dbName === sheetName) {
          return { success: false, message: "Không thể nhập dữ liệu trực tiếp vào DATABASE. Vui lòng chọn sheet thành phần." };
        }
      }
    }

    // Bản đồ lưu trữ kiểu dữ liệu của các tiêu đề cột (dùng để chuyển ngày tháng)
    const colDataTypeMap = {};
    let template = null;
    let templates = {};
    if (templateId) {
      const templatesStr = props.getProperty(Config.TEMPLATE_STORE);
      templates = templatesStr ? JSON.parse(templatesStr) : {};
      template = templates[templateId];
      
      const headersStr = props.getProperty(Config.HEADER_STORE) || "{}";
      let headers = {};
      try {
        headers = JSON.parse(headersStr);
      } catch(e){}
      
      if (template && template.headers && headers) {
        template.headers.forEach(item => {
          const hDef = headers[item.headerId];
          if (hDef && hDef.name) {
            colDataTypeMap[hDef.name.trim().toLowerCase()] = hDef.dataType;
          }
        });
      }
    }

    // Lấy tiêu đề cột hiện tại ở dòng 1
    const lastCol = sheet.getLastColumn();
    if (lastCol === 0) {
      return { success: false, message: "Sheet hiện tại trống, không có tiêu đề để đối chiếu." };
    }

    const headersRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    const newRowValues = [];

    // Duyệt qua từng cột của Sheet thực tế để xếp giá trị đúng thứ tự
    for (let c = 0; c < lastCol; c++) {
      const colName = (headersRow[c] || "").toString().trim().toLowerCase();
      let val = "";
      
      // Khớp không phân biệt chữ hoa chữ thường
      for (let key in formData) {
        if (key.trim().toLowerCase() === colName) {
          val = formData[key];
          // Chuyển đổi định dạng nếu cần
          if (val === "true" || val === true) {
            val = true;
          } else if (val === "false" || val === false) {
            val = false;
          } else if (colDataTypeMap[colName] === 'date' && val) {
            val = parseToJsDate(val, ss.getSpreadsheetTimeZone());
          }
          break;
        }
      }
      newRowValues.push(val);
    }

    // Ghi dữ liệu dòng mới vào cuối Sheet
    sheet.appendRow(newRowValues);
    
    // Áp dụng định dạng dd/MM/yyyy cho các cột Date của dòng mới thêm
    const addedRowIdx = sheet.getLastRow();
    for (let c = 0; c < lastCol; c++) {
      const colName = (headersRow[c] || "").toString().trim().toLowerCase();
      if (colDataTypeMap[colName] === 'date') {
        sheet.getRange(addedRowIdx, c + 1).setNumberFormat("dd/MM/yyyy");
      }
    }

    // Kiểm tra cấu hình database của Template liên kết để ghi song song vào DATABASE
    if (template && template.databaseConfig) {
      const dbConfig = template.databaseConfig;
      const dbName = dbConfig.dbName || "DATABASE";
      const linkedSheets = dbConfig.linkedSheets || [];
      
      // Chỉ lưu vào database nếu sheetName nằm trong danh sách linkedSheets
      if (linkedSheets.indexOf(sheetName) !== -1) {
        const dbSheet = ss.getSheetByName(dbName);
        if (dbSheet) {
          const dbLastCol = dbSheet.getLastColumn();
          if (dbLastCol > 0) {
            const dbHeadersRow = dbSheet.getRange(1, 1, 1, dbLastCol).getValues()[0];
            const dbRowValues = [];
            const newRowIndex = sheet.getLastRow(); // Lấy chỉ số của dòng vừa được ghi trong sheet con
            
            for (let c = 0; c < dbLastCol; c++) {
              const colName = (dbHeadersRow[c] || "").toString().trim().toLowerCase();
              let val = "";
              
              if (colName === "sheet gốc") {
                val = sheetName;
              } else if (colName === "dòng gốc") {
                val = newRowIndex;
              } else {
                // Khớp không phân biệt chữ hoa chữ thường
                for (let key in formData) {
                  if (key.trim().toLowerCase() === colName) {
                    val = formData[key];
                    if (val === "true" || val === true) {
                      val = true;
                    } else if (val === "false" || val === false) {
                      val = false;
                    } else if (colDataTypeMap[colName] === 'date' && val) {
                      val = parseToJsDate(val, ss.getSpreadsheetTimeZone());
                    }
                    break;
                  }
                }
              }
              dbRowValues.push(val);
            }
            dbSheet.appendRow(dbRowValues);
            
            // Lấy metadata để truyền vào hàm sắp xếp
            const metadata = templateManagerService._getMetadata();
            
            // Sắp xếp lại database sheet theo cấu hình
            templateManagerService.sortDatabaseSheet(dbSheet, template, metadata);
            
            // Đồng bộ định dạng, chiều cao hàng và validation cho database sheet sau khi sắp xếp
            templateManagerService.applyTemplate(dbName, templateId, false, true, false);
          }
          }
        }
      }

    activityLogService.log("đã nhập dữ liệu vào sheet: " + sheetName);
    return { success: true, message: "Đã thêm dữ liệu mới thành công vào sheet '" + sheetName + "'." };
  } catch (e) {
    return { success: false, message: "Lỗi lưu dữ liệu nhập liệu: " + e.toString() };
  }
}
