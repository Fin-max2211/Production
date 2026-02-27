/**
 * ============================================================
 * security.js — Security Middleware (ชั้นป้องกัน)
 * ============================================================
 * 
 * รวม middleware ด้าน security ทั้งหมดไว้ที่เดียว:
 * 
 * 1. Helmet        → ตั้ง HTTP Security Headers
 * 2. Rate Limiter  → จำกัดจำนวน request ต่อ IP (ป้องกัน DDoS/Spam)
 * 3. Input Guard   → ฟังก์ชันตรวจสอบ & ทำความสะอาด input
 * 
 * ============================================================
 */

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const validator = require('validator');

/**
 * setupSecurity(app)
 * 
 * ฟังก์ชันหลักที่ติดตั้ง security middleware ทั้งหมดให้กับ Express app
 * เรียกใช้ครั้งเดียวใน server.js
 */
function setupSecurity(app) {

    // ──────────────────────────────────────────────────────────
    // A) Helmet — ตั้ง HTTP Security Headers อัตโนมัติ
    // ──────────────────────────────────────────────────────────
    // Helmet ช่วยป้องกัน:
    //   - XSS (Cross-Site Scripting)
    //   - Clickjacking (ฝัง iframe)
    //   - MIME Sniffing
    //   - และอื่นๆ อีกมาก
    app.use(helmet({
        // Content Security Policy (CSP)
        // กำหนดว่า browser สามารถโหลดอะไรได้บ้าง
        contentSecurityPolicy: {
            directives: {
                // อนุญาตให้โหลดจาก origin ของเราเท่านั้น (ยกเว้น fonts)
                defaultSrc: ["'self'"],

                // CSS: อนุญาต inline styles (สำหรับ animation) และ Google Fonts
                styleSrc: [
                    "'self'",
                    "'unsafe-inline'",           // จำเป็นสำหรับ inline styles
                    "https://fonts.googleapis.com"
                ],

                // Fonts: อนุญาตจาก Google Fonts CDN
                fontSrc: [
                    "'self'",
                    "https://fonts.gstatic.com"
                ],

                // JavaScript: อนุญาตไฟล์ของเราและ inline scripts
                // ⚠️ 'unsafe-inline' จำเป็นสำหรับ POC
                // ตอน production จริง ให้ใช้ nonce-based CSP แทน
                scriptSrc: ["'self'", "'unsafe-inline'"],

                // รูปภาพ: อนุญาตจาก origin ของเรา + data URIs (สำหรับ favicon emoji)
                imgSrc: ["'self'", "data:", "blob:"],

                // ห้ามฝังเว็บเราใน iframe (ป้องกัน Clickjacking)
                frameAncestors: ["'none'"],

                // API calls: อนุญาตเรียก API ของเราเท่านั้น
                connectSrc: ["'self'"],

                // ห้ามใช้ <object>, <embed>, <applet>
                objectSrc: ["'none'"],

                // กำหนด base URI เป็น origin ของเราเท่านั้น
                baseUri: ["'self'"],

                // ห้ามส่ง form ไปที่อื่น
                formAction: ["'self'"]
            }
        },

        // ป้องกันการเปิดเว็บเราใน iframe
        frameguard: { action: 'deny' },

        // ป้องกัน MIME type sniffing
        noSniff: true,

        // ตั้ง Referrer-Policy: ไม่ส่ง referrer ข้าม origin
        referrerPolicy: { policy: 'strict-origin-when-cross-origin' },

        // ปิด X-Powered-By header (ซ่อนว่าใช้ Express)
        hidePoweredBy: true
    }));

    // ──────────────────────────────────────────────────────────
    // B) Rate Limiter — จำกัดจำนวน request ต่อ IP
    // ──────────────────────────────────────────────────────────
    // ป้องกัน:
    //   - DDoS attacks (ส่ง request ท่วม)
    //   - Brute force (ลองส่งข้อมูลซ้ำๆ)
    //   - Spam submissions (ส่งคำตอบซ้ำๆ)

    // Rate limit สำหรับหน้าเว็บทั่วไป
    const generalLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,   // หน้าต่างเวลา: 15 นาที
        max: parseInt(process.env.RATE_LIMIT_MAX) || 1000, // dev: 1000, production: ตั้ง RATE_LIMIT_MAX=100 ใน .env
        standardHeaders: true,       // ส่ง RateLimit-* headers กลับ
        legacyHeaders: false,        // ปิด X-RateLimit-* headers เก่า
        message: {
            success: false,
            message: 'คุณส่งคำขอมากเกินไป กรุณารอสักครู่แล้วลองใหม่'
        }
    });
    app.use(generalLimiter);

    // Rate limit เฉพาะ API endpoints (เข้มงวดกว่า)
    // จำกัด 20 requests / 15 นาที สำหรับการส่งข้อมูล
    const apiLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 20,                     // สูงสุด 20 API calls / 15 นาที / IP
        standardHeaders: true,
        legacyHeaders: false,
        message: {
            success: false,
            message: 'คุณส่งข้อมูลมากเกินไป กรุณารอสักครู่'
        }
    });
    app.use('/api', apiLimiter);

    // ──────────────────────────────────────────────────────────
    // C) ปิด X-Powered-By เพิ่มเติม (ซ่อนว่าใช้ Express)
    // ──────────────────────────────────────────────────────────
    app.disable('x-powered-by');
}


// ──────────────────────────────────────────────────────────────
// D) sanitizeInput — ทำความสะอาด input จาก user
// ──────────────────────────────────────────────────────────────
/**
 * ทำความสะอาด string ที่ user ส่งมา:
 * 1. ตัดช่องว่างหัวท้าย (trim)
 * 2. แปลง HTML entities เพื่อป้องกัน XSS
 *    เช่น <script> → &lt;script&gt;
 * 3. จำกัดความยาว
 * 
 * @param {string} input     - ข้อความจาก user
 * @param {number} maxLength - ความยาวสูงสุด (default: 200)
 * @returns {string}         - ข้อความที่สะอาดแล้ว
 */
function sanitizeInput(input, maxLength = 200) {
    if (typeof input !== 'string') return '';

    let clean = input.trim();

    // ป้องกัน XSS: แปลงตัวอักษรพิเศษ HTML
    clean = validator.escape(clean);

    // จำกัดความยาว
    if (clean.length > maxLength) {
        clean = clean.substring(0, maxLength);
    }

    return clean;
}


/**
 * validateAnswerIndex — ตรวจสอบว่า answer index ถูกต้อง
 * 
 * @param {*} index       - ค่าที่ user ส่งมา
 * @param {number} max    - ค่าสูงสุดที่ยอมรับ (default: 3 = ตัวเลือก 0-3)
 * @returns {number|null} - index ที่ถูกต้อง หรือ null ถ้าไม่ถูกต้อง
 */
function validateAnswerIndex(index, max = 3) {
    const num = parseInt(index, 10);
    if (isNaN(num) || num < 0 || num > max) return null;
    return num;
}


// Export ฟังก์ชันทั้งหมดเพื่อใช้ในไฟล์อื่น
module.exports = {
    setupSecurity,
    sanitizeInput,
    validateAnswerIndex
};
