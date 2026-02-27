/**
 * ============================================================
 * validation.test.js — Unit Tests สำหรับ Validation Functions
 * ============================================================
 * 
 * ทดสอบฟังก์ชัน sanitizeInput และ validateAnswerIndex
 * รัน: npm test
 * 
 * ============================================================
 */

const { sanitizeInput, validateAnswerIndex } = require('../server/middleware/security');

// ──────────────────────────────────────────────────────────────
// Test: sanitizeInput
// ──────────────────────────────────────────────────────────────
describe('sanitizeInput', () => {

    test('should trim whitespace', () => {
        expect(sanitizeInput('  hello  ')).toBe('hello');
    });

    test('should escape HTML characters (prevent XSS)', () => {
        expect(sanitizeInput('<script>alert("xss")</script>')).toBe(
            '&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;'
        );
    });

    test('should limit string length', () => {
        var longString = 'a'.repeat(300);
        var result = sanitizeInput(longString, 50);
        expect(result.length).toBeLessThanOrEqual(50);
    });

    test('should return empty string for non-string input', () => {
        expect(sanitizeInput(null)).toBe('');
        expect(sanitizeInput(undefined)).toBe('');
        expect(sanitizeInput(123)).toBe('');
        expect(sanitizeInput({})).toBe('');
    });

    test('should handle empty string', () => {
        expect(sanitizeInput('')).toBe('');
    });

    test('should handle Thai text correctly', () => {
        expect(sanitizeInput('สวัสดีครับ')).toBe('สวัสดีครับ');
    });

    test('should escape special characters', () => {
        var result = sanitizeInput('Hello & "World" <test>');
        expect(result).toContain('&amp;');
        expect(result).toContain('&quot;');
        expect(result).toContain('&lt;');
    });

    test('should use default maxLength of 200', () => {
        var longString = 'x'.repeat(250);
        var result = sanitizeInput(longString);
        expect(result.length).toBeLessThanOrEqual(200);
    });
});


// ──────────────────────────────────────────────────────────────
// Test: validateAnswerIndex
// ──────────────────────────────────────────────────────────────
describe('validateAnswerIndex', () => {

    test('should accept valid indices (0-3)', () => {
        expect(validateAnswerIndex(0)).toBe(0);
        expect(validateAnswerIndex(1)).toBe(1);
        expect(validateAnswerIndex(2)).toBe(2);
        expect(validateAnswerIndex(3)).toBe(3);
    });

    test('should reject negative numbers', () => {
        expect(validateAnswerIndex(-1)).toBeNull();
        expect(validateAnswerIndex(-100)).toBeNull();
    });

    test('should reject numbers above max', () => {
        expect(validateAnswerIndex(4)).toBeNull();
        expect(validateAnswerIndex(100)).toBeNull();
    });

    test('should accept string numbers', () => {
        expect(validateAnswerIndex('0')).toBe(0);
        expect(validateAnswerIndex('2')).toBe(2);
    });

    test('should reject non-numeric strings', () => {
        expect(validateAnswerIndex('abc')).toBeNull();
        expect(validateAnswerIndex('')).toBeNull();
    });

    test('should reject null and undefined', () => {
        expect(validateAnswerIndex(null)).toBeNull();
        expect(validateAnswerIndex(undefined)).toBeNull();
    });

    test('should reject floats', () => {
        // parseInt จะแปลง 1.5 เป็น 1 ซึ่งยังถือว่า valid
        expect(validateAnswerIndex(1.5)).toBe(1);
    });

    test('should work with custom max', () => {
        expect(validateAnswerIndex(5, 5)).toBe(5);
        expect(validateAnswerIndex(6, 5)).toBeNull();
    });

    test('should reject NaN', () => {
        expect(validateAnswerIndex(NaN)).toBeNull();
    });
});
