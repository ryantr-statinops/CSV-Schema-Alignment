/* ================================================
   TEMPLATE MANAGER SERVICE - QUẢN LÝ HEADER VÀ TEMPLATE
   ================================================ */

class TemplateManagerService {
  constructor() {
    // Không lưu trữ bản sao của Config tại constructor để tránh lỗi tải muộn
  }

  /**
   * Đọc metadata của cả Header và Template từ DocumentProperties
   */
  _getMetadata() {
    const props = PropertiesService.getDocumentProperties();
    
    const headersStr = props.getProperty(Config.HEADER_STORE);
    const templatesStr = props.getProperty(Config.TEMPLATE_STORE);
    
    const headers = headersStr ? JSON.parse(headersStr) : {};
    const templates = templatesStr ? JSON.parse(templatesStr) : {};
    
    // Tự động kiểm tra và đồng bộ trạng thái Database với các Sheet thực tế (Self-healing Sync)
    let dirty = false;
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      if (ss) {
        const actualNames = ss.getSheets().map(function(s) { return s.getName(); });
        const actualSet = {};
        actualNames.forEach(function(name) { actualSet[name] = true; });
        
        Object.keys(templates).forEach(function(tId) {
          const t = templates[tId];
          if (t.databaseConfig) {
            const originalLinked = t.databaseConfig.linkedSheets || [];
            
            // 1. Không tự động xóa t.databaseConfig khi thiếu sheet database vật lý.
            // Điều này tránh race condition khi cấu hình mới lưu nhưng sheet chưa được tạo ở backend.
            // Nếu sheet bị xóa ngoài bảng tính, khi chạy Đồng bộ hoặc Nhập liệu hệ thống sẽ tự tạo lại sheet.
            // 2. Lọc bỏ các sheet liên kết thành phần đã bị xóa
            if (originalLinked.length > 0) {
              const cleanedLinked = originalLinked.filter(function(name) {
                return !!actualSet[name];
              });
              if (cleanedLinked.length !== originalLinked.length) {
                t.databaseConfig.linkedSheets = cleanedLinked;
                dirty = true;
              }
            }
          }
        });
      }
    } catch (e) {
      console.error("Lỗi đồng bộ tự sửa lỗi Database Config: " + e.toString());
    }
    
    if (dirty) {
      props.setProperty(Config.TEMPLATE_STORE, JSON.stringify(templates));
    }
    
