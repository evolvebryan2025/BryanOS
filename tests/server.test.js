// Test validateTaskId directly without importing the full server
// (server.js initializes services that require env vars)
function validateTaskId(taskId) {
  const id = parseInt(taskId, 10);
  return !isNaN(id) && id >= 0 && String(id) === String(taskId);
}

describe('validateTaskId', () => {
  test('valid numeric IDs return true', () => {
    expect(validateTaskId('0')).toBe(true);
    expect(validateTaskId('1')).toBe(true);
    expect(validateTaskId('42')).toBe(true);
    expect(validateTaskId('999')).toBe(true);
  });

  test('negative numbers return false', () => {
    expect(validateTaskId('-1')).toBe(false);
    expect(validateTaskId('-100')).toBe(false);
  });

  test('non-numeric strings return false', () => {
    expect(validateTaskId('')).toBe(false);
    expect(validateTaskId('abc')).toBe(false);
    expect(validateTaskId('1abc')).toBe(false);
    expect(validateTaskId('abc1')).toBe(false);
  });

  test('decimals return false', () => {
    expect(validateTaskId('1.5')).toBe(false);
    expect(validateTaskId('0.1')).toBe(false);
  });

  test('special characters return false', () => {
    expect(validateTaskId('1;DROP TABLE')).toBe(false);
    expect(validateTaskId('<script>')).toBe(false);
    expect(validateTaskId('null')).toBe(false);
    expect(validateTaskId('undefined')).toBe(false);
  });
});
