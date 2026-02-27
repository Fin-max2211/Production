/**
 * ============================================================
 * logger.js — ระบบ Logging (บันทึก Log ลงไฟล์)
 * ============================================================
 * 
 * แทนที่ console.log ด้วยระบบ log ที่เก็บลงไฟล์:
 *   - server/data/logs/app.log      ← log ทั่วไป
 *   - server/data/logs/error.log    ← เฉพาะ error
 * 
 * ระดับ Log:
 *   INFO    → ข้อมูลทั่วไป (เช่น server started)
 *   WARN    → คำเตือน (เช่น rate limit exceeded)
 *   ERROR   → ข้อผิดพลาด (เช่น file write failed)
 *   SUCCESS → สำเร็จ (เช่น data saved)
 * 
 * ============================================================
 */

const fs = require('fs');
const path = require('path');

// ──────────────────────────────────────────────────────────────
// ค่าคงที่ (Constants)
// ──────────────────────────────────────────────────────────────
const LOG_DIR = path.join(__dirname, '..', 'data', 'logs');
const APP_LOG = path.join(LOG_DIR, 'app.log');
const ERROR_LOG = path.join(LOG_DIR, 'error.log');

// จำกัดขนาด log file (5MB) — ถ้าเกินจะ rotate
const MAX_LOG_SIZE = 5 * 1024 * 1024;

// สร้างโฟลเดอร์ logs ถ้ายังไม่มี
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}


/**
 * formatLog(level, message, data)
 * 
 * จัด format ข้อความ log ให้สวยงาม
 * ตัวอย่าง: [2024-01-15T10:30:00.000Z] [INFO] Server started on port 3000
 * 
 * @param {string} level   - ระดับ log (INFO, WARN, ERROR, SUCCESS)
 * @param {string} message - ข้อความ
 * @param {*} data         - ข้อมูลเพิ่มเติม (optional)
 * @returns {string}       - ข้อความที่ format แล้ว
 */
function formatLog(level, message, data) {
    var timestamp = new Date().toISOString();
    var logLine = '[' + timestamp + '] [' + level + '] ' + message;
    if (data !== undefined && data !== null) {
        try {
            logLine += ' | ' + JSON.stringify(data);
        } catch (e) {
            logLine += ' | [unserializable data]';
        }
    }
    return logLine;
}


/**
 * writeLog(filePath, logLine)
 * 
 * เขียน log ลงไฟล์ (append mode)
 * ถ้าไฟล์เกิน MAX_LOG_SIZE จะ rotate (เปลี่ยนชื่อเป็น .old)
 * 
 * @param {string} filePath - path ของ log file
 * @param {string} logLine  - ข้อความที่จะเขียน
 */
function writeLog(filePath, logLine) {
    try {
        // ตรวจสอบขนาดไฟล์และ rotate ถ้าจำเป็น
        if (fs.existsSync(filePath)) {
            var stats = fs.statSync(filePath);
            if (stats.size > MAX_LOG_SIZE) {
                var oldPath = filePath.replace('.log', '.old.log');
                // ลบ old log เดิม (ถ้ามี)
                if (fs.existsSync(oldPath)) {
                    fs.unlinkSync(oldPath);
                }
                fs.renameSync(filePath, oldPath);
            }
        }

        // เขียน log ต่อท้ายไฟล์
        fs.appendFileSync(filePath, logLine + '\n', 'utf8');
    } catch (e) {
        // Fallback: ถ้าเขียนไฟล์ไม่ได้ แสดงใน console แทน
        console.error('[LOGGER FALLBACK]', logLine);
    }
}


// ══════════════════════════════════════════════════════════════
// Logger Object — ใช้แทน console.log ทั้งโปรเจค
// ══════════════════════════════════════════════════════════════

var logger = {
    /**
     * info(message, data)
     * บันทึกข้อมูลทั่วไป
     */
    info: function (message, data) {
        var line = formatLog('INFO', message, data);
        console.log('ℹ️ ', line);
        writeLog(APP_LOG, line);
    },

    /**
     * warn(message, data)
     * บันทึกคำเตือน
     */
    warn: function (message, data) {
        var line = formatLog('WARN', message, data);
        console.warn('⚠️ ', line);
        writeLog(APP_LOG, line);
    },

    /**
     * error(message, data)
     * บันทึกข้อผิดพลาด — เขียนลงทั้ง app.log และ error.log
     */
    error: function (message, data) {
        var line = formatLog('ERROR', message, data);
        console.error('❌', line);
        writeLog(APP_LOG, line);
        writeLog(ERROR_LOG, line);   // เขียนลง error.log ด้วย
    },

    /**
     * success(message, data)
     * บันทึกเหตุการณ์ที่สำเร็จ
     */
    success: function (message, data) {
        var line = formatLog('SUCCESS', message, data);
        console.log('✅', line);
        writeLog(APP_LOG, line);
    }
};


module.exports = logger;
