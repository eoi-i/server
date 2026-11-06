'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID, timingSafeEqual } = require('node:crypto');
const { Pool } = require('pg');

const PORT = Number(process.env.PORT) || 8080;
const HOST = process.env.HOST || '0.0.0.0';
const MAX_BODY_BYTES = 1024 * 1024;
const MAX_RECORDS = 100;
const startTime = Date.now();
const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean);
const databaseUrl = process.env.POOLED_CONNECTION;
const databaseToken = process.env.DB_API_TOKEN;
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

const pool = databaseUrl ? new Pool({
    connectionString: databaseUrl,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    keepAlive: true
}) : null;

let schemaReady;
async function ensureSchema() {
    if (!pool) throw new Error('Database is not configured');
    if (!schemaReady) {
        schemaReady = pool.query(`CREATE TABLE IF NOT EXISTS app_records (
            id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            data JSONB NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`).catch(error => { schemaReady = null; throw error; });
    }
    await schemaReady;
}

class HttpError extends Error {
    constructor(statusCode, message) { super(message); this.statusCode = statusCode; }
}

function sendJSON(res, statusCode, data) {
    if (res.writableEnded) return;
    const body = JSON.stringify(data);
    res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body), 'Cache-Control': 'no-store' });
    res.end(body);
}

function sendHTML(res) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': Buffer.byteLength(html), 'Cache-Control': 'no-cache' });
    res.end(html);
}

function readJSONBody(req) {
    return new Promise((resolve, reject) => {
        const declaredLength = Number(req.headers['content-length']);
        if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
            req.resume(); reject(new HttpError(413, 'Request body is too large')); return;
        }
        const chunks = []; let bytes = 0; let settled = false;
        req.on('data', chunk => {
            if (settled) return;
            bytes += chunk.length;
            if (bytes > MAX_BODY_BYTES) {
                settled = true; req.removeAllListeners('data'); req.resume();
                reject(new HttpError(413, 'Request body is too large')); return;
            }
            chunks.push(chunk);
        });
        req.once('end', () => {
            if (settled) return;
            try { const text = Buffer.concat(chunks).toString('utf8'); resolve(text ? JSON.parse(text) : {}); }
            catch { reject(new HttpError(400, 'Invalid JSON')); }
        });
        req.once('error', () => reject(new HttpError(400, 'Unable to read request body')));
        req.once('aborted', () => reject(new HttpError(400, 'Request was aborted')));
    });
}

