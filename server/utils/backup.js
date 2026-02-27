/**
 * ============================================================
 * backup.js — ระบบ Auto-Backup สำหรับไฟล์ Excel
 * ============================================================
 * 
 * ทำหน้าที่:
 * 1. สร้าง backup ของไฟล์ Excel ก่อนเขียนทับ
 * 2. จำกัดจำนวน backup files (ลบเก่าสุดอัตโนมัติ)
 * 3. ตั้งชื่อ backup ตามวันเวลา เพื่อให้ trace ได้
 * 
 * โฟลเดอร์ backup: server/data/backups/
 * รูปแบบชื่อไฟล์: responses_2024-01-15_103000.xlsx
 * 
 * ============================================================
 */

const fs = require('fs');
const path = require('path');
const logger = require('./logger');

// ──────────────────────────────────────────────────────────────
// ค่าคงที่
// ──────────────────────────────────────────────────────────────
const BACKUP_DIR = path.join(__dirname, '..', 'data', 'backups');
const MAX_BACKUPS = parseInt(process.env.BACKUP_MAX_FILES) || 10;
const BACKUP_ENABLED = (process.env.BACKUP_ENABLED || 'true') === 'true';


/**
 * createBackup(sourceFilePath)
 * 
 * สร้าง backup ของไฟล์ที่ระบุ
 * - ถ้าไฟล์ต้นฉบับไม่มี → ข้ามไป
 * - ถ้า backup เกิน MAX_BACKUPS → ลบเก่าสุด
 * 
 * @param {string} sourceFilePath - path ของไฟล์ที่จะ backup
 * @returns {string|null}         - path ของไฟล์ backup (หรือ null ถ้าไม่ได้สร้าง)
 */
function createBackup(sourceFilePath) {
    // ถ้า disable backup → ข้ามไป
    if (!BACKUP_ENABLED) {
        return null;
    }

    // ถ้าไฟล์ต้นฉบับไม่มี → ไม่มีอะไรจะ backup
    if (!fs.existsSync(sourceFilePath)) {
        return null;
    }

    try {
        // สร้างโฟลเดอร์ backup ถ้ายังไม่มี
        if (!fs.existsSync(BACKUP_DIR)) {
            fs.mkdirSync(BACKUP_DIR, { recursive: true });
        }

        // สร้างชื่อไฟล์ backup ตามเวลา
        // ตัวอย่าง: responses_2024-01-15_103000.xlsx
        var now = new Date();
        var dateStr = now.toISOString()
            .replace(/T/, '_')       // แทน T ด้วย _
            .replace(/:/g, '')       // ลบ :
            .replace(/\..+/, '');    // ลบ milliseconds

        var ext = path.extname(sourceFilePath);
        var baseName = path.basename(sourceFilePath, ext);
        var backupName = baseName + '_' + dateStr + ext;
        var backupPath = path.join(BACKUP_DIR, backupName);

        // Copy ไฟล์
        fs.copyFileSync(sourceFilePath, backupPath);
        logger.info('Backup created', { file: backupName });

        // ลบ backup เก่าถ้าเกินจำนวน
        cleanOldBackups();

        return backupPath;

    } catch (err) {
        logger.error('Backup failed', { error: err.message });
        return null;
    }
}


/**
 * cleanOldBackups()
 * 
 * ลบไฟล์ backup ที่เก่าเกินกำหนด
 * เก็บไว้แค่ MAX_BACKUPS ไฟล์ล่าสุด
 */
function cleanOldBackups() {
    try {
        if (!fs.existsSync(BACKUP_DIR)) return;

        // อ่านรายชื่อไฟล์ทั้งหมดใน backup folder
        var files = fs.readdirSync(BACKUP_DIR)
            .filter(function (f) {
                return f.endsWith('.xlsx');
            })
            .map(function (f) {
                var filePath = path.join(BACKUP_DIR, f);
                return {
                    name: f,
                    path: filePath,
                    time: fs.statSync(filePath).mtime.getTime()
                };
            })
            // เรียงจากใหม่ → เก่า
            .sort(function (a, b) {
                return b.time - a.time;
            });

        // ลบไฟล์ที่เกิน MAX_BACKUPS
        if (files.length > MAX_BACKUPS) {
            var toDelete = files.slice(MAX_BACKUPS);
            toDelete.forEach(function (file) {
                fs.unlinkSync(file.path);
                logger.info('Old backup removed', { file: file.name });
            });
        }

    } catch (err) {
        logger.error('Backup cleanup failed', { error: err.message });
    }
}


module.exports = {
    createBackup,
    cleanOldBackups,
    BACKUP_DIR
};