    return {
      headers: headers,
      templates: templates
    };
  }

  _saveHeaders(headers) {
    PropertiesService.getDocumentProperties().setProperty(Config.HEADER_STORE, JSON.stringify(headers));
  }

  _saveTemplates(templates) {
    PropertiesService.getDocumentProperties().setProperty(Config.TEMPLATE_STORE, JSON.stringify(templates));
  }

  /**
   * Lấy toàn bộ dữ liệu tổng hợp phục vụ hiển thị Sidebar
   */
  getData() {
    try {
      const metadata = this._getMetadata();
      const crudService = new CRUD_Service();
      const dropdownLists = crudService.getLists();
      
      const headersArray = Object.keys(metadata.headers).map(function(id) { 
        return metadata.headers[id]; 
      });
      
      const templatesArray = Object.keys(metadata.templates).map(function(id) { 
        return metadata.templates[id]; 
      });

      return {
        success: true,
        headers: headersArray,
        templates: templatesArray,
        dropdownLists: dropdownLists,
        defaultFormats: this.getDefaultFormats()
      };
    } catch (e) {
      return { success: false, message: "Lỗi tải dữ liệu Template Manager: " + e.message };
    }
  }

  getDefaultFormats() {
    try {
      const props = PropertiesService.getDocumentProperties().getProperty(Config.DEFAULT_FORMATS_STORE);
      if (props) {
        return JSON.parse(props);
      }
    } catch (e) {
      console.error("Lỗi khi lấy định dạng mặc định: " + e.message);
    }
    return {
      header: {
        font: "Arial",
        fontSize: 10,
        bold: true,
        italic: false,
        strikethrough: false,
        textColor: "#000000",
        align: "center",
        columnWidthType: "auto",
        columnWidth: 100,
        rowHeight: 24
      },
      content: {
        font: "Arial",
        fontSize: 10,
        bold: false,
        italic: false,
        strikethrough: false,
        textColor: "#000000",
        align: "center",
        rowHeight: 20
      }
    };
  }

  saveDefaultFormats(formats) {
    try {
      PropertiesService.getDocumentProperties().setProperty(Config.DEFAULT_FORMATS_STORE, JSON.stringify(formats));
      activityLogService.log("đã lưu thiết lập định dạng mặc định");
      return { success: true, message: "Đã lưu cài đặt định dạng mặc định thành công." };
    } catch (e) {
      return { success: false, message: "Lỗi lưu cài đặt định dạng mặc định: " + e.message };
    }
  }


  /* ================================================
     1. METHODS QUẢN LÝ HEADER TOÀN CỤC (SECTION 2)
     ================================================ */

  saveHeader(header) {
    try {
      if (!header.name || !header.name.trim()) {
        return { success: false, message: "Tên Header không được để trống." };
      }

      const metadata = this._getMetadata();
      const headers = metadata.headers;

      if (!header.id) {
        header.id = "header_" + new Date().getTime();
      }

      headers[header.id] = {
        id: header.id,
        name: header.name.trim(),
        dataType: header.dataType || "text",
        dropdownListId: header.dropdownListId || null,
        defaultValueType: header.defaultValueType || "none",
        defaultValue: header.defaultValue !== undefined ? header.defaultValue : "",
        required: header.required === true
      };

      this._saveHeaders(headers);
      activityLogService.log("đã lưu cột Header mẫu: " + header.name.trim());
      return { success: true, message: "Đã lưu định nghĩa Header thành công.", header: headers[header.id] };
    } catch (e) {
      return { success: false, message: e.message };
    }
  }

  deleteHeader(headerId) {
    try {
      const metadata = this._getMetadata();
      const headers = metadata.headers;
      const templates = metadata.templates;

      if (!headers[headerId]) {
        return { success: false, message: "Không tìm thấy Header để xóa." };
      }

      const headerName = headers[headerId].name;
      // Xóa Header định nghĩa
      delete headers[headerId];
      this._saveHeaders(headers);
      activityLogService.log("đã xóa cột Header mẫu: " + headerName);

      // Cập nhật dọn dẹp các Template có liên kết tới Header này
      Object.keys(templates).forEach(function(tId) {
        const template = templates[tId];
        if (template.headers) {
          template.headers = template.headers.filter(function(h) {
            return h.headerId !== headerId;
          });
          // Cập nhật lại chỉ mục index
          template.headers.forEach(function(h, idx) {
            h.index = idx;
          });
        }
      });
      this._saveTemplates(templates);

      return { success: true, message: "Đã xóa định nghĩa Header và cập nhật các bản mẫu thành công." };
    } catch (e) {
      return { success: false, message: e.message };
    }
  }

  /* ================================================
     2. METHODS QUẢN LÝ TEMPLATES (SECTION 1)
     ================================================ */

  saveTemplate(template) {
    try {
      if (!template.name || !template.name.trim()) {
        return { success: false, message: "Tên bản mẫu không được để trống." };
      }

      const metadata = this._getMetadata();
      const templates = metadata.templates;

      if (!template.id) {
        template.id = "template_" + new Date().getTime();
      }

      const existing = templates[template.id] || {};
      const def = this.getDefaultFormats();
      const defH = def.header || {};
      const defC = def.content || {};
      templates[template.id] = {
        id: template.id,
        name: template.name.trim(),
        headers: template.headers || [],
        headerFont: template.headerFont || existing.headerFont || defH.font || "Arial",
        headerFontSize: Number(template.headerFontSize) || existing.headerFontSize || defH.fontSize || 10,
        headerCellHeight: Number(template.headerCellHeight) || defH.rowHeight || 24,
        contentFont: template.contentFont || existing.contentFont || defC.font || "Arial",
        contentFontSize: Number(template.contentFontSize) || existing.contentFontSize || defC.fontSize || 10,
        contentCellHeight: Number(template.contentCellHeight) || defC.rowHeight || 20,
        deleteExtraColumns: !!template.deleteExtraColumns,
        applyTableBorder: template.applyTableBorder !== undefined ? !!template.applyTableBorder : true,
        databaseConfig: existing.databaseConfig || null
      };

      this._saveTemplates(templates);
      activityLogService.log("đã lưu Template bản mẫu: " + template.name.trim());
      return { success: true, message: "Đã lưu bản mẫu thành công.", template: templates[template.id] };
    } catch (e) {
      return { success: false, message: e.message };
    }
  }

  deleteTemplate(templateId) {
    try {
      const metadata = this._getMetadata();
      const templates = metadata.templates;

      if (!templates[templateId]) {
        return { success: false, message: "Không tìm thấy bản mẫu để xóa." };
      }

      const templateName = templates[templateId].name;
      delete templates[templateId];
      this._saveTemplates(templates);
      activityLogService.log("đã xóa Template bản mẫu: " + templateName);

      return { success: true, message: "Đã xóa bản mẫu thành công." };
    } catch (e) {
      return { success: false, message: e.message };
    }
  }

  /* ================================================
     3. THIẾT LẬP CẤU TRÚC SHEETS THỰC TẾ (APPLY TEMPLATE)
     ================================================ */

  applyTemplate(sheetName, templateId, isSync, isDbSheetOverride, isInit) {
    isSync = !!isSync;
    isInit = isInit === undefined ? true : !!isInit;
    try {
      const metadata = this._getMetadata();
      if (!isSync) {
        activityLogService.log("đã áp dụng Template lên sheet: " + sheetName);
      }
      const template = metadata.templates[templateId];
      if (!template) {
        return { success: false, message: "Không tìm thấy bản mẫu ứng dụng." };
      }

      const headersToApply = template.headers || [];
      if (headersToApply.length === 0) {
        return { success: false, message: "Bản mẫu này chưa được cấu hình bất kỳ Header nào." };
      }

      // Sắp xếp thứ tự các header theo index
      const headersToApplyCopy = [...headersToApply];
      headersToApplyCopy.sort(function(a, b) {
        return a.index - b.index;
      });

      const isDbSheet = isDbSheetOverride !== undefined ? !!isDbSheetOverride : (template.databaseConfig && template.databaseConfig.dbName === sheetName);
      if (isDbSheet) {
        // Đăng ký định nghĩa header động cho SHEET GỐC và DÒNG GỐC
        metadata.headers['system_sheet_goc'] = {
          id: 'system_sheet_goc',
          name: 'SHEET GỐC',
          dataType: 'text',
          defaultValueType: 'none'
        };
        metadata.headers['system_dong_goc'] = {
          id: 'system_dong_goc',
          name: 'DÒNG GỐC',
          dataType: 'number',
          defaultValueType: 'none'
        };
        
        headersToApplyCopy.push({
          headerId: 'system_sheet_goc',
          isHidden: false,
          color: null,
          index: headersToApplyCopy.length
        });
        headersToApplyCopy.push({
          headerId: 'system_dong_goc',
          isHidden: false,
          color: null,
          index: headersToApplyCopy.length
        });
      }

      const ss = SpreadsheetApp.getActiveSpreadsheet();
      let sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        sheet = ss.insertSheet(sheetName);
      }

      const defaultFormats = this.getDefaultFormats();

      // 1. Thiết lập chiều cao hàng Tiêu đề và Nội dung
      const defHeaderHeight = template.headerCellHeight || (defaultFormats.header && defaultFormats.header.rowHeight) || 24;
      const defContentHeight = template.contentCellHeight || (defaultFormats.content && defaultFormats.content.rowHeight) || 20;

      if (!isDbSheet || isInit) {
        sheet.setRowHeight(1, Number(defHeaderHeight));
      }
      const maxRows = sheet.getMaxRows();
      if (maxRows >= 2) {
        sheet.setRowHeights(2, maxRows - 1, Number(defContentHeight));
      }

      const crudService = new CRUD_Service();
      const dropdownLists = crudService.getLists();

      const maxCols = sheet.getMaxColumns();

      // 2. Đọc dữ liệu hiện tại để tránh lệch cột khi chèn/sắp xếp lại header
      const existingData = {};
      const newHeaderNamesMap = {};
      headersToApplyCopy.forEach(function(item) {
        const hDef = metadata.headers[item.headerId];
        if (hDef && hDef.name) {
          newHeaderNamesMap[hDef.name.trim().toLowerCase()] = true;
        }
      });

      const nonTemplateColumns = [];
      const lastCol = sheet.getLastColumn();
      const lastRow = sheet.getLastRow();
      
      if (lastCol > 0) {
        const headersRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
        for (let c = 1; c <= lastCol; c++) {
          const hName = (headersRow[c - 1] || "").toString().trim();
          const hNameLower = hName.toLowerCase();
          if (hName) {
            const vals = (lastRow >= 2) ? sheet.getRange(2, c, lastRow - 1, 1).getValues().map(r => r[0]) : [];
            existingData[hNameLower] = {
              name: hName,
              values: vals
            };
            if (!newHeaderNamesMap[hNameLower]) {
              nonTemplateColumns.push({
                name: hName,
                values: vals
              });
            }
          }
        }
      }

      // Xóa sạch validation cũ trên toàn bộ hàng dữ liệu để tránh chồng chéo định dạng cũ
      if (maxRows >= 2 && maxCols > 0) {
        sheet.getRange(2, 1, maxRows - 1, maxCols).clearDataValidations();
      }

      // Duyệt qua danh sách header và ghi vào sheet
      headersToApplyCopy.forEach(function(item, idx) {
        const colIndex = idx + 1;
        const headerDef = metadata.headers[item.headerId];
        if (!headerDef) return; // Header gốc bị xóa

          // A. GHI HÀNG 1 (TIÊU ĐỀ) - Chạy khi init, hoặc sync ở mọi sheet kể cả database
        if (!isDbSheet || isInit || isSync) {
          const headerRange = sheet.getRange(1, colIndex);
          headerRange.setValue(headerDef.name || "");
          headerRange.setVerticalAlignment("middle");
          
          // Gộp định dạng tiêu đề mặc định với tùy chỉnh
          const hFmt = item.headerFormat || {};
          const defH = defaultFormats.header || {};
          
          const finalHFont = hFmt.font || defH.font || "Arial";
          const finalHSize = Number(hFmt.fontSize) || Number(defH.fontSize) || 10;
          const finalHAlign = hFmt.align || defH.align || "center";
          const finalHBold = hFmt.bold !== undefined ? hFmt.bold : (defH.bold !== undefined ? defH.bold : true);
          const finalHItalic = hFmt.italic !== undefined ? hFmt.italic : (defH.italic !== undefined ? defH.italic : false);
          const finalHStrike = hFmt.strikethrough !== undefined ? hFmt.strikethrough : (defH.strikethrough !== undefined ? defH.strikethrough : false);
          const finalHColor = hFmt.textColor || defH.textColor || "#000000";

          headerRange.setFontFamily(finalHFont);
          headerRange.setFontSize(finalHSize);
          headerRange.setHorizontalAlignment(finalHAlign);
          headerRange.setFontWeight(finalHBold ? "bold" : "normal");
          headerRange.setFontStyle(finalHItalic ? "italic" : "normal");
          headerRange.setFontLine(finalHStrike ? "line-through" : "none");
          headerRange.setFontColor(finalHColor);

          // Tô màu nền Header
          if (item.color) {
            headerRange.setBackground(item.color);
          } else {
            headerRange.setBackground(null);
          }

          // Tự động giãn rộng cột hoặc áp dụng độ rộng tùy chỉnh
          const defColWidthType = defH.columnWidthType || 'auto';
          const defColWidth = defH.columnWidth || 100;
          const finalWidthType = item.widthType || defColWidthType;
          const finalWidth = item.width || defColWidth;

          if (finalWidthType === 'custom' && finalWidth) {
            sheet.setColumnWidth(colIndex, Number(finalWidth));
          } else {
            sheet.autoResizeColumn(colIndex);
            const curWidth = sheet.getColumnWidth(colIndex);
            if (curWidth > 0) {
              sheet.setColumnWidth(colIndex, curWidth + 20);
            }
          }
        }

        // B. GHI DỮ LIỆU & THIẾT LẬP RÀNG BUỘC (DATA VALIDATION)
        const cellRange = sheet.getRange(2, colIndex);
        const hNameLower = (headerDef.name || "").toString().trim().toLowerCase();
        
        let columnValues = [];
        let hasExisting = false;
        if (existingData[hNameLower]) {
          columnValues = existingData[hNameLower].values;
          hasExisting = true;
        }

        const dataRowsCount = maxRows - 1;
        let finalValues = [];
        const dataType = headerDef.dataType;
        const defValType = headerDef.defaultValueType;
        const defVal = headerDef.defaultValue;

        // Tính toán giá trị mặc định của cột
        let defaultCellVal = "";
        if (dataType === 'checkbox') {
          defaultCellVal = (defValType === 'true') ? true : false;
        } else if (dataType === 'dropdown') {
          if (defValType === 'dropdownOption' && defVal) defaultCellVal = defVal;
        } else if (dataType === 'date') {
          if (defValType === 'today') defaultCellVal = "=TODAY()";
          else if (defValType === 'userInput' && defVal) defaultCellVal = defVal;
        } else {
          if (defValType === 'userInput' && defVal !== undefined && defVal !== null && defVal !== "") {
            defaultCellVal = (dataType === 'number') ? Number(defVal) : defVal;
          }
        }

        if (hasExisting) {
          // Trả lại đúng dữ liệu cũ đã khớp theo tên Header
          finalValues = columnValues.slice(0, dataRowsCount);
          while (finalValues.length < dataRowsCount) {
            finalValues.push(defaultCellVal);
          }
        } else {
          // Khởi tạo cột mới với giá trị mặc định tương ứng
          for (let r = 0; r < dataRowsCount; r++) {
            finalValues.push(defaultCellVal);
          }
        }

        if (!isDbSheet || isInit || isSync) {
          if (dataRowsCount > 0) {
            const writeRange = sheet.getRange(2, colIndex, dataRowsCount, 1);
            const write2D = finalValues.map(v => [v]);
            writeRange.setValues(write2D);
          }
        }

        // Định dạng cột nội dung
        const cFmt = item.contentFormat || {};
        const defC = defaultFormats.content || {};

        const finalCFont = cFmt.font || defC.font || "Arial";
        const finalCSize = Number(cFmt.fontSize) || Number(defC.fontSize) || 10;
        const finalCAlign = cFmt.align || defC.align || "center";
        const finalCBold = cFmt.bold !== undefined ? cFmt.bold : (defC.bold !== undefined ? defC.bold : false);
        const finalCItalic = cFmt.italic !== undefined ? cFmt.italic : (defC.italic !== undefined ? defC.italic : false);
        const finalCStrike = cFmt.strikethrough !== undefined ? cFmt.strikethrough : (defC.strikethrough !== undefined ? defC.strikethrough : false);
        const finalCColor = cFmt.textColor || defC.textColor || "#000000";

        if (maxRows >= 2) {
          const colContentRange = sheet.getRange(2, colIndex, maxRows - 1);
          colContentRange.setFontFamily(finalCFont);
          colContentRange.setFontSize(finalCSize);
          colContentRange.setHorizontalAlignment(finalCAlign);
          colContentRange.setVerticalAlignment("middle");
          colContentRange.setFontWeight(finalCBold ? "bold" : "normal");
          colContentRange.setFontStyle(finalCItalic ? "italic" : "normal");
          colContentRange.setFontLine(finalCStrike ? "line-through" : "none");
          colContentRange.setFontColor(finalCColor);
        }

        // Áp dụng Data Validation
        if (dataType === 'checkbox') {
          const checkboxValidation = SpreadsheetApp.newDataValidation().requireCheckbox().build();
          if (maxRows >= 2) {
            sheet.getRange(2, colIndex, maxRows - 1).setDataValidation(checkboxValidation);
          } else {
            cellRange.setDataValidation(checkboxValidation);
          }
        } 
        else if (dataType === 'dropdown') {
          const dl = dropdownLists.filter(function(l) {
            return l.id === headerDef.dropdownListId;
          })[0];

          if (dl) {
            const listItems = dl.options || [];
            if (listItems.length > 0) {
              const ruleValidation = SpreadsheetApp.newDataValidation()
                .requireValueInList(listItems, true)
                .setAllowInvalid(false)
                .build();
              if (maxRows >= 2) {
                sheet.getRange(2, colIndex, maxRows - 1).setDataValidation(ruleValidation);
              } else {
                cellRange.setDataValidation(ruleValidation);
              }
            }
          }
        }
        else if (dataType === 'date') {
          const dateValidation = SpreadsheetApp.newDataValidation().requireDate().build();
          if (maxRows >= 2) {
            const colContentRange = sheet.getRange(2, colIndex, maxRows - 1);
            colContentRange.setDataValidation(dateValidation);
            colContentRange.setNumberFormat("dd/MM/yyyy");
          } else {
            cellRange.setDataValidation(dateValidation);
            cellRange.setNumberFormat("dd/MM/yyyy");
          }
        }
      });

      // C. GHI LẠI CÁC CỘT KHÔNG THUỘC TEMPLATE (NẾU CẤU HÌNH YÊU CẦU GIỮ LẠI)
      if (!isDbSheet || isInit || isSync) {
        let nextColIndex = headersToApplyCopy.length + 1;
        if (!template.deleteExtraColumns && nonTemplateColumns.length > 0) {
          nonTemplateColumns.forEach(function(col) {
            if (nextColIndex <= maxCols) {
              sheet.getRange(1, nextColIndex).setValue(col.name);
              const vals2D = col.values.slice(0, maxRows - 1).map(v => [v]);
              while (vals2D.length < maxRows - 1) {
                vals2D.push([""]);
              }
              if (maxRows >= 2) {
                sheet.getRange(2, nextColIndex, maxRows - 1, 1).setValues(vals2D);
              }
              nextColIndex++;
            }
          });
        }

        // Xóa hoặc khôi phục các cột thừa ngoài cấu trúc
        if (template.deleteExtraColumns && headersToApplyCopy.length > 0) {
          if (maxCols >= nextColIndex) {
            sheet.deleteColumns(nextColIndex, maxCols - nextColIndex + 1);
          }
        } else if (!template.deleteExtraColumns) {
          if (maxCols >= nextColIndex) {
            const clearRange = sheet.getRange(1, nextColIndex, maxRows, maxCols - nextColIndex + 1);
            clearRange.clearContent();
            clearRange.clearFormat();
          }
          const currentMaxCols = sheet.getMaxColumns();
          if (currentMaxCols < 26) {
            sheet.insertColumnsAfter(currentMaxCols, 26 - currentMaxCols);
          }
        }
      }

      // Áp dụng hoặc gỡ bỏ border cho toàn bộ bảng dữ liệu (luôn chạy kể cả DB sheet không phải init)
      const applyBorder = template.applyTableBorder !== undefined ? !!template.applyTableBorder : true;
      if (headersToApplyCopy.length > 0) {
        const totalRows = sheet.getMaxRows();
        const totalCols = headersToApplyCopy.length;
        const fullRange = sheet.getRange(1, 1, totalRows, totalCols);
        if (applyBorder) {
          fullRange.setBorder(true, true, true, true, true, true, "#434343", SpreadsheetApp.BorderStyle.SOLID);
        } else {
          fullRange.setBorder(false, false, false, false, false, false);
        }
      }

      // Lưu liên kết Template Binding trong sheetManager metadata (chỉ lưu cho sheet thành phần, không lưu cho database sheet)
      try {
        const sheetManagerMetadata = sheetManagerService._getMetadata();
        if (!sheetManagerMetadata.templateBindings) {
          sheetManagerMetadata.templateBindings = {};
        }
        if (!isDbSheet) {
          sheetManagerMetadata.templateBindings[sheetName] = {
            templateId: templateId,
            templateName: template.name || "Template"
          };
        } else {
          // Loại bỏ khỏi bindings nếu lỡ có
          delete sheetManagerMetadata.templateBindings[sheetName];
        }
        sheetManagerService._saveMetadata(sheetManagerMetadata);
      } catch (bindError) {
        console.error("Lỗi khi lưu liên kết template: " + bindError.message);
      }

      return { success: true, message: "Đã áp dụng cấu trúc Bản mẫu thành công lên Sheet '" + sheetName + "'." };
    } catch (e) {
      return { success: false, message: e.message };
    }
  }

  /**
   * Lấy danh sách các Sheet đang được liên kết với Template chỉ định.
   */
  getLinkedSheets(templateId) {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      sheetManagerService._syncMetadata(ss);
      const sheetManagerMetadata = sheetManagerService._getMetadata();
      const bindings = sheetManagerMetadata.templateBindings || {};
      
      const metadata = this._getMetadata();
      const templates = metadata.templates || {};

      // Thu thập tất cả các tên database sheets của hệ thống để loại bỏ triệt để
      const dbNamesSet = {};
      Object.keys(templates).forEach(function(id) {
        const t = templates[id];
        if (t.databaseConfig && t.databaseConfig.dbName) {
          dbNamesSet[t.databaseConfig.dbName.trim().toLowerCase()] = true;
        }
      });

      // Dọn dẹp templateBindings ngay tại thời điểm query để loại bỏ database sheet nếu lỡ bị bind
      const currentTemplate = templates[templateId];
      if (currentTemplate && currentTemplate.databaseConfig && currentTemplate.databaseConfig.dbName) {
        const currentDbName = currentTemplate.databaseConfig.dbName;
        if (bindings[currentDbName]) {
          delete bindings[currentDbName];
          sheetManagerService._saveMetadata(sheetManagerMetadata);
        }
      }

      const linkedSheets = [];
      for (let sheetName in bindings) {
        if (bindings[sheetName] && bindings[sheetName].templateId === templateId) {
          const lowerName = sheetName.trim().toLowerCase();
          if (dbNamesSet[lowerName]) continue; // Bỏ qua tất cả các database sheets của hệ thống
          linkedSheets.push({
            name: sheetName
          });
        }
      }
      return { success: true, sheets: linkedSheets };
    } catch (e) {
      return { success: false, message: "Lỗi lấy danh sách liên kết: " + e.message };
    }
  }

  /**
   * Đồng bộ tất cả các Sheet liên kết theo cấu hình hiện tại của Template.
   */
  syncTemplateSheets(templateId) {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      sheetManagerService._syncMetadata(ss);
      const sheetManagerMetadata = sheetManagerService._getMetadata();
      const bindings = sheetManagerMetadata.templateBindings || {};
      
      const syncedSheets = [];
      const failedSheets = [];
      
      for (let sheetName in bindings) {
        if (bindings[sheetName] && bindings[sheetName].templateId === templateId) {
          const sheet = ss.getSheetByName(sheetName);
          if (sheet) {
            const res = this.applyTemplate(sheetName, templateId, true);
            if (res.success) {
              syncedSheets.push(sheetName);
            } else {
              failedSheets.push(sheetName + " (" + res.message + ")");
            }
          }
        }
      }

      // Đồng bộ cả Database sheet nếu có cấu hình
      const metadata = this._getMetadata();
      const template = metadata.templates[templateId];
      const dbName = (template && template.databaseConfig) ? template.databaseConfig.dbName : "";
      if (dbName) {
        const dbSheet = ss.getSheetByName(dbName);
        if (dbSheet) {
          const res = this.applyTemplate(dbName, templateId, true, true, false);
          if (res.success) {
            syncedSheets.push(dbName + " (Database)");
          } else {
            failedSheets.push(dbName + " (Database: " + res.message + ")");
          }
        }
      }
      
      if (syncedSheets.length === 0 && failedSheets.length === 0) {
        return { success: true, message: "Không tìm thấy sheet nào liên kết với bản mẫu này để đồng bộ." };
      }
      
      let msg = "Đã đồng bộ thành công " + syncedSheets.length + " sheet(s).";
      if (failedSheets.length > 0) {
        msg += " Thất bại: " + failedSheets.join(", ");
        return { success: false, message: msg };
      }
      
      return { success: true, message: msg };
    } catch (e) {
      return { success: false, message: "Lỗi đồng bộ: " + e.message };
    }
  }

  /**
   * Bảo vệ các cột đã map với template headers trong DATABASE và các sheet liên kết.
   * Sử dụng Sheet.protect() để ngăn người dùng vô tình chỉnh sửa cấu trúc.
   */
  protectDatabaseSheets(templateId) {
    try {
      const metadata = this._getMetadata();
      const template = metadata.templates[templateId];
      if (!template || !template.databaseConfig || !template.databaseConfig.dbName) {
        return { success: false, message: "Không tìm thấy cấu hình DATABASE." };
      }

      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const dbConfig = template.databaseConfig;
      const dbName = dbConfig.dbName;
      const linkedSheets = dbConfig.linkedSheets || [];
      const headersToApply = template.headers || [];
      
      // Lấy danh sách tên cột từ header definitions
      const protectedColumnNames = [];
      headersToApply.forEach(function(item) {
        const hDef = metadata.headers[item.headerId];
        if (hDef && hDef.name) {
          protectedColumnNames.push(hDef.name.trim().toLowerCase());
        }
      });
      protectedColumnNames.push("sheet gốc");
      protectedColumnNames.push("dòng gốc");

      // 1. Bảo vệ DATABASE sheet
      const dbSheet = ss.getSheetByName(dbName);
      if (dbSheet) {
        // Xóa protection cũ nếu có
        const oldProtections = dbSheet.getProtections(SpreadsheetApp.ProtectionType.RANGE);
        oldProtections.forEach(function(p) { p.remove(); });

        // Bảo vệ toàn bộ sheet - chỉ cho phép chỉnh sửa bởi owner
        const protection = dbSheet.protect();
        protection.setDescription("DATABASE sheet - Chỉ admin mới được chỉnh sửa");
        protection.setWarningOnly(true);
        
        // Tìm và map các cột header với chỉ mục thực tế
        const lastCol = dbSheet.getLastColumn();
        if (lastCol > 0) {
          const headerRow = dbSheet.getRange(1, 1, 1, lastCol).getValues()[0];
          const editorEmails = [];
          try {
            const ownerEmail = ss.getOwner().getEmail();
            if (ownerEmail) editorEmails.push(ownerEmail);
          } catch(e) {}
          const authEmails = authService.getEmails() || [];
          authEmails.forEach(function(email) {
            if (editorEmails.indexOf(email) === -1) editorEmails.push(email);
          });

          for (let c = 0; c < lastCol; c++) {
            const colName = (headerRow[c] || "").toString().trim().toLowerCase();
            if (protectedColumnNames.indexOf(colName) > -1) {
              const colRange = dbSheet.getRange(1, c + 1, dbSheet.getMaxRows(), 1);
              const colProtection = colRange.protect();
              colProtection.setDescription("Cột được bảo vệ: " + (headerRow[c] || ""));
              colProtection.setWarningOnly(true);
              // Chỉ owner và admin mới có thể chỉnh sửa
              try {
                colProtection.addEditors(editorEmails);
                colProtection.removeEditors(colProtection.getEditors());
                if (editorEmails.length > 0) {
                  colProtection.addEditors(editorEmails);
                }
              } catch(e) {
                console.error("Lỗi set editors cho protection: " + e.message);
              }
            }
          }
        }
      }

      // 2. Bảo vệ các sheet liên kết thành phần
      linkedSheets.forEach(function(sheetName) {
        if (sheetName === dbName) return;
        const sheet = ss.getSheetByName(sheetName);
        if (!sheet) return;
        
        const oldProtections = sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE);
        oldProtections.forEach(function(p) { p.remove(); });

        const lastCol = sheet.getLastColumn();
        const lastRow = sheet.getLastRow();
        if (lastCol < 1 || lastRow < 1) return;

        const headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

        for (let c = 0; c < lastCol; c++) {
          const colName = (headerRow[c] || "").toString().trim().toLowerCase();
          if (protectedColumnNames.indexOf(colName) > -1) {
            const colRange = sheet.getRange(1, c + 1, sheet.getMaxRows(), 1);
            const colProtection = colRange.protect();
            colProtection.setDescription("Cột DATABASE được bảo vệ: " + (headerRow[c] || ""));
            colProtection.setWarningOnly(true);
          }
        }
      });

      const totalProtected = dbSheet ? 1 + linkedSheets.length : linkedSheets.length;
      activityLogService.log("đã bật bảo vệ cho " + totalProtected + " sheet(s) DATABASE");
      return { success: true, message: "Đã bảo vệ " + totalProtected + " sheet(s) DATABASE thành công." };
    } catch (e) {
      return { success: false, message: "Lỗi bảo vệ DATABASE: " + e.message };
    }
  }

  /**
   * Gỡ bỏ bảo vệ trên tất cả các sheet liên quan đến DATABASE.
   */
  unprotectDatabaseSheets(templateId) {
    try {
      const metadata = this._getMetadata();
      const template = metadata.templates[templateId];
      if (!template || !template.databaseConfig || !template.databaseConfig.dbName) {
        return { success: false, message: "Không tìm thấy cấu hình DATABASE." };
      }

      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const dbConfig = template.databaseConfig;
      const dbName = dbConfig.dbName;
      const linkedSheets = dbConfig.linkedSheets || [];

      const allSheetNames = [dbName].concat(linkedSheets);
      let count = 0;
      allSheetNames.forEach(function(sheetName) {
        const sheet = ss.getSheetByName(sheetName);
        if (!sheet) return;
        const protections = sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE);
        protections.forEach(function(p) { p.remove(); count++; });
      });

      activityLogService.log("đã tắt bảo vệ cho " + count + " range(s) DATABASE");
      return { success: true, message: "Đã gỡ bỏ bảo vệ trên " + count + " range(s)." };
    } catch (e) {
      return { success: false, message: "Lỗi gỡ bỏ bảo vệ DATABASE: " + e.message };
    }
  }

  /**
   * Lưu cấu hình database cho Template chỉ định và thực hiện quét/khởi tạo dữ liệu.
   * Quy trình: Lưu metadata cấu hình TRƯỚC (ghi đè template.databaseConfig + dọn sạch bindings),
   * sau đó mới thực thi khởi tạo sheet vật lý và gộp dữ liệu để tránh race condition.
   */
  saveTemplateDatabaseConfig(data) {
    try {
      const templateId = data.templateId;
      const dbName = data.dbName ? data.dbName.trim() : null;
      const linkedSheets = data.linkedSheets || [];

      const metadata = this._getMetadata();
      const templates = metadata.templates;
      const template = templates[templateId];

      if (!template) {
        return { success: false, message: "Không tìm thấy bản mẫu." };
      }

      // Xóa cấu hình Database
      if (!dbName) {
        const oldConfig = template.databaseConfig;
        template.databaseConfig = null;
        this._saveTemplates(templates);
        if (oldConfig && oldConfig.enableProtection) {
          this.unprotectDatabaseSheets(templateId);
        }
        activityLogService.log("đã xóa cấu hình database cho template: " + template.name);
        return { success: true, message: "Đã xóa cấu hình Database thành công." };
      }

      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const oldDbName = (template.databaseConfig && template.databaseConfig.dbName) ? template.databaseConfig.dbName : null;

      // Xử lý đổi tên sheet database cũ nếu tên bị thay đổi
      if (oldDbName && oldDbName !== dbName) {
        const oldSheet = ss.getSheetByName(oldDbName);
        if (oldSheet) {
          const existingNewSheet = ss.getSheetByName(dbName);
          if (existingNewSheet) {
            ss.deleteSheet(existingNewSheet);
          }
          oldSheet.setName(dbName);
        }
      }

      const enableProtection = data.enableProtection !== undefined ? !!data.enableProtection : false;

      // BƯỚC 1: Lưu metadata cấu hình TRƯỚC (ghi đè template.databaseConfig)
      template.databaseConfig = {
        dbName: dbName,
        linkedSheets: linkedSheets,
        sortMechanism: data.sortMechanism || "sheet",
        sortColumnId: data.sortColumnId || null,
        sortDirection: data.sortDirection || "asc",
        enableProtection: enableProtection
      };
      this._saveTemplates(templates);

      // BƯỚC 2: Dọn sạch bindings của sheet Database ra khỏi templateBindings trong Sheet Manager
      try {
        const sheetManagerMetadata = sheetManagerService._getMetadata();
        if (sheetManagerMetadata.templateBindings) {
          if (oldDbName) delete sheetManagerMetadata.templateBindings[oldDbName];
          delete sheetManagerMetadata.templateBindings[dbName];
          sheetManagerService._saveMetadata(sheetManagerMetadata);
        }
      } catch(e) {
        console.error("Lỗi dọn dẹp templateBindings: " + e.message);
      }

      // Commit metadata ngay lập tức để tránh tranh chấp cache
      SpreadsheetApp.flush();

      if (!data.skipInit) {
        // BƯỚC 3: Khởi tạo sheet vật lý và gộp dữ liệu ở backend (sau khi metadata đã ổn định)
        const initResult = this.initializeDatabaseSheet(templateId, dbName, linkedSheets);
        if (!initResult.success) {
          return { success: false, message: "Đã lưu cấu hình nhưng lỗi khởi tạo Database: " + initResult.message };
        }

        if (enableProtection) {
          const protectResult = this.protectDatabaseSheets(templateId);
          if (!protectResult.success) {
            console.error("Lỗi bảo vệ DATABASE: " + protectResult.message);
          }
        } else if (template.databaseConfig) {
          this.unprotectDatabaseSheets(templateId);
        }
      }

      activityLogService.log("đã lưu cấu hình và khởi tạo database cho template: " + template.name);
      return { success: true, message: "Đã lưu cấu hình DATABASE và đồng bộ dữ liệu thành công!" };
    } catch (e) {
      return { success: false, message: "Lỗi lưu cấu hình database: " + e.message };
    }
  }

  /**
   * Khởi tạo sheet database, đồng bộ định dạng/ràng buộc và quét đẩy toàn bộ dữ liệu hiện tại từ các sheet liên kết.
   */
  initializeDatabaseSheet(templateId, dbName, linkedSheets) {
    try {
      const metadata = this._getMetadata();
      const template = metadata.templates[templateId];
      if (!template) {
        return { success: false, message: "Không tìm thấy bản mẫu." };
      }

      const headersToApply = template.headers || [];
      if (headersToApply.length === 0) {
        return { success: false, message: "Bản mẫu chưa được cấu hình bất kỳ Header nào." };
      }

      // Sắp xếp thứ tự các header theo index
      headersToApply.sort(function(a, b) {
        return a.index - b.index;
      });

      const templateHeaderNames = [];
      const dataTypeMap = {};
      headersToApply.forEach(item => {
        const hDef = metadata.headers[item.headerId];
        if (hDef && hDef.name) {
          const lowerName = hDef.name.trim().toLowerCase();
          templateHeaderNames.push(lowerName);
          dataTypeMap[lowerName] = hDef.dataType;
        }
      });
      templateHeaderNames.push("sheet gốc");
      templateHeaderNames.push("dòng gốc");

      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const timeZone = ss.getSpreadsheetTimeZone();
      let dbSheet = ss.getSheetByName(dbName);
      if (!dbSheet) {
        dbSheet = ss.insertSheet(dbName);
      } else {
        dbSheet.clear();
      }

      const allImportedRows = [];
      linkedSheets.forEach(sheetName => {
        if (sheetName === dbName) return; // Bỏ qua chính database sheet
        
        const sheet = ss.getSheetByName(sheetName);
        if (!sheet) return;
        
        const lastRow = sheet.getLastRow();
        const lastCol = sheet.getLastColumn();
        if (lastRow < 2 || lastCol === 0) return;
        
        const sheetHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => (h || "").toString().trim().toLowerCase());
        const sheetData = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
        
        sheetData.forEach((rowVals, r) => {
          const mappedRow = [];
          templateHeaderNames.forEach(tplName => {
            if (tplName === "sheet gốc") {
              mappedRow.push(sheetName);
            } else if (tplName === "dòng gốc") {
              mappedRow.push(r + 2); // Vị trí dòng thực tế bắt đầu từ 2
            } else {
              const colIdx = sheetHeaders.indexOf(tplName);
              if (colIdx !== -1) {
                let val = rowVals[colIdx];
                if (dataTypeMap[tplName] === 'date' && val) {
                  val = parseToJsDate(val, timeZone);
                }
                mappedRow.push(val);
              } else {
                mappedRow.push("");
              }
            }
          });
          allImportedRows.push(mappedRow);
        });
      });

      const totalImportRows = allImportedRows.length;
      
      // Khởi tạo kích thước hàng tối thiểu
      if (totalImportRows > 0) {
        const currentMaxRows = dbSheet.getMaxRows();
        if (currentMaxRows < totalImportRows + 1) {
          dbSheet.insertRowsAfter(currentMaxRows, totalImportRows + 1 - currentMaxRows);
        }
        
        // Ghi tiêu đề tạm thời vào hàng 1 để applyTemplate đối chiếu
        const tempHeaders = headersToApply.map(item => {
          const hDef = metadata.headers[item.headerId];
          return hDef ? hDef.name : "";
        });
        tempHeaders.push("SHEET GỐC");
        tempHeaders.push("DÒNG GỐC");
        dbSheet.getRange(1, 1, 1, tempHeaders.length).setValues([tempHeaders]);
        
        // Ghi dữ liệu
        dbSheet.getRange(2, 1, totalImportRows, templateHeaderNames.length).setValues(allImportedRows);
        
        const finalMaxRows = dbSheet.getMaxRows();
        if (finalMaxRows > totalImportRows + 1) {
          dbSheet.deleteRows(totalImportRows + 2, finalMaxRows - (totalImportRows + 1));
        }
      } else {
        const currentMaxRows = dbSheet.getMaxRows();
        if (currentMaxRows > 2) {
          dbSheet.deleteRows(3, currentMaxRows - 2);
        }
        dbSheet.getRange(2, 1, 1, templateHeaderNames.length).clearContent();
      }

      // Áp dụng sắp xếp dữ liệu
      this.sortDatabaseSheet(dbSheet, template, metadata);

      // Áp dụng định dạng và validation
      const applyRes = this.applyTemplate(dbName, templateId, false, true);
      if (!applyRes.success) {
        return { success: false, message: "Lỗi áp dụng định dạng database: " + applyRes.message };
      }

      SpreadsheetApp.flush();
      return { success: true };
    } catch (e) {
      return { success: false, message: e.toString() };
    }
  }

  /**
   * Sắp xếp dữ liệu trong DATABASE sheet theo cơ chế đã cấu hình
   */
  sortDatabaseSheet(dbSheet, template, metadata) {
    try {
      const dbConfig = template.databaseConfig;
      if (!dbConfig) return { success: false, message: "Không tìm thấy cấu hình database." };

      const lastRow = dbSheet.getLastRow();
      const lastCol = dbSheet.getLastColumn();
      if (lastRow < 3 || lastCol === 0) {
        return { success: true };
      }

      const headers = dbSheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => (h || "").toString().trim().toLowerCase());
      const sheetGocIdx = headers.indexOf("sheet gốc");
      const dongGocIdx = headers.indexOf("dòng gốc");

      const range = dbSheet.getRange(2, 1, lastRow - 1, lastCol);
      const values = range.getValues();

      if (dbConfig.sortMechanism === 'sheet') {
        const linkedSheetsOrder = dbConfig.linkedSheets || [];
        values.sort(function(rowA, rowB) {
          const sheetA = rowA[sheetGocIdx] || "";
          const sheetB = rowB[sheetGocIdx] || "";
          const idxA = linkedSheetsOrder.indexOf(sheetA);
          const idxB = linkedSheetsOrder.indexOf(sheetB);

          const sortIdxA = idxA !== -1 ? idxA : 999999;
          const sortIdxB = idxB !== -1 ? idxB : 999999;

          if (sortIdxA !== sortIdxB) {
            return sortIdxA - sortIdxB;
          }
          const lineA = Number(rowA[dongGocIdx]) || 0;
          const lineB = Number(rowB[dongGocIdx]) || 0;
          return lineA - lineB;
        });
      } else if (dbConfig.sortMechanism === 'column' && dbConfig.sortColumnId) {
        const headerDef = metadata.headers[dbConfig.sortColumnId];
        const sortColName = headerDef ? headerDef.name.trim().toLowerCase() : "";
        const sortColIdx = headers.indexOf(sortColName);
        const sortDirection = dbConfig.sortDirection || 'asc';

        if (sortColIdx !== -1) {
          values.sort(function(rowA, rowB) {
            let valA = rowA[sortColIdx];
            let valB = rowB[sortColIdx];
            const dataType = headerDef ? headerDef.dataType : 'text';

            if (dataType === 'number') {
              valA = (valA !== "" && valA !== null && valA !== undefined) ? Number(valA) : (sortDirection === 'asc' ? Infinity : -Infinity);
              valB = (valB !== "" && valB !== null && valB !== undefined) ? Number(valB) : (sortDirection === 'asc' ? Infinity : -Infinity);
              if (isNaN(valA)) valA = sortDirection === 'asc' ? Infinity : -Infinity;
              if (isNaN(valB)) valB = sortDirection === 'asc' ? Infinity : -Infinity;
              return sortDirection === 'asc' ? valA - valB : valB - valA;
            } else if (dataType === 'date') {
              valA = valA ? parseToJsDate(valA) : null;
              valB = valB ? parseToJsDate(valB) : null;
              const timeA = (valA instanceof Date && !isNaN(valA.getTime())) ? valA.getTime() : (sortDirection === 'asc' ? Infinity : -Infinity);
              const timeB = (valB instanceof Date && !isNaN(valB.getTime())) ? valB.getTime() : (sortDirection === 'asc' ? Infinity : -Infinity);
              return sortDirection === 'asc' ? timeA - timeB : timeB - timeA;
            } else {
              valA = (valA || "").toString().toLowerCase();
              valB = (valB || "").toString().toLowerCase();
              if (valA === "") return sortDirection === 'asc' ? 1 : -1;
              if (valB === "") return sortDirection === 'asc' ? -1 : 1;
              if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
              if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
              return 0;
            }
          });
        }
      }

      range.setValues(values);
      return { success: true };
    } catch(e) {
      console.error("Lỗi trong sortDatabaseSheet: " + e.message);
      return { success: false, message: e.message };
    }
  }

  /**
   * Kiểm tra xem các sheet được truyền vào có sheet nào là DATABASE của bản mẫu nào không.
   * Trả về danh sách chứa thông tin { sheetName, templateName } nếu tìm thấy.
   */
  checkDatabaseSheets(sheetNames) {
    try {
      const metadata = this._getMetadata();
      const templates = metadata.templates || {};
      const dbSheets = [];

      sheetNames.forEach(function(sheetName) {
        for (let id in templates) {
          const template = templates[id];
          if (template.databaseConfig && template.databaseConfig.dbName === sheetName) {
            dbSheets.push({
              sheetName: sheetName,
              templateName: template.name
            });
            break;
          }
        }
      });

      return { success: true, dbSheets: dbSheets };
    } catch(e) {
      return { success: false, message: "Lỗi kiểm tra database sheets: " + e.toString() };
    }
  }
}

