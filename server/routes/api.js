/**
 * ============================================================
 * api.js — API Routes (เส้นทาง API)
 * ============================================================
 * 
 * จัดการ endpoint ทั้งหมดสำหรับรับ-ส่งข้อมูล:
 * 
 *   POST /api/submit      → รับคำตอบแล้วบันทึกเป็นไฟล์ JSON
 *   GET  /api/health      → ตรวจสอบว่า server ทำงานอยู่
 *   GET  /api/stats       → ดูจำนวน response ทั้งหมด
 *   GET  /api/export      → Export ทั้งหมดเป็นไฟล์ Excel (.xlsx)
 * 
 * ============================================================
 * 
 * 📦 วิธีเก็บข้อมูล:
 *   - แต่ละ submission จะถูกเก็บเป็นไฟล์ JSON แยก
 *   - ไฟล์จะอยู่ใน server/data/responses/
 *   - ชื่อไฟล์: resp_<timestamp>_<sessionId>.json
 *   
 *   ✅ ข้อดี: ไม่มีปัญหา file lock!
 *      ต่อให้เปิด Excel หรือไฟล์อื่นอยู่ก็ submit ได้
 *      เพราะแต่ละครั้งสร้างไฟล์ใหม่ ไม่เขียนทับไฟล์เดิม
 * 
 * ============================================================
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');
const { sanitizeInput, validateAnswerIndex } = require('../middleware/security');
const logger = require('../utils/logger');
const crypto = require('crypto');

// ──────────────────────────────────────────────────────────────
// ค่าคงที่ (Constants)
// ──────────────────────────────────────────────────────────────
const TOTAL_QUESTIONS = 8;
const MAX_OPTIONS = 4;
const DATA_DIR = process.env.NODE_ENV === 'test'
    ? path.join(__dirname, '..', 'data', 'test_responses')
    : path.join(__dirname, '..', 'data', 'responses');

// สร้างโฟลเดอร์ถ้ายังไม่มี
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}


// ──────────────────────────────────────────────────────────────
// Middleware: requireApiKey
// ──────────────────────────────────────────────────────────────
function requireApiKey(req, res, next) {
    var apiKey = process.env.ADMIN_API_KEY;
    if (!apiKey) return next(); // dev mode

    var providedKey = req.headers['x-api-key'];
    if (!providedKey || providedKey !== apiKey) {
        logger.warn('Unauthorized access attempt', { ip: req.ip });
        return res.status(401).json({
            success: false,
            message: 'Unauthorized — API Key required'
        });
    }
    next();
}


// ══════════════════════════════════════════════════════════════
// ENDPOINT: POST /api/submit
// ══════════════════════════════════════════════════════════════
router.post('/submit', function (req, res) {
    handleSubmit(req, res);
});

// ──────────────────────────────────────────────────────────────
// ข้อมูลคำถาม (Copy มาจาก public/js/data.js เพื่อใช้ map คำตอบ)
// ──────────────────────────────────────────────────────────────
const QUESTIONS = [
    { options: ['ไม่โอเคสิคะ', 'ช่างมันเถอะ', 'ตั้งคำถามกับระบบ', 'ไม่เป็นไร เรามีแผนสำรอง'] },
    { options: ['เข้าไปชวนพูดคุย', 'เอากระทะไฟฟ้าที่พกติดตัวไว้ออกมา', 'เดินเลี่ยง', 'ทำไมต้องเจอมันด้วยเนี่ย'] },
    { options: ['ใช้เน็ตตัวเองก็ได้', 'เปิดปิดไวไฟ 22 ครั้ง', 'ทำไมต้องจบที่เรา', 'ไม่ได้ก็ไม่เอาแล้ว'] },
    { options: ['(sub-question)', '(sub-question)', '(sub-question)', '(sub-question)'] },
    { options: ['ต่อสู้กับความหนาว', 'ยอมแพ้แล้วไปหาที่นั่งทำงานที่อื่น', 'ตั้งคำถามในหัว', 'นั่งไปเดี๋ยวก็ชิน'] },
    { options: ['ลูบหัว จุ๊บพุงเบา ๆ', 'วิ่งไปหาเอง', 'ทักทายเหมียว ๆ', 'ลุกขึ้นเต้นแช่วับ'] },
    { options: ['ต้องยืนตลอด', 'ไม่ได้ขึ้นซักกกกที', 'ยืนรอด้วยความหวังลม ๆ แล้ง ๆ', 'ขึ้นแล้ว ลงยังไง'] },
    { options: ['มีศิลปินวงโปรด', 'นิทรรศการถ่ายรูปสวย', 'มีกิจกรรมเล่นกับเพื่อน', 'ตลาดเด็ด'] }
];

async function handleSubmit(req, res) {
    try {
        var username = req.body.username;
        var answers = req.body.answers;
        var items = req.body.items;
        var suggestion = req.body.suggestion;
        var personalityType = req.body.personalityType;
        var personalityName = req.body.personalityName;
        var personalityScores = req.body.personalityScores;

        // ── Validate ──
        if (!username || typeof username !== 'string') {
            return res.status(400).json({ success: false, message: 'กรุณาระบุชื่อผู้ใช้' });
        }

        if (!Array.isArray(answers) || answers.length !== TOTAL_QUESTIONS) {
            return res.status(400).json({ success: false, message: 'ต้องมีคำตอบ ' + TOTAL_QUESTIONS + ' ข้อ' });
        }

        var validatedAnswers = [];
        var readableAnswers = []; // เก็บคำตอบที่เป็นข้อความ

        for (var i = 0; i < answers.length; i++) {
            var validIndex = validateAnswerIndex(answers[i], MAX_OPTIONS - 1);
            if (validIndex === null) {
                return res.status(400).json({ success: false, message: 'คำตอบข้อ ' + (i + 1) + ' ไม่ถูกต้อง' });
            }
            validatedAnswers.push(validIndex);

            // Map index เป็นข้อความ
            if (QUESTIONS[i] && QUESTIONS[i].options && QUESTIONS[i].options[validIndex]) {
                readableAnswers.push(QUESTIONS[i].options[validIndex]);
            } else {
                readableAnswers.push('Unknown (' + validIndex + ')');
            }
        }

        if (!Array.isArray(items) || items.length !== TOTAL_QUESTIONS) {
            return res.status(400).json({ success: false, message: 'ข้อมูลไอเทมไม่ถูกต้อง' });
        }

        // ── Sanitize ──
        var sessionId = generateSessionId();

        // เวลาไทย (Asia/Bangkok)
        var now = new Date();
        var timestamp = now.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
        // timestamp สำหรับชื่อไฟล์ (ISO แบบปลอดภัย)
        var fileTimestamp = now.toISOString();

        // Sanitize personality data
        var validTypes = ['C', 'P', 'F', 'L'];
        var cleanType = validTypes.includes(personalityType) ? personalityType : '';
        var cleanScores = {};
        if (personalityScores && typeof personalityScores === 'object') {
            validTypes.forEach(function (t) {
                cleanScores[t] = Math.max(0, Math.min(99, parseInt(personalityScores[t]) || 0));
            });
        }

        var cleanData = {
            sessionId: sessionId,
            username: sanitizeInput(username, 30),
            answers: readableAnswers,
            rawAnswers: validatedAnswers,
            items: items.map(function (item) { return sanitizeInput(String(item), 100); }),
            personalityType: cleanType,
            personalityName: sanitizeInput(personalityName || '', 50),
            personalityScores: cleanScores,
            suggestion: sanitizeInput(suggestion || '', 500),
            timestamp: timestamp,
            ip: req.ip || 'unknown'
        };

        // ── 1. บันทึกเป็นไฟล์ JSON แยก (Reliable Backup) ──
        // การันตีว่าข้อมูลถูกเซฟแน่นอน 100% ไม่ว่า Excel จะเปิดค้างไว้หรือไม่
        var safeTimestamp = fileTimestamp.replace(/[:.]/g, '-');
        var jsonFilename = 'resp_' + safeTimestamp + '_' + sessionId + '.json';
        var jsonFilepath = path.join(DATA_DIR, jsonFilename);

        await fs.promises.writeFile(jsonFilepath, JSON.stringify(cleanData, null, 2), 'utf8');

        // ── 2. พยายามบันทึกลงไฟล์ Excel รวม (responses.xlsx) ──
        // ถ้าไฟล์เปิดอยู่ (Locked) จะ error แต่เราจะ catch ไว้ไม่ให้กระทบ User
        try {
            await appendToExcelFile(cleanData);
            logger.success('Saved to Excel & JSON', { user: cleanData.username, file: jsonFilename });
        } catch (excelError) {
            // ถ้าบันทึก Excel ไม่ได้ (เช่น เปิดไฟล์ค้างไว้) -> ไม่เป็นไร เพราะมี JSON แล้ว
            logger.warn('Excel locked - Saved to JSON only', {
                user: cleanData.username,
                error: excelError.message
            });
        }

        res.status(200).json({
            success: true,
            message: 'บันทึกข้อมูลสำเร็จ! ขอบคุณที่ร่วมสนุก 🎉'
        });

    } catch (error) {
        logger.error('Submit failed', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล'
        });
    }
}


// ══════════════════════════════════════════════════════════════
// ENDPOINT: GET /api/health
// ══════════════════════════════════════════════════════════════
router.get('/health', function (req, res) {
    res.status(200).json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()) + ' seconds',
        version: require('../../package.json').version
    });
});


// ══════════════════════════════════════════════════════════════
// ENDPOINT: GET /api/stats
// ══════════════════════════════════════════════════════════════
router.get('/stats', requireApiKey, function (req, res) {
    try {
        var files = getResponseFiles();
        logger.info('Stats accessed', { total: files.length, ip: req.ip });

        res.status(200).json({
            success: true,
            totalResponses: files.length
        });
    } catch (error) {
        logger.error('Stats error', { error: error.message });
        res.status(500).json({ success: false, message: 'ไม่สามารถอ่านข้อมูลได้' });
    }
});


// ══════════════════════════════════════════════════════════════
// ENDPOINT: GET /api/export
// ══════════════════════════════════════════════════════════════
/**
 * Export ข้อมูลทั้งหมดเป็นไฟล์ Excel (.xlsx)
 * 
 * 🔐 ปกติควรมีย API Key แต่เพื่อความสะดวกในการทดสอบ เราจะปิด check ไว้ก่อน
 *    (บรรทัด requireApiKey ถูก comment)
 */
