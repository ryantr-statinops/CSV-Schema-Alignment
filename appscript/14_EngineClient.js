/* ================================================
   SHEETFLOW ENGINE CLIENT
   ================================================

   Optional bridge to the stateless Go compute engine.
   Disabled by default so the existing Sheet-native workflow remains unchanged
   until the backend contract is deployed and explicitly configured.
*/

class EngineClient {
  _getConfig(name, fallback) {
    return typeof Config[name] === 'undefined' ? fallback : Config[name];
  }

  isEnabled() {
    return this._getConfig('ENGINE_ENABLED', false) === true && !!this._getConfig('ENGINE_BASE_URL', '');
  }

  compute(operation, input, requestId) {
    if (!this.isEnabled()) {
      return {
        success: false,
        code: 'ENGINE_DISABLED',
        message: 'SheetFlow Engine chưa được bật cho Spreadsheet này.'
      };
    }

    if (!operation || typeof operation !== 'string') {
      throw new Error('Engine operation không hợp lệ.');
    }

    const payload = {
      operation: operation,
      request_id: requestId || Utilities.getUuid(),
      input: input || {}
    };

    const url = this._buildUrl('/compute');
    const response = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });

    const status = response.getResponseCode();
    const body = this._parseResponse(response.getContentText());

    if (status < 200 || status >= 300) {
      return {
        success: false,
        code: body.code || 'ENGINE_REQUEST_FAILED',
        message: body.message || ('Engine trả về HTTP ' + status),
        request_id: payload.request_id
      };
    }

    return body;
  }

  _buildUrl(path) {
    const base = this._getConfig('ENGINE_BASE_URL', '').replace(/\/+$/, '');
    const version = String(this._getConfig('ENGINE_API_VERSION', 'v1')).replace(/^\/+|\/+$/g, '');
    return base + '/' + version + path;
  }

  _parseResponse(raw) {
    try {
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
      return {
        success: false,
        code: 'ENGINE_INVALID_RESPONSE',
        message: 'Engine trả về response không phải JSON hợp lệ.'
      };
    }
  }
}

const engineClient = new EngineClient();