// Khởi tạo đối tượng toàn cục
const templateManagerService = new TemplateManagerService();

/**
 * Chuyển đổi chuỗi ngày/Date object thành đối tượng Date của Javascript có nhận diện timezone để chống lệch ngày
 */
function parseToJsDate(val, timeZone) {
  if (val instanceof Date) {
    return val;
  }
  if (val && typeof val === 'string' && val.trim() !== '') {
    val = val.trim();
    if (!timeZone) {
      try {
        timeZone = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
      } catch(e) {
        timeZone = "Asia/Ho_Chi_Minh";
      }
    }
    // YYYY-MM-DD
    var match = val.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (match) {
      const formatted = match[1] + "-" + String(match[2]).padStart(2, '0') + "-" + String(match[3]).padStart(2, '0');
      try {
        return Utilities.parseDate(formatted, timeZone, "yyyy-MM-dd");
      } catch(e) {
        return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
      }
    }
    // DD/MM/YYYY
    match = val.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (match) {
      const formatted = String(match[1]).padStart(2, '0') + "/" + String(match[2]).padStart(2, '0') + "/" + match[3];
      try {
        return Utilities.parseDate(formatted, timeZone, "dd/MM/yyyy");
      } catch(e) {
        return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
      }
    }
    var d = new Date(val);
    if (!isNaN(d.getTime())) {
      return d;
    }
  }
  return val;
}
