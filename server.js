'use strict';

const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const PORT = Number(process.env.PORT) || 8080;
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC_DIR = path.join(__dirname, 'public');
const MIME_TYPES = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.ico': 'image/x-icon',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp'
};

function securityHeaders(res, requestId) {
    res.setHeader('X-Request-Id', requestId);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
}

function sendJson(res, status, value) {
    const body = JSON.stringify(value);
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body), 'Cache-Control': 'no-store' });
    res.end(body);
}

async function serveFile(req, res, pathname) {
    let decoded;
    try { decoded = decodeURIComponent(pathname); }
    catch { return sendJson(res, 400, { status: 'error', message: 'Invalid URL encoding' }); }

    const relativePath = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
    const filePath = path.resolve(PUBLIC_DIR, relativePath);
    if (filePath !== PUBLIC_DIR && !filePath.startsWith(PUBLIC_DIR + path.sep)) {
        return sendJson(res, 403, { status: 'error', message: 'Forbidden' });
    }

    try {
        const stat = await fs.stat(filePath);
        if (!stat.isFile()) return sendJson(res, 404, { status: 'error', message: 'Not found' });
        const contentType = MIME_TYPES[path.extname(filePath).toLowerCase()];
        if (!contentType) return sendJson(res, 415, { status: 'error', message: 'Unsupported file type' });
        const headers = {
            'Content-Type': contentType,
            'Content-Length': stat.size,
            'Cache-Control': filePath.endsWith('index.html') ? 'no-cache' : 'public, max-age=86400, stale-while-revalidate=604800',
            'Last-Modified': stat.mtime.toUTCString()
        };
        if (req.method === 'HEAD') { res.writeHead(200, headers); return res.end(); }
        res.writeHead(200, headers);
        const data = await fs.readFile(filePath);
        return res.end(data);
    } catch (error) {
        if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return sendJson(res, 404, { status: 'error', message: 'Not found' });
        console.error(JSON.stringify({ level: 'error', message: 'Static file read failed', code: error.code || 'UNKNOWN' }));
        return sendJson(res, 500, { status: 'error', message: 'Internal server error' });
    }
}

const server = http.createServer(async (req, res) => {
    const requestId = randomUUID();
    const startedAt = Date.now();
    securityHeaders(res, requestId);
    res.once('finish', () => console.log(JSON.stringify({ level: 'info', requestId, method: req.method, path: (req.url || '/').split('?')[0], status: res.statusCode, durationMs: Date.now() - startedAt })));

    if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.setHeader('Allow', 'GET, HEAD');
        return sendJson(res, 405, { status: 'error', message: 'Method not allowed' });
    }

    let url;
    try { url = new URL(req.url, 'http://localhost'); }
    catch { return sendJson(res, 400, { status: 'error', message: 'Invalid request URL' }); }

    if (url.pathname === '/health' || url.pathname === '/healthz') {
        return sendJson(res, 200, { status: 'ok', service: 'globalholmes-ltd', uptime: Math.floor(process.uptime()), timestamp: new Date().toISOString() });
    }
    if (url.pathname === '/api/status') {
        const memory = process.memoryUsage();
        return sendJson(res, 200, { status: 'ok', service: 'globalholmes-ltd', uptime: Math.floor(process.uptime()), nodeVersion: process.version, memory: { rssMb: Math.round(memory.rss / 1048576) } });
    }
    return serveFile(req, res, url.pathname);
});

server.headersTimeout = 10_000;
server.requestTimeout = 30_000;
server.keepAliveTimeout = 5_000;
server.maxRequestsPerSocket = 100;
server.listen(PORT, HOST, () => console.log(JSON.stringify({ level: 'info', message: 'GLOBALHOLMES LTD web server started', host: HOST, port: PORT })));
server.on('error', error => { console.error(JSON.stringify({ level: 'error', message: 'Server error', error: error.message })); process.exitCode = 1; });

let shuttingDown = false;
function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(JSON.stringify({ level: 'info', message: 'Graceful shutdown started', signal }));
    const timeout = setTimeout(() => server.closeAllConnections(), 10_000);
    timeout.unref();
    server.close(error => {
        clearTimeout(timeout);
        if (error) { console.error(JSON.stringify({ level: 'error', message: 'Shutdown failed', error: error.message })); process.exitCode = 1; }
    });
    server.closeIdleConnections();
}
process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));
