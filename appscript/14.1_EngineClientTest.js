/* ================================================
   SHEETFLOW ENGINE CLIENT TESTS
   ================================================

   These tests do not call the network. Run testEngineClient() manually from
   the Apps Script editor after deploying the library.
*/

function testEngineClient() {
  const client = new EngineClient();
  const originalEnabled = Config.ENGINE_ENABLED;
  const originalBaseUrl = Config.ENGINE_BASE_URL;
  const originalVersion = Config.ENGINE_API_VERSION;

  try {
    Config.ENGINE_ENABLED = false;
    Config.ENGINE_BASE_URL = '';
    assertEngineTest(
      client.compute('schema.align', {}).code === 'ENGINE_DISABLED',
      'Engine phải disabled mặc định.'
    );

    Config.ENGINE_ENABLED = true;
    Config.ENGINE_BASE_URL = 'https://engine.example.test/';
    Config.ENGINE_API_VERSION = '/v1/';
    assertEngineTest(
      client._buildUrl('/compute') === 'https://engine.example.test/v1/compute',
      'Engine URL phải normalize base URL và API version.'
    );

    const invalidResponse = client._parseResponse('not-json');
    assertEngineTest(
      invalidResponse.code === 'ENGINE_INVALID_RESPONSE',
      'Response không hợp lệ phải trả về mã lỗi ổn định.'
    );

    const validResponse = client._parseResponse('{"success":true}');
    assertEngineTest(
      validResponse.success === true,
      'Response JSON hợp lệ phải được parse.'
    );

    logger.info('✅ EngineClient tests passed.');
    return { success: true };
  } finally {
    Config.ENGINE_ENABLED = originalEnabled;
    Config.ENGINE_BASE_URL = originalBaseUrl;
    Config.ENGINE_API_VERSION = originalVersion;
  }
}

function assertEngineTest(condition, message) {
  if (!condition) {
    throw new Error('EngineClient test failed: ' + message);
  }
}