function isAuthorized(req) {
    const header = req.headers.authorization || '';
    if (!databaseToken || !header.startsWith('Bearer ')) return false;
    const supplied = Buffer.from(header.slice(7)); const expected = Buffer.from(databaseToken);
    return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

function applySecurityHeaders(res, requestId) {
    res.setHeader('X-Request-Id', requestId);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src 'self' https://images.unsplash.com data:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
}

function applyCors(req, res) {
    const origin = req.headers.origin;
    if (!origin) return true;
    const wildcard = allowedOrigins.includes('*');
    if (!wildcard && !allowedOrigins.includes(origin)) return false;
    res.setHeader('Access-Control-Allow-Origin', wildcard ? '*' : origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization');
    res.setHeader('Access-Control-Max-Age', '600');
    return true;
}

function runtimeStatus() {
    const memory = process.memoryUsage();
    return { status: 'ok', service: 'globalholmes-ltd', uptime: Math.floor((Date.now() - startTime) / 1000), memory: { heapUsed: Math.round(memory.heapUsed / 1024 / 1024), rss: Math.round(memory.rss / 1024 / 1024) }, nodeVersion: process.version };
}

async function checkDatabase() {
    if (!pool) return false;
    await pool.query('SELECT 1');
    return true;
}

async function handleRecords(req, res, url) {
    if (!pool) return sendJSON(res, 503, { status: 'unavailable', message: 'Database is not configured.' });
    if (!databaseToken) return sendJSON(res, 503, { status: 'unavailable', message: 'Database API authentication is not configured.' });
    if (!isAuthorized(req)) return sendJSON(res, 401, { status: 'error', message: 'A valid Bearer token is required.' });
    try {
        await ensureSchema();
        if (req.method === 'GET') {
            const requestedLimit = Number(url.searchParams.get('limit')) || 20;
            const limit = Math.max(1, Math.min(MAX_RECORDS, Math.floor(requestedLimit)));
            const result = await pool.query('SELECT id, data, created_at FROM app_records ORDER BY id DESC LIMIT $1', [limit]);
            return sendJSON(res, 200, { status: 'ok', records: result.rows.map(row => ({ id: row.id, data: row.data, createdAt: row.created_at })), count: result.rowCount });
        }
        if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return sendJSON(res, 405, { status: 'error', message: 'Method not allowed' }); }
        if ((req.headers['content-type'] || '').split(';', 1)[0].trim().toLowerCase() !== 'application/json') {
            req.resume(); return sendJSON(res, 415, { status: 'error', message: 'Content-Type must be application/json' });
        }
        const data = await readJSONBody(req);
        const result = await pool.query('INSERT INTO app_records (data) VALUES ($1::jsonb) RETURNING id, data, created_at', [JSON.stringify(data)]);
        const row = result.rows[0];
        return sendJSON(res, 201, { status: 'ok', record: { id: row.id, data: row.data, createdAt: row.created_at } });
    } catch (error) {
        if (error instanceof HttpError) return sendJSON(res, error.statusCode, { status: 'error', message: error.message });
        console.error(JSON.stringify({ level: 'error', message: 'Database operation failed', code: error.code || 'UNKNOWN' }));
        return sendJSON(res, 503, { status: 'error', message: 'Database operation failed.' });
    }
}

const server = http.createServer(async (req, res) => {
    const requestId = randomUUID(); const startedAt = Date.now(); applySecurityHeaders(res, requestId);
    res.once('finish', () => console.log(JSON.stringify({ level: 'info', requestId, method: req.method, path: (req.url || '/').split('?')[0], status: res.statusCode, durationMs: Date.now() - startedAt })));
    if (!applyCors(req, res)) return sendJSON(res, 403, { status: 'error', message: 'Origin not allowed' });
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
    let url;
    try { url = new URL(req.url, 'http://localhost'); }
    catch { return sendJSON(res, 400, { status: 'error', message: 'Invalid request URL' }); }
    const pathname = url.pathname;
    if (req.method === 'GET' && pathname === '/') return sendHTML(res);
    if (req.method === 'GET' && pathname === '/health') return sendJSON(res, 200, { status: 'ok', service: 'globalholmes-ltd', uptime: Math.floor((Date.now() - startTime) / 1000), timestamp: new Date().toISOString() });
    if (req.method === 'GET' && pathname === '/api/status') return sendJSON(res, 200, runtimeStatus());
    if (req.method === 'GET' && pathname === '/api/info') return sendJSON(res, 200, { name: 'globalholmes-ltd', runtime: 'Node.js', version: process.version, database: pool ? 'configured' : 'not_configured' });
    if (pathname === '/api/db' && req.method === 'GET') {
        try { await checkDatabase(); return sendJSON(res, 200, { status: 'ok', database: 'connected' }); }
        catch { return sendJSON(res, 503, { status: 'unavailable', database: pool ? 'disconnected' : 'not_configured', message: 'PostgreSQL is unavailable or not configured.' }); }
    }
    if (pathname === '/api/db/records') return handleRecords(req, res, url);
    if (pathname === '/api/db') { res.setHeader('Allow', 'GET'); return sendJSON(res, 405, { status: 'error', message: 'Method not allowed' }); }
    if (pathname === '/api/echo') {
        if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return sendJSON(res, 405, { status: 'error', message: 'Method not allowed' }); }
        if ((req.headers['content-type'] || '').split(';', 1)[0].trim().toLowerCase() !== 'application/json') { req.resume(); return sendJSON(res, 415, { status: 'error', message: 'Content-Type must be application/json' }); }
        try { const data = await readJSONBody(req); return sendJSON(res, 200, { status: 'ok', received: data }); }
        catch (error) { return sendJSON(res, error instanceof HttpError ? error.statusCode : 400, { status: 'error', message: error.message || 'Invalid request' }); }
    }
    const knownPath = ['/', '/health', '/api/status', '/api/info', '/api/db', '/api/db/records', '/api/echo'].includes(pathname);
    if (knownPath) { res.setHeader('Allow', pathname === '/api/echo' || pathname === '/api/db/records' ? 'GET, POST' : 'GET'); return sendJSON(res, 405, { status: 'error', message: 'Method not allowed' }); }
    return sendJSON(res, 404, { status: 'error', message: 'Route not found' });
});

server.headersTimeout = 10_000;
server.requestTimeout = 30_000;
server.keepAliveTimeout = 5_000;
server.maxRequestsPerSocket = 100;
server.listen(PORT, HOST, () => console.log(JSON.stringify({ level: 'info', message: 'Server started', host: HOST, port: PORT, databaseConfigured: Boolean(pool) })));
server.on('error', error => { console.error(JSON.stringify({ level: 'error', message: 'Server error', error: error.message })); process.exitCode = 1; });
if (pool) pool.on('error', error => console.error(JSON.stringify({ level: 'error', message: 'PostgreSQL pool error', code: error.code || 'UNKNOWN' })));

let shuttingDown = false;
function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(JSON.stringify({ level: 'info', message: 'Graceful shutdown started', signal }));
    const forceExit = setTimeout(() => { console.error(JSON.stringify({ level: 'error', message: 'Shutdown timed out; closing active connections' })); server.closeAllConnections(); }, 10_000);
    forceExit.unref();
    server.close(async error => {
        clearTimeout(forceExit);
        if (error) { console.error(JSON.stringify({ level: 'error', message: 'Shutdown failed', error: error.message })); process.exitCode = 1; }
        if (pool) { try { await pool.end(); } catch { process.exitCode = 1; } }
    });
    server.closeIdleConnections();
}
process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));
