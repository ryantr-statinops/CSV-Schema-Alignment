/* ================================================
   SHEET MANAGER SERVICE - BACKEND
   ================================================ */

class SheetManagerService {
  constructor() {
    this.storeKey = 'SHEET_MANAGER_DATA';
  }

  /**
   * Lấy dữ liệu lưu trữ metadata của Thư mục và thứ tự ảo từ DocumentProperties
   */
  _getMetadata() {
    const props = PropertiesService.getDocumentProperties();
    const raw = props.getProperty(this.storeKey);
    if (!raw) {
      return { rootOrder: [], folders: {}, templateBindings: {}, sheetComponents: {} };
    }
    try {
      const parsed = JSON.parse(raw);
      if (!parsed.templateBindings) parsed.templateBindings = {};
      if (!parsed.sheetComponents) parsed.sheetComponents = {};
      return parsed;
    } catch (e) {
      console.error("Lỗi parse metadata SheetManager: " + e.message);
      return { rootOrder: [], folders: {}, templateBindings: {}, sheetComponents: {} };
    }
  }

  /**
   * Lưu trữ metadata của Thư mục và thứ tự ảo vào DocumentProperties
   */
  _saveMetadata(metadata) {
    const props = PropertiesService.getDocumentProperties();
    props.setProperty(this.storeKey, JSON.stringify(metadata));
  }

  /**
   * Đồng bộ hóa metadata với danh sách các sheet thực tế trong Spreadsheet.
   * Xóa bỏ các sheet đã bị xóa trực tiếp bằng tay khỏi metadata và thêm các sheet mới tạo.
   */
  _syncMetadata(ss) {
    const metadata = this._getMetadata();
    const sheets = ss.getSheets();
    const actualNames = sheets.map(function(s) { return s.getName(); });
    const actualNamesSet = {};
    actualNames.forEach(function(name) { actualNamesSet[name] = true; });

    // 1. Dọn dẹp metadata: Loại bỏ các sheet không còn tồn tại vật lý
    metadata.rootOrder = metadata.rootOrder.filter(function(item) {
      if (item.type === 'sheet') {
        return !!actualNamesSet[item.name];
      }
      return true; // Giữ lại folders
    });

    Object.keys(metadata.folders).forEach(function(fId) {
      metadata.folders[fId].sheetNames = metadata.folders[fId].sheetNames.filter(function(name) {
        return !!actualNamesSet[name];
      });
    });

    // Dọn dẹp templateBindings mồ côi
    if (!metadata.templateBindings) {
      metadata.templateBindings = {};
    }
    Object.keys(metadata.templateBindings).forEach(function(name) {
      if (!actualNamesSet[name]) {
        delete metadata.templateBindings[name];
      }
    });

    // Dọn dẹp các database sheet ra khỏi templateBindings để tránh lỗi UI
    try {
      const props = PropertiesService.getDocumentProperties();
      const templatesStr = props.getProperty(Config.TEMPLATE_STORE);
      if (templatesStr) {
        const templates = JSON.parse(templatesStr);
        Object.keys(templates).forEach(function(tId) {
          const t = templates[tId];
          if (t.databaseConfig && t.databaseConfig.dbName) {
            const dbName = t.databaseConfig.dbName;
            delete metadata.templateBindings[dbName];
          }
        });
      }
    } catch (e) {
      console.error("Lỗi dọn dẹp database sheet khỏi templateBindings: " + e.message);
    }

    // Dọn dẹp sheetComponents mồ côi
    if (!metadata.sheetComponents) {
      metadata.sheetComponents = {};
    }
    Object.keys(metadata.sheetComponents).forEach(function(name) {
      if (!actualNamesSet[name]) {
        delete metadata.sheetComponents[name];
      }
    });

    // 2. Đồng bộ các sheet mới chưa được khai báo vào rootOrder
    const trackedNames = {};
    metadata.rootOrder.forEach(function(item) {
      if (item.type === 'sheet') {
        trackedNames[item.name] = true;
      }
    });
    Object.keys(metadata.folders).forEach(function(fId) {
      metadata.folders[fId].sheetNames.forEach(function(name) {
        trackedNames[name] = true;
      });
    });

    actualNames.forEach(function(name) {
      if (!trackedNames[name]) {
        metadata.rootOrder.push({ type: 'sheet', name: name });
      }
    });

    // 3. Xóa các folders mồ côi không nằm trong rootOrder
    const folderIdsInRoot = {};
    metadata.rootOrder.forEach(function(item) {
      if (item.type === 'folder') {
        folderIdsInRoot[item.id] = true;
      }
    });
    Object.keys(metadata.folders).forEach(function(fId) {
      if (!folderIdsInRoot[fId]) {
        delete metadata.folders[fId];
      }
    });

    this._saveMetadata(metadata);
    return metadata;
  }

