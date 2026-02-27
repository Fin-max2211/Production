# 🎓 Your TU Life Starter Pack

> Interactive quiz web app สำหรับนักศึกษามหาวิทยาลัยธรรมศาสตร์  
> ตอบคำถาม 10 ข้อ แล้วค้นหา Starter Pack สำหรับชีวิตใน TU!  
> Developed by **Porter TU Party**

---

## 📸 Screenshots

| Cover | Quiz | Reveal | Summary |
|-------|------|--------|---------|
| 🎓 Cover Page | ❓ Question Page | 📦 Item Reveal | 🎒 Starter Pack |

---

## ✨ Features

- 🎯 **10 คำถามเกี่ยวกับชีวิตใน TU** — แต่ละข้อมีไอเทมรางวัล 4 ตัวเลือก
- 🛡️ **Production-Ready Security** — Helmet, CSP, Rate Limiting, Input Sanitization
- 📊 **Excel Data Export** — เก็บข้อมูลทุก response ลงไฟล์ Excel อัตโนมัติ
- 💾 **Auto-Backup** — สำรองข้อมูล Excel อัตโนมัติทุกครั้งที่เขียน
- 📱 **Mobile-First Design** — ออกแบบเพื่อมือถือ แต่ใช้ได้ทุก device
- 🎊 **Confetti Animation** — ฉลองเมื่อทำ quiz เสร็จ!
- ♿ **Accessible** — ARIA labels, keyboard navigation, focus indicators
- 📝 **Bilingual Comments** — โค้ดมี comment ทั้งไทยและอังกฤษ

---

## 🚀 Quick Start

### 1. ติดตั้ง Dependencies

```bash
npm install
```

### 2. ตั้งค่า Environment

```bash
# สร้างไฟล์ .env จากตัวอย่าง
cp .env.example .env
```

แก้ไขค่าใน `.env` ตามต้องการ (ดู [Environment Variables](#-environment-variables))

### 3. รัน Server

```bash
# Development
npm run dev

# Production
npm start
```

### 4. เปิด Browser

```
http://localhost:3000
```

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | HTML5 + CSS3 + Vanilla JS | UI & Interaction |
| **Backend** | Node.js + Express.js | API Server |
| **Security** | Helmet + express-rate-limit + validator | Protection |
| **Data** | ExcelJS | Data Export & Storage |
| **Compression** | compression (gzip) | Performance |

---

## 📁 Project Structure

```
tesst/
├── 📄 .env                    ← Environment config (DO NOT COMMIT)
├── 📄 .env.example            ← Template for .env
├── 📄 .gitignore              ← Git ignore rules
├── 📄 package.json            ← Dependencies & scripts
├── 📄 README.md               ← You are here!
│
├── 📁 public/                 ← Frontend (served as static)
│   ├── 📄 index.html          ← Main HTML (7-page structure)
│   ├── 📁 css/
│   │   └── 📄 style.css       ← All styles
│   ├── 📁 js/
│   │   ├── 📄 data.js         ← ⭐ Quiz content (edit here!)
│   │   └── 📄 app.js          ← Application logic
│   └── 📁 assets/images/      ← Place images here
│
├── 📁 server/                 ← Backend
│   ├── 📄 server.js           ← Express server entry point
│   ├── 📁 middleware/
│   │   └── 📄 security.js     ← Security middleware
│   ├── 📁 routes/
│   │   └── 📄 api.js          ← API endpoints
│   ├── 📁 utils/
│   │   ├── 📄 logger.js       ← File-based logging
│   │   └── 📄 backup.js       ← Auto-backup system
│   └── 📁 data/
│       ├── 📁 responses/      ← Excel files
│       ├── 📁 backups/        ← Auto-backups
│       └── 📁 logs/           ← Log files
│
└── 📁 tests/                  ← Test suite
    ├── 📄 validation.test.js  ← Unit tests
    └── 📄 api.test.js         ← API integration tests
```

---

## 🔐 Security Features

| Feature | Description |
|---------|-------------|
| **Helmet** | 10+ HTTP Security Headers |
| **CSP** | Content Security Policy ป้องกัน XSS |
| **Rate Limiting** | 100 req/15min (general), 20 req/15min (API) |
| **Input Sanitization** | HTML escape + length limit ทุก field |
| **Input Validation** | Type checking + range validation |
| **JSON Body Limit** | จำกัด request body 10KB |
| **CORS** | Configurable origin restriction |
| **Error Hiding** | Production: ไม่แสดง stack trace |
| **Write Mutex** | ป้องกัน race condition เวลาเขียน Excel |
| **Stats Auth** | API key required for `/api/stats` |
| **No innerHTML** | XSS-safe DOM manipulation |

---

## 🌐 API Endpoints

### `POST /api/submit`
Submit quiz answers and save to Excel.

**Request Body:**
```json
{
  "username": "สมชาย",
  "answers": [0, 2, 1, 3, 0, 1, 2, 3, 0, 1],
  "items": ["หนังสือเก่า", "เครื่องคิดเลข", ...],
  "suggestion": "อยากให้เพิ่ม..."
}
```

**Response:**
```json
{ "success": true, "message": "บันทึกข้อมูลสำเร็จ! 🎉" }
```

### `GET /api/health`
Health check endpoint.

### `GET /api/stats`
Get response statistics (requires API key).

**Header:** `x-api-key: <your-api-key>`

---

## ⚙️ Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `NODE_ENV` | `development` | `production` or `development` |
| `RATE_LIMIT_MAX` | `100` | Max requests per 15 min |
| `EXCEL_FILENAME` | `responses.xlsx` | Excel output filename |
| `ALLOWED_ORIGIN` | `false` | CORS origin (e.g. `https://example.com`) |
| `ADMIN_API_KEY` | — | API key for `/api/stats` |
| `BACKUP_ENABLED` | `true` | Enable auto-backup |
| `BACKUP_MAX_FILES` | `10` | Max backup files to keep |

---

## 📝 Content Management

### แก้ไขคำถาม/ไอเทม
แก้ไขที่ **`public/js/data.js`** ไฟล์เดียว:

```javascript
{
  text: 'คำถามของคุณ',
  img: '🏫',                        // emoji หรือ path รูป
  options: ['ตัวเลือก1', 'ตัวเลือก2', 'ตัวเลือก3', 'ตัวเลือก4'],
  rewards: [
    { name: 'ชื่อไอเทม', desc: 'คำอธิบาย', img: '📚' },
    // ...
  ]
}
```

### ใส่รูปภาพจริง
1. วางรูปใน `public/assets/images/`
2. เปลี่ยน `img` จาก emoji เป็น path:
```javascript
img: 'assets/images/q1.png'   // ระบบจะแสดงเป็น <img> อัตโนมัติ
```

---

## 🧪 Testing

```bash
# รัน tests ทั้งหมด
npm test

# รันพร้อม coverage report
npm run test:coverage
```

---

## 📦 Deployment

1. ตั้งค่า `.env` สำหรับ production:
   ```
   NODE_ENV=production
   ALLOWED_ORIGIN=https://your-domain.com
   ADMIN_API_KEY=your-secret-key-here
   ```

2. Deploy ทั้งโฟลเดอร์ไปยัง hosting ที่รองรับ Node.js:
   - Railway
   - Render
   - Vercel (serverless)
   - DigitalOcean App Platform
   - AWS EC2

3. ตั้งค่า `npm start` เป็น start command

---

## 📜 License

UNLICENSED — Private project by Porter TU Party

---

## 🤝 Contributing

1. Fork this repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