router.get('/export', requireApiKey, function (req, res) {
    handleExport(req, res);
});

async function handleExport(req, res) {
    try {
        var files = getResponseFiles();

        if (files.length === 0) {
            return res.status(200).json({
                success: false,
                message: 'ยังไม่มีข้อมูลให้ export'
            });
        }

        // อ่านข้อมูลจากทุกไฟล์ JSON
        var allData = [];
        for (var i = 0; i < files.length; i++) {
            try {
                var content = await fs.promises.readFile(path.join(DATA_DIR, files[i]), 'utf8');
                allData.push(JSON.parse(content));
            } catch (e) {
                logger.warn('Skipped corrupt file', { file: files[i] });
            }
        }

        // เรียงตาม timestamp
        allData.sort(function (a, b) {
            return new Date(a.timestamp) - new Date(b.timestamp);
        });

        // สร้าง Excel
        var workbook = new ExcelJS.Workbook();
        var worksheet = workbook.addWorksheet('Responses', {
            properties: { defaultColWidth: 18 }
        });

        // กำหนด columns
        var columns = [
            { header: 'Session ID', key: 'sessionId', width: 20 },
            { header: 'Timestamp', key: 'timestamp', width: 22 },
            { header: 'Username', key: 'username', width: 15 }
        ];

        for (var q = 1; q <= TOTAL_QUESTIONS; q++) {
            columns.push({ header: 'Q' + q, key: 'q' + q, width: 20 });
        }
        for (var t = 1; t <= TOTAL_QUESTIONS; t++) {
            columns.push({ header: 'Item ' + t, key: 'item' + t, width: 16 });
        }

        columns.push({ header: 'Result Type', key: 'personalityType', width: 10 });
        columns.push({ header: 'Result Name', key: 'personalityName', width: 25 });
        columns.push({ header: 'Score C', key: 'scoreC', width: 10 });
        columns.push({ header: 'Score P', key: 'scoreP', width: 10 });
        columns.push({ header: 'Score F', key: 'scoreF', width: 10 });
        columns.push({ header: 'Score L', key: 'scoreL', width: 10 });

        columns.push({ header: 'Suggestion', key: 'suggestion', width: 40 });
        columns.push({ header: 'IP Address', key: 'ip', width: 16 });

        worksheet.columns = columns;

        // ตกแต่งหัวตาราง (สีแดง TU)
        var headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE74C3C' } };
        headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
        headerRow.height = 24;

        // เพิ่มข้อมูลทุกแถว
        allData.forEach(function (data) {
            var rowData = {
                sessionId: data.sessionId,
                timestamp: data.timestamp,
                username: data.username,
                suggestion: data.suggestion || '',
                ip: data.ip || ''
            };

            for (var j = 0; j < TOTAL_QUESTIONS; j++) {
                rowData['q' + (j + 1)] = data.answers[j] !== undefined ? data.answers[j] : '';
                rowData['item' + (j + 1)] = data.items ? (data.items[j] || '') : '';
            }

            rowData.personalityType = data.personalityType || '';
            rowData.personalityName = data.personalityName || '';
            var scores = data.personalityScores || {};
            rowData.scoreC = scores.C || 0;
            rowData.scoreP = scores.P || 0;
            rowData.scoreF = scores.F || 0;
            rowData.scoreL = scores.L || 0;

            worksheet.addRow(rowData);
        });

        // ส่งไฟล์ Excel กลับเป็น download
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=responses_export.xlsx');

        await workbook.xlsx.write(res);
        res.end();

        logger.success('Excel exported', { totalRows: allData.length, ip: req.ip });

    } catch (error) {
        logger.error('Export failed', { error: error.message });
        res.status(500).json({ success: false, message: 'Export ล้มเหลว' });
    }
}