  /**
   * Lấy toàn bộ dữ liệu quản lý sheet, bao gồm metadata đồng bộ và chi tiết trạng thái của từng sheet
   */
  getData() {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const metadata = this._syncMetadata(ss);
      
      const sheetDetails = {};
      ss.getSheets().forEach(function(sheet) {
        const name = sheet.getName();
        sheetDetails[name] = {
          name: name,
          isHidden: sheet.isSheetHidden(),
          color: sheet.getTabColor() || null,
          index: sheet.getIndex()
        };
      });

      // Lấy danh sách bản mẫu (Templates) để phục vụ cho tính năng thêm sheet qua template
      const templatesStr = PropertiesService.getDocumentProperties().getProperty(Config.TEMPLATE_STORE);
      const templates = templatesStr ? JSON.parse(templatesStr) : {};
      const templatesArray = Object.keys(templates).map(function(id) {
        return templates[id];
      });

      return {
        success: true,
        rootOrder: metadata.rootOrder,
        folders: metadata.folders,
        templateBindings: metadata.templateBindings || {},
        sheetComponents: metadata.sheetComponents || {},
        sheetDetails: sheetDetails,
        templates: templatesArray
      };
    } catch (e) {
      return { success: false, message: "Lỗi lấy dữ liệu Sheet Manager: " + e.message };
    }
  }

  /**
   * Tạo một Sheet mới với các kiểu tùy chọn (Rỗng, Bản mẫu, Sao chép)
   */
  createCustomSheet(data) {
    try {
      const name = data.name ? data.name.trim() : "";
      const type = data.type || "empty";
      const templateId = data.templateId;
      const sourceSheetName = data.sourceSheetName;

      if (!name) {
        return { success: false, message: "Tên Sheet không được để trống." };
      }

      const ss = SpreadsheetApp.getActiveSpreadsheet();
      if (ss.getSheetByName(name)) {
        return { success: false, message: "Tên Sheet '" + name + "' đã tồn tại." };
      }

      if (type === 'empty') {
        ss.insertSheet(name);
      } else if (type === 'copy') {
        if (!sourceSheetName) {
          return { success: false, message: "Vui lòng chọn Sheet nguồn để sao chép." };
        }
        const sourceSheet = ss.getSheetByName(sourceSheetName);
        if (!sourceSheet) {
          return { success: false, message: "Không tìm thấy Sheet nguồn '" + sourceSheetName + "'." };
        }
        const newSheet = sourceSheet.copyTo(ss);
        newSheet.setName(name);
      } else if (type === 'template') {
        if (!templateId) {
          return { success: false, message: "Vui lòng chọn bản mẫu Template." };
        }
        // Gọi applyTemplate của templateManagerService
        const applyRes = templateManagerService.applyTemplate(name, templateId);
        if (!applyRes.success) {
          return { success: false, message: "Lỗi áp dụng Template: " + applyRes.message };
        }
        
        // Lưu liên kết Template Binding
        const templatesStr = PropertiesService.getDocumentProperties().getProperty(Config.TEMPLATE_STORE);
        const templates = templatesStr ? JSON.parse(templatesStr) : {};
        const template = templates[templateId];
        const templateName = template ? template.name : "Template";

        const metadata = this._getMetadata();
        if (!metadata.templateBindings) {
          metadata.templateBindings = {};
        }
        metadata.templateBindings[name] = {
          templateId: templateId,
          templateName: templateName
        };
        this._saveMetadata(metadata);
      } else {
        return { success: false, message: "Kiểu Sheet không hợp lệ." };
      }

      activityLogService.log("đã tạo sheet mới: " + name);
      return { success: true, message: "Tạo Sheet mới '" + name + "' thành công." };
    } catch (e) {
      return { success: false, message: "Lỗi tạo Sheet mới: " + e.message };
    }
  }

  /**
   * Tạo một thư mục mới
   */
  createFolder(name) {
    try {
      if (!name || !name.trim()) {
        return { success: false, message: "Tên thư mục không được để trống." };
      }
      const metadata = this._getMetadata();
      const folderId = "folder_" + new Date().getTime();
      
      metadata.folders[folderId] = {
        id: folderId,
        name: name.trim(),
        sheetNames: []
      };
      
      // Chèn lên đầu danh sách rootOrder
      metadata.rootOrder.unshift({ type: 'folder', id: folderId });
      
      this._saveMetadata(metadata);
      activityLogService.log("đã tạo thư mục ảo mới: " + name.trim());
      return { success: true, message: "Đã tạo thư mục '" + name + "' thành công." };
    } catch (e) {
      return { success: false, message: e.message };
    }
  }

  /**
   * Xóa thư mục, chuyển các sheet bên trong ra ngoài rootOrder
   */
  deleteFolder(data) {
    try {
      let folderId, deleteSheets;
      if (data && typeof data === 'object') {
        folderId = data.folderId;
        deleteSheets = !!data.deleteSheets;
      } else {
        folderId = data;
        deleteSheets = false;
      }

      const metadata = this._getMetadata();
      const folder = metadata.folders[folderId];
      if (!folder) {
        return { success: false, message: "Không tìm thấy thư mục để xóa." };
      }

      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheets = ss.getSheets();
      const sheetsToDelete = folder.sheetNames || [];

      if (deleteSheets && sheetsToDelete.length > 0) {
        // Kiểm tra xem số sheet bị xóa có bằng tổng số sheet của spreadsheet không
        if (sheetsToDelete.length >= sheets.length) {
          return { success: false, message: "Bảng tính bắt buộc phải có ít nhất một sheet hiển thị. Không thể xóa toàn bộ các sheet." };
        }

        // Xóa các sheet khỏi spreadsheet
        sheetsToDelete.forEach(function(name) {
          const sh = ss.getSheetByName(name);
          if (sh) {
            ss.deleteSheet(sh);
          }
        });

        // Xóa khỏi metadata rootOrder các sheet con
        metadata.rootOrder = metadata.rootOrder.filter(function(item) {
          return !(item.type === 'sheet' && sheetsToDelete.indexOf(item.name) > -1);
        });
      } else {
        // Đẩy các sheet ra rootOrder
        const idx = metadata.rootOrder.findIndex(function(item) {
          return item.type === 'folder' && item.id === folderId;
        });
        if (idx > -1) {
          metadata.rootOrder.splice(idx, 1);
          sheetsToDelete.forEach(function(sheetName, i) {
            metadata.rootOrder.splice(idx + i, 0, { type: 'sheet', name: sheetName });
          });
        }
      }

      // Xóa folder khỏi rootOrder nếu vẫn còn
      metadata.rootOrder = metadata.rootOrder.filter(function(item) {
        return !(item.type === 'folder' && item.id === folderId);
      });

      const folderName = folder ? folder.name : folderId;
      delete metadata.folders[folderId];
      this._saveMetadata(metadata);
      this._syncPhysicalTabOrder(metadata);
      activityLogService.log("đã xóa thư mục ảo: " + folderName);
      return { success: true, message: "Đã xóa thư mục thành công." };
    } catch (e) {
      return { success: false, message: e.message };
    }
  }

  /**
   * Đổi tên thư mục
   */
  renameFolder(folderId, newName) {
    try {
      if (!newName || !newName.trim()) {
        return { success: false, message: "Tên thư mục không được để trống." };
      }
      const metadata = this._getMetadata();
      if (!metadata.folders[folderId]) {
        return { success: false, message: "Không tìm thấy thư mục." };
      }
      
      const oldName = metadata.folders[folderId].name;
      metadata.folders[folderId].name = newName.trim();
      this._saveMetadata(metadata);
      activityLogService.log("đã đổi tên thư mục '" + oldName + "' thành '" + newName.trim() + "'");
      return { success: true, message: "Đã đổi tên thư mục thành công." };
    } catch (e) {
      return { success: false, message: e.message };
    }
  }

  /**
   * Đổi màu thư mục ảo (màu nền card thư mục)
   */
  changeFolderColor(folderId, colorHex) {
    try {
      const metadata = this._getMetadata();
      if (!metadata.folders[folderId]) {
        return { success: false, message: "Không tìm thấy thư mục." };
      }
      metadata.folders[folderId].color = colorHex || null;
      this._saveMetadata(metadata);
      activityLogService.log("đã đổi màu thư mục: " + metadata.folders[folderId].name);
      return { success: true, message: "Đã đổi màu thư mục thành công." };
    } catch (e) {
      return { success: false, message: e.message };
    }
  }

  /**
   * Nhân bản thư mục và tất cả các sheet bên trong
   */
  duplicateFolder(folderId) {
    try {
      const metadata = this._getMetadata();
      const originalFolder = metadata.folders[folderId];
      if (!originalFolder) {
        return { success: false, message: "Không tìm thấy thư mục để nhân bản." };
      }

      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const newFolderId = "folder_" + new Date().getTime();

      // Sinh tên thư mục mới
      let baseName = "Bản sao của " + originalFolder.name;
      let finalFolderName = baseName;
      let counter = 1;
      const folderNames = Object.keys(metadata.folders).map(function(id) {
        return metadata.folders[id].name;
      });
      while (folderNames.indexOf(finalFolderName) > -1) {
        finalFolderName = baseName + " (" + counter + ")";
        counter++;
      }

      const newFolder = {
        id: newFolderId,
        name: finalFolderName,
        color: originalFolder.color || null,
        sheetNames: []
      };

      // Nhân bản vật lý toàn bộ sheet con
      const originalSheets = originalFolder.sheetNames || [];
      originalSheets.forEach(function(sheetName) {
        const sheet = ss.getSheetByName(sheetName);
        if (sheet) {
          const duplicated = sheet.copyTo(ss);
          let dupBaseName = "Bản sao của " + sheetName;
          let dupFinalName = dupBaseName;
          let dupCounter = 1;
          while (ss.getSheetByName(dupFinalName)) {
            dupFinalName = dupBaseName + " (" + dupCounter + ")";
            dupCounter++;
          }
          duplicated.setName(dupFinalName);
          newFolder.sheetNames.push(dupFinalName);
        }
      });

      // Ghi metadata
      metadata.folders[newFolderId] = newFolder;

      // Chèn thư mục mới kề bên thư mục cũ trong rootOrder
      const rootIdx = metadata.rootOrder.findIndex(function(item) {
        return item.type === 'folder' && item.id === folderId;
      });
      if (rootIdx > -1) {
        metadata.rootOrder.splice(rootIdx + 1, 0, { type: 'folder', id: newFolderId });
      } else {
        metadata.rootOrder.push({ type: 'folder', id: newFolderId });
      }

      this._saveMetadata(metadata);
      this._syncPhysicalTabOrder(metadata);
      activityLogService.log("đã nhân bản thư mục ảo: " + originalFolder.name);
      return { success: true, message: "Đã nhân bản thư mục và các sheet con thành công." };
    } catch (e) {
      return { success: false, message: e.message };
    }
  }

  /**
   * Di chuyển một sheet vào trong một thư mục (hoặc ra ngoài root nếu folderId là null)
   */
  moveSheetToFolder(sheetName, folderId) {
    try {
      const metadata = this._getMetadata();
      
      // Xóa sheetName khỏi vị trí cũ trong rootOrder hoặc các folder khác
      metadata.rootOrder = metadata.rootOrder.filter(function(item) {
        return !(item.type === 'sheet' && item.name === sheetName);
      });

      Object.keys(metadata.folders).forEach(function(fId) {
        metadata.folders[fId].sheetNames = metadata.folders[fId].sheetNames.filter(function(name) {
          return name !== sheetName;
        });
      });

      // Chèn vào vị trí mới
      if (folderId && metadata.folders[folderId]) {
        metadata.folders[folderId].sheetNames.push(sheetName);
      } else {
        metadata.rootOrder.push({ type: 'sheet', name: sheetName });
      }

      const folderName = (folderId && metadata.folders[folderId]) ? metadata.folders[folderId].name : "Ngoài thư mục";
      this._saveMetadata(metadata);
      this._syncPhysicalTabOrder(metadata);
      activityLogService.log("đã di chuyển sheet '" + sheetName + "' vào '" + folderName + "'");
      return { success: true, message: "Đã di chuyển sheet thành công." };
    } catch (e) {
      return { success: false, message: e.message };
    }
  }

  /**
   * Đổi tên sheet thực tế
   */
  renameSheet(oldName, newName) {
    try {
      if (!newName || !newName.trim()) {
        return { success: false, message: "Tên sheet mới không được để trống." };
      }
      if (oldName === newName) {
        return { success: true, message: "Tên không thay đổi." };
      }

      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName(oldName);
      if (!sheet) {
        return { success: false, message: "Không tìm thấy sheet '" + oldName + "' để đổi tên." };
      }
      
      sheet.setName(newName.trim());

      // Cập nhật tên trong metadata
      const metadata = this._getMetadata();
      metadata.rootOrder = metadata.rootOrder.map(function(item) {
        if (item.type === 'sheet' && item.name === oldName) {
          item.name = newName.trim();
        }
        return item;
      });

      Object.keys(metadata.folders).forEach(function(fId) {
        metadata.folders[fId].sheetNames = metadata.folders[fId].sheetNames.map(function(name) {
          return name === oldName ? newName.trim() : name;
        });
      });

      // Đổi khóa template binding nếu có
      if (metadata.templateBindings && metadata.templateBindings[oldName]) {
        metadata.templateBindings[newName.trim()] = metadata.templateBindings[oldName];
        delete metadata.templateBindings[oldName];
      }

      // Đổi khóa sheetComponents nếu có
      if (metadata.sheetComponents && metadata.sheetComponents[oldName]) {
        metadata.sheetComponents[newName.trim()] = metadata.sheetComponents[oldName];
        delete metadata.sheetComponents[oldName];
      }

      // Cập nhật tên sheet trong databaseConfig của các Template
      try {
        const templatesStr = PropertiesService.getDocumentProperties().getProperty(Config.TEMPLATE_STORE);
        if (templatesStr) {
          const templates = JSON.parse(templatesStr);
          let tChanged = false;
          Object.keys(templates).forEach(function(tId) {
            const t = templates[tId];
            if (t.databaseConfig) {
              // Nếu trùng dbName
              if (t.databaseConfig.dbName === oldName) {
                t.databaseConfig.dbName = newName.trim();
                tChanged = true;
              }
              // Nếu trùng trong linkedSheets
              if (t.databaseConfig.linkedSheets) {
                const lIdx = t.databaseConfig.linkedSheets.indexOf(oldName);
                if (lIdx > -1) {
                  t.databaseConfig.linkedSheets[lIdx] = newName.trim();
                  tChanged = true;
                }
              }
            }
          });
          if (tChanged) {
            PropertiesService.getDocumentProperties().setProperty(Config.TEMPLATE_STORE, JSON.stringify(templates));
          }
        }
      } catch (e) {
        console.error("Lỗi cập nhật databaseConfig khi đổi tên sheet: " + e.message);
      }

      this._saveMetadata(metadata);
      activityLogService.log("đã đổi tên sheet '" + oldName + "' thành '" + newName.trim() + "'");
      return { success: true, message: "Đã đổi tên sheet thành '" + newName + "'." };
    } catch (e) {
      return { success: false, message: "Tên sheet trùng lặp hoặc chứa ký tự không hợp lệ." };
    }
  }

  /**
   * Nhân bản sheet thực tế
   */
  duplicateSheet(sheetName) {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        return { success: false, message: "Không tìm thấy sheet để nhân bản." };
      }

      const duplicated = sheet.copyTo(ss);
      
      let baseName = "Bản sao của " + sheetName;
      let finalName = baseName;
      let counter = 1;
      while (ss.getSheetByName(finalName)) {
        finalName = baseName + " (" + counter + ")";
        counter++;
      }
      duplicated.setName(finalName);

      // Cập nhật metadata
      const metadata = this._getMetadata();
      const rootIdx = metadata.rootOrder.findIndex(function(item) {
        return item.type === 'sheet' && item.name === sheetName;
      });

      if (rootIdx > -1) {
        metadata.rootOrder.splice(rootIdx + 1, 0, { type: 'sheet', name: finalName });
      } else {
        let inserted = false;
        Object.keys(metadata.folders).forEach(function(fId) {
          const fIdx = metadata.folders[fId].sheetNames.indexOf(sheetName);
          if (fIdx > -1 && !inserted) {
            metadata.folders[fId].sheetNames.splice(fIdx + 1, 0, finalName);
            inserted = true;
          }
        });
        if (!inserted) {
          metadata.rootOrder.push({ type: 'sheet', name: finalName });
        }
      }

      this._saveMetadata(metadata);
      this._syncPhysicalTabOrder(metadata);
      activityLogService.log("đã nhân bản sheet: " + sheetName);
      return { success: true, message: "Đã nhân bản sheet thành công." };
    } catch (e) {
      return { success: false, message: e.message };
    }
  }

  /**
   * Xóa vĩnh viễn sheet
   */
  deleteSheet(sheetName) {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheets = ss.getSheets();
      if (sheets.length <= 1) {
        return { success: false, message: "Spreadsheet bắt buộc phải có ít nhất một sheet hiển thị. Không thể xóa." };
      }

      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        return { success: false, message: "Không tìm thấy sheet để xóa." };
      }

      ss.deleteSheet(sheet);

      // Xóa cấu hình database liên kết nếu có
      this._removeDatabaseConfigForSheets([sheetName]);

      // Xóa khỏi metadata
      const metadata = this._getMetadata();
      metadata.rootOrder = metadata.rootOrder.filter(function(item) {
        return !(item.type === 'sheet' && item.name === sheetName);
      });

      Object.keys(metadata.folders).forEach(function(fId) {
        metadata.folders[fId].sheetNames = metadata.folders[fId].sheetNames.filter(function(name) {
          return name !== sheetName;
        });
      });

      this._saveMetadata(metadata);
      activityLogService.log("đã xóa sheet: " + sheetName);
      return { success: true, message: "Đã xóa vĩnh viễn sheet '" + sheetName + "'." };
    } catch (e) {
      return { success: false, message: e.message };
    }
  }

  /**
   * Đổi màu tab của sheet
   */
  changeSheetColor(sheetName, colorHex) {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        return { success: false, message: "Không tìm thấy sheet." };
      }

      let targetColor = colorHex;
      if (colorHex) {
        const key = colorHex.toUpperCase();
        const PASTEL_TO_DARK = {
          '#EAF4FF': '#2563EB',
          '#EAFBF3': '#059669',
          '#F3EEFF': '#7C3AED',
          '#FFF2E8': '#EA580C',
          '#FFECEF': '#E11D48',
          '#FFF9DB': '#CA8A04',
          '#E8FAFB': '#0891B2',
          '#EEF6EC': '#4D7C0F',
          '#F8F4EC': '#A16207',
          '#F5F5F5': '#525252'
        };
        targetColor = PASTEL_TO_DARK[key] || colorHex;
      }

      sheet.setTabColor(targetColor || null);
      activityLogService.log("đã thay đổi màu tab sheet: " + sheetName);
      return { success: true, message: "Đã đổi màu tab sheet thành công." };
    } catch (e) {
      return { success: false, message: e.message };
    }
  }

  /**
   * Ẩn / Hiện sheet
   */
  toggleSheetVisibility(sheetName) {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        return { success: false, message: "Không tìm thấy sheet." };
      }

      if (sheet.isSheetHidden()) {
        sheet.showSheet();
        activityLogService.log("đã hiển thị sheet: " + sheetName);
        return { success: true, isHidden: false, message: "Đã hiển thị sheet '" + sheetName + "'." };
      } else {
        const visibleSheets = ss.getSheets().filter(function(s) { return !s.isSheetHidden(); });
        if (visibleSheets.length <= 1) {
          return { success: false, message: "Spreadsheet bắt buộc phải có ít nhất một sheet hiển thị. Không thể ẩn." };
        }
        sheet.hideSheet();
        activityLogService.log("đã ẩn sheet: " + sheetName);
        return { success: true, isHidden: true, message: "Đã ẩn sheet '" + sheetName + "'." };
      }
    } catch (e) {
      return { success: false, message: e.message };
    }
  }

  /**
   * Ẩn / Hiện toàn bộ sheet trong thư mục ảo
   */
  toggleFolderVisibility(folderId) {
    try {
      const metadata = this._getMetadata();
      const folder = metadata.folders[folderId];
      if (!folder) {
        return { success: false, message: "Không tìm thấy thư mục." };
      }

      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheets = ss.getSheets();
      const folderSheetNames = folder.sheetNames || [];

      if (folderSheetNames.length === 0) {
        return { success: true, message: "Thư mục trống." };
      }

      // Kiểm tra xem có sheet nào trong thư mục đang hiển thị không
      let hasVisible = false;
      folderSheetNames.forEach(function(name) {
        const sh = ss.getSheetByName(name);
        if (sh && !sh.isSheetHidden()) {
          hasVisible = true;
        }
      });

      if (hasVisible) {
        // Muốn ẩn toàn bộ các sheet trong thư mục
        const totalVisible = sheets.filter(function(s) { return !s.isSheetHidden(); }).length;
        
        let folderVisibleCount = 0;
        folderSheetNames.forEach(function(name) {
          const sh = ss.getSheetByName(name);
          if (sh && !sh.isSheetHidden()) {
            folderVisibleCount++;
          }
        });

        if (totalVisible - folderVisibleCount < 1) {
          return { success: false, message: "Bảng tính bắt buộc phải có ít nhất một sheet hiển thị. Không thể ẩn thư mục này." };
        }

        folderSheetNames.forEach(function(name) {
          const sh = ss.getSheetByName(name);
          if (sh) sh.hideSheet();
        });
        activityLogService.log("đã ẩn toàn bộ các sheet trong thư mục: " + folder.name);
        return { success: true, isHidden: true, message: "Đã ẩn toàn bộ sheet trong thư mục." };
      } else {
        // Hiển thị toàn bộ sheet trong thư mục
        folderSheetNames.forEach(function(name) {
          const sh = ss.getSheetByName(name);
          if (sh) sh.showSheet();
        });
        activityLogService.log("đã hiển thị toàn bộ các sheet trong thư mục: " + folder.name);
        return { success: true, isHidden: false, message: "Đã hiển thị toàn bộ các sheet trong thư mục." };
      }
    } catch (e) {
      return { success: false, message: e.message };
    }
  }

  /**
   * Lưu thứ tự (sau khi sắp xếp bằng Up/Down) và di chuyển vị trí tab sheet thực tế
   */
  saveOrder(rootOrder, folders) {
    try {
      const metadata = this._getMetadata();
      metadata.rootOrder = rootOrder;
      metadata.folders = folders;
      this._saveMetadata(metadata);
      
      // Đồng bộ hóa vị trí các tab sheet vật lý
      this._syncPhysicalTabOrder(metadata);
      
      activityLogService.log("đã sắp xếp lại thứ tự hiển thị các sheet");
      return { success: true, message: "Đã cập nhật thứ tự tab thành công." };
    } catch (e) {
      return { success: false, message: e.message };
    }
  }

  /**
   * Thay đổi màu tab hàng loạt cho nhiều sheet
   */
  changeBulkSheetsColor(sheetNames, colorHex) {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      let targetColor = colorHex;
      if (colorHex) {
        const key = colorHex.toUpperCase();
        const PASTEL_TO_DARK = {
          '#EAF4FF': '#2563EB',
          '#EAFBF3': '#059669',
          '#F3EEFF': '#7C3AED',
          '#FFF2E8': '#EA580C',
          '#FFECEF': '#E11D48',
          '#FFF9DB': '#CA8A04',
          '#E8FAFB': '#0891B2',
          '#EEF6EC': '#4D7C0F',
          '#F8F4EC': '#A16207',
          '#F5F5F5': '#525252'
        };
        targetColor = PASTEL_TO_DARK[key] || colorHex;
      }
      sheetNames.forEach(function(name) {
        const sheet = ss.getSheetByName(name);
        if (sheet) {
          sheet.setTabColor(targetColor || null);
        }
      });
      activityLogService.log("đã thay đổi màu tab cho " + sheetNames.length + " sheet hàng loạt");
      return { success: true, message: "Đã cập nhật màu cho " + sheetNames.length + " sheets." };
    } catch (e) {
      return { success: false, message: e.message };
    }
  }

  /**
   * Xóa hàng loạt nhiều sheet
   */
  deleteBulkSheets(sheetNames) {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      let countDeleted = 0;
      sheetNames.forEach(function(name) {
        if (ss.getSheets().length <= 1) {
          return;
        }
        const sheet = ss.getSheetByName(name);
        if (sheet) {
          ss.deleteSheet(sheet);
          countDeleted++;
        }
      });

      // Xóa cấu hình database liên kết nếu có
      this._removeDatabaseConfigForSheets(sheetNames);

      // Cập nhật và đồng bộ metadata
      const metadata = this._syncMetadata(ss);
      activityLogService.log("đã xóa " + countDeleted + " sheet hàng loạt");
      return { success: true, message: "Đã xóa " + countDeleted + " sheets thành công." };
    } catch (e) {
      return { success: false, message: e.message };
    }
  }

  /**
   * Di chuyển hàng loạt nhiều sheet vào thư mục
   */
  moveBulkSheetsToFolder(sheetNames, folderId) {
    try {
      const metadata = this._getMetadata();
      
      // 1. Gỡ bỏ các sheet khỏi thư mục cũ
      Object.keys(metadata.folders).forEach(function(fId) {
        metadata.folders[fId].sheetNames = metadata.folders[fId].sheetNames.filter(function(name) {
          return sheetNames.indexOf(name) === -1;
        });
      });

      // 2. Di chuyển các sheet tới thư mục mới hoặc ra Root
      if (folderId) {
        const folder = metadata.folders[folderId];
        if (folder) {
          sheetNames.forEach(function(name) {
            if (folder.sheetNames.indexOf(name) === -1) {
              folder.sheetNames.push(name);
            }
            // Gỡ khỏi rootOrder
            metadata.rootOrder = metadata.rootOrder.filter(function(item) {
              return !(item.type === 'sheet' && item.name === name);
            });
          });
        }
      } else {
        sheetNames.forEach(function(name) {
          const exists = metadata.rootOrder.some(function(item) {
            return item.type === 'sheet' && item.name === name;
          });
          if (!exists) {
            metadata.rootOrder.push({ type: 'sheet', name: name });
          }
        });
      }

      const folderName = (folderId && metadata.folders[folderId]) ? metadata.folders[folderId].name : "Ngoài thư mục";
      this._saveMetadata(metadata);
      activityLogService.log("đã di chuyển " + sheetNames.length + " sheet hàng loạt vào '" + folderName + "'");
      return { success: true, message: "Đã di chuyển " + sheetNames.length + " sheets thành công." };
    } catch (e) {
      return { success: false, message: e.message };
    }
  }

  /**
   * Nhân bản hàng loạt nhiều sheet
   */
  duplicateBulkSheets(sheetNames) {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      let duplicatedCount = 0;
      sheetNames.forEach(function(name) {
        const sheet = ss.getSheetByName(name);
        if (sheet) {
          let copyName = name + "_Bản_sao";
          let counter = 1;
          while (ss.getSheetByName(copyName)) {
            copyName = name + "_Bản_sao_" + counter;
            counter++;
          }
          const newSheet = sheet.copyTo(ss);
          newSheet.setName(copyName);
          duplicatedCount++;
        }
      });

      const metadata = this._syncMetadata(ss);
      activityLogService.log("đã nhân bản " + duplicatedCount + " sheet hàng loạt");
      return { success: true, message: "Đã nhân bản thành công " + duplicatedCount + " sheets." };
    } catch (e) {
      return { success: false, message: e.message };
    }
  }

  /**
   * Lưu trữ các thành phần bổ sung (Ghi chú & Tags) của Sheet vào metadata
   */
  saveSheetComponents(sheetName, components) {
    try {
      const metadata = this._getMetadata();
      if (!metadata.sheetComponents) {
        metadata.sheetComponents = {};
      }
      metadata.sheetComponents[sheetName] = components;
      this._saveMetadata(metadata);
      activityLogService.log("đã cập nhật thuộc tính bổ sung cho sheet: " + sheetName);
      return { success: true, message: "Đã cập nhật thành phần bổ sung thành công." };
    } catch (e) {
      return { success: false, message: e.message };
    }
  }

  /**
   * Di chuyển các tab sheet vật lý trong Google Sheets
   */
  _syncPhysicalTabOrder(metadata) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const originalActiveSheet = ss.getActiveSheet();

    const flatSheetNames = [];
    metadata.rootOrder.forEach(function(item) {
      if (item.type === 'sheet') {
        flatSheetNames.push(item.name);
      } else if (item.type === 'folder') {
        const folder = metadata.folders[item.id];
        if (folder && folder.sheetNames) {
          folder.sheetNames.forEach(function(name) {
            flatSheetNames.push(name);
          });
        }
      }
    });

    flatSheetNames.forEach(function(name, idx) {
      const sheet = ss.getSheetByName(name);
      if (sheet) {
        ss.setActiveSheet(sheet);
        ss.moveActiveSheet(idx + 1); // 1-based
      }
    });

    try {
      ss.setActiveSheet(originalActiveSheet);
    } catch (e) {
      // Bỏ qua nếu active sheet ban đầu bị xóa
    }
  }

  /**
   * Xóa cấu hình databaseConfig trong template nếu sheet bị xóa trùng tên database
   */
  _removeDatabaseConfigForSheets(sheetNames) {
    try {
      const props = PropertiesService.getDocumentProperties();
      const rawTemplates = props.getProperty(Config.TEMPLATE_STORE) || "{}";
      let templates = {};
      try {
        templates = JSON.parse(rawTemplates);
      } catch(e){}
      
      let changed = false;
      for (let id in templates) {
        const template = templates[id];
        if (template.databaseConfig) {
          // 1. Nếu sheet bị xóa trùng tên database
          if (sheetNames.indexOf(template.databaseConfig.dbName) > -1) {
            template.databaseConfig = null;
            changed = true;
          } else if (template.databaseConfig.linkedSheets) {
            // 2. Lọc bỏ các sheet liên kết bị xóa
            const originalLength = template.databaseConfig.linkedSheets.length;
            template.databaseConfig.linkedSheets = template.databaseConfig.linkedSheets.filter(function(name) {
              return sheetNames.indexOf(name) === -1;
            });
            if (template.databaseConfig.linkedSheets.length !== originalLength) {
              changed = true;
            }
          }
        }
      }
      if (changed) {
        props.setProperty(Config.TEMPLATE_STORE, JSON.stringify(templates));
      }
    } catch (e) {
      console.error("Lỗi xóa cấu hình database khi xóa sheet: " + e.message);
    }
  }
}

// Khởi tạo đối tượng toàn cục
const sheetManagerService = new SheetManagerService();
