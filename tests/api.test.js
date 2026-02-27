/**
 * ============================================================
 * api.test.js — Integration Tests สำหรับ API Endpoints
 * ============================================================
 */

const request = require('supertest');
const express = require('express');
const path = require('path');
const fs = require('fs');

process.env.NODE_ENV = 'test';
process.env.ADMIN_API_KEY = 'test-secret-key';
process.env.BACKUP_ENABLED = 'false';

const apiRoutes = require('../server/routes/api');

function createTestApp() {
    var app = express();
    app.use(express.json({ limit: '10kb' }));
    app.use('/api', apiRoutes);
    return app;
}

// Cleanup test JSON files after tests
afterAll(() => {
    var dataDir = path.join(__dirname, '..', 'server', 'data', 'test_responses');
    if (fs.existsSync(dataDir)) {
        var files = fs.readdirSync(dataDir).filter(f => f.startsWith('resp_') && f.endsWith('.json'));
        files.forEach(f => {
            try { fs.unlinkSync(path.join(dataDir, f)); } catch (e) { /* ignore */ }
        });
        try { fs.rmdirSync(dataDir); } catch (e) { /* ignore */ }
    }
});

// ══════════════════════════════════════════════════════════════
// TEST: GET /api/health
// ══════════════════════════════════════════════════════════════
describe('GET /api/health', () => {
    var app = createTestApp();

    test('should return 200 and healthy status', async () => {
        var res = await request(app).get('/api/health');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.status).toBe('healthy');
        expect(res.body.timestamp).toBeDefined();
        expect(res.body.uptime).toBeDefined();
    });
});

// ══════════════════════════════════════════════════════════════
// TEST: POST /api/submit
// ══════════════════════════════════════════════════════════════
describe('POST /api/submit', () => {
    var app = createTestApp();

    var validPayload = {
        username: 'testuser',
        answers: [0, 1, 2, 3, 0, 1, 2, 3, 0, 1],
        items: ['item1', 'item2', 'item3', 'item4', 'item5',
            'item6', 'item7', 'item8', 'item9', 'item10'],
        suggestion: 'Great quiz!'
    };

    test('should accept valid submission', async () => {
        var res = await request(app)
            .post('/api/submit')
            .send(validPayload)
            .set('Content-Type', 'application/json');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    test('should reject empty username', async () => {
        var res = await request(app)
            .post('/api/submit')
            .send({ ...validPayload, username: '' })
            .set('Content-Type', 'application/json');
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });

    test('should reject missing username', async () => {
        var payload = { ...validPayload };
        delete payload.username;
        var res = await request(app)
            .post('/api/submit')
            .send(payload)
            .set('Content-Type', 'application/json');
        expect(res.status).toBe(400);
    });

    test('should reject wrong number of answers', async () => {
        var res = await request(app)
            .post('/api/submit')
            .send({ ...validPayload, answers: [0, 1, 2] })
            .set('Content-Type', 'application/json');
        expect(res.status).toBe(400);
    });

    test('should reject invalid answer index', async () => {
        var res = await request(app)
            .post('/api/submit')
            .send({ ...validPayload, answers: [0, 1, 2, 3, 0, 1, 2, 3, 0, 99] })
            .set('Content-Type', 'application/json');
        expect(res.status).toBe(400);
    });

    test('should reject non-array answers', async () => {
        var res = await request(app)
            .post('/api/submit')
            .send({ ...validPayload, answers: 'not-an-array' })
            .set('Content-Type', 'application/json');
        expect(res.status).toBe(400);
    });

    test('should reject wrong number of items', async () => {
        var res = await request(app)
            .post('/api/submit')
            .send({ ...validPayload, items: ['only-one'] })
            .set('Content-Type', 'application/json');
        expect(res.status).toBe(400);
    });

    test('should accept submission without suggestion', async () => {
        var payload = { ...validPayload };
        delete payload.suggestion;
        var res = await request(app)
            .post('/api/submit')
            .send(payload)
            .set('Content-Type', 'application/json');
        expect(res.status).toBe(200);
    });

    test('should handle XSS in username', async () => {
        var res = await request(app)
            .post('/api/submit')
            .send({ ...validPayload, username: '<script>alert("xss")</script>' })
            .set('Content-Type', 'application/json');
        expect(res.status).toBe(200);
    });

    test('should create a JSON file for each submission', async () => {
        var dataDir = path.join(__dirname, '..', 'server', 'data', 'test_responses');
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        var beforeFiles = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));

        await request(app)
            .post('/api/submit')
            .send({ ...validPayload, username: 'filecheck' })
            .set('Content-Type', 'application/json');

        var afterFiles = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));
        expect(afterFiles.length).toBeGreaterThan(beforeFiles.length);
    });
});

// ══════════════════════════════════════════════════════════════
// TEST: GET /api/stats
// ══════════════════════════════════════════════════════════════
describe('GET /api/stats', () => {
    var app = createTestApp();

    test('should require API key', async () => {
        var res = await request(app).get('/api/stats');
        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
    });

    test('should reject wrong API key', async () => {
        var res = await request(app)
            .get('/api/stats')
            .set('x-api-key', 'wrong-key');
        expect(res.status).toBe(401);
    });

    test('should accept correct API key', async () => {
        var res = await request(app)
            .get('/api/stats')
            .set('x-api-key', 'test-secret-key');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.totalResponses).toBeDefined();
    });
});

// ══════════════════════════════════════════════════════════════
// TEST: GET /api/export
// ══════════════════════════════════════════════════════════════
describe('GET /api/export', () => {
    var app = createTestApp();

    test('should require API key', async () => {
        var res = await request(app).get('/api/export');
        expect(res.status).toBe(401);
    });

    test('should export xlsx with correct API key', async () => {
        // Submit some data first
        await request(app)
            .post('/api/submit')
            .send({
                username: 'exporttest',
                answers: [0, 1, 2, 3, 0, 1, 2, 3, 0, 1],
                items: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'],
                suggestion: 'test'
            });

        var res = await request(app)
            .get('/api/export')
            .set('x-api-key', 'test-secret-key');
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toContain('spreadsheetml');
    });
});