// ══════════════════════════════════════════════════════════════
// Helper: getResponseFiles
// ══════════════════════════════════════════════════════════════
/**
 * อ่านรายชื่อไฟล์ JSON ทั้งหมดในโฟลเดอร์ responses
 * @returns {string[]} รายชื่อไฟล์
 */
function getResponseFiles() {
    if (!fs.existsSync(DATA_DIR)) return [];

    return fs.readdirSync(DATA_DIR).filter(function (f) {
        return f.startsWith('resp_') && f.endsWith('.json');
    });
}


// ══════════════════════════════════════════════════════════════
// Helper: appendToExcelFile (Hybrid Save)
// ══════════════════════════════════════════════════════════════
async function appendToExcelFile(data) {
    var EXCEL_PATH = path.join(DATA_DIR, process.env.EXCEL_FILENAME || 'responses.xlsx');
    var workbook = new ExcelJS.Workbook();
    var worksheet;

    if (fs.existsSync(EXCEL_PATH)) {
        await workbook.xlsx.readFile(EXCEL_PATH);
        worksheet = workbook.getWorksheet('Responses');
    }

    if (!worksheet) {
        worksheet = workbook.addWorksheet('Responses', {
            properties: { defaultColWidth: 18 }
        });
        worksheet.columns = [
            { header: 'Session ID', key: 'sessionId', width: 20 },
            { header: 'Timestamp', key: 'timestamp', width: 22 },
            { header: 'Username', key: 'username', width: 15 },
            { header: 'Q1', key: 'q1', width: 20 },
            { header: 'Q2', key: 'q2', width: 20 },
            { header: 'Q3', key: 'q3', width: 20 },
            { header: 'Q4', key: 'q4', width: 20 },
            { header: 'Q5', key: 'q5', width: 20 },
            { header: 'Q6', key: 'q6', width: 20 },
            { header: 'Q7', key: 'q7', width: 20 },
            { header: 'Q8', key: 'q8', width: 20 },
            { header: 'Item 1', key: 'item1', width: 16 },
            { header: 'Item 2', key: 'item2', width: 16 },
            { header: 'Item 3', key: 'item3', width: 16 },
            { header: 'Item 4', key: 'item4', width: 16 },
            { header: 'Item 5', key: 'item5', width: 16 },
            { header: 'Item 6', key: 'item6', width: 16 },
            { header: 'Item 7', key: 'item7', width: 16 },
            { header: 'Item 8', key: 'item8', width: 16 },
            { header: 'Result Type', key: 'personalityType', width: 10 },
            { header: 'Result Name', key: 'personalityName', width: 25 },
            { header: 'Score C', key: 'scoreC', width: 10 },
            { header: 'Score P', key: 'scoreP', width: 10 },
            { header: 'Score F', key: 'scoreF', width: 10 },
            { header: 'Score L', key: 'scoreL', width: 10 },
            { header: 'Suggestion', key: 'suggestion', width: 40 },
            { header: 'IP Address', key: 'ip', width: 16 }
        ];

        // Header Style
        var headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE74C3C' } };
        headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
        headerRow.height = 24;
    }

    var rowData = {
        sessionId: data.sessionId,
        timestamp: data.timestamp,
        username: data.username,
        suggestion: data.suggestion,
        ip: data.ip
    };

    for (var i = 0; i < TOTAL_QUESTIONS; i++) {
        rowData['q' + (i + 1)] = data.answers[i] !== undefined ? data.answers[i] : '';
        rowData['item' + (i + 1)] = data.items[i] || '';
    }

    rowData.personalityType = data.personalityType || '';
    rowData.personalityName = data.personalityName || '';
    var scores = data.personalityScores || {};
    rowData.scoreC = scores.C || 0;
    rowData.scoreP = scores.P || 0;
    rowData.scoreF = scores.F || 0;
    rowData.scoreL = scores.L || 0;

    worksheet.addRow(rowData);
    await workbook.xlsx.writeFile(EXCEL_PATH);
}


// ══════════════════════════════════════════════════════════════
// Helper: generateSessionId
// ══════════════════════════════════════════════════════════════
function generateSessionId() {
    return crypto.randomBytes(8).toString('hex');
}


module.exports = router;
