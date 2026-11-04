'use strict';

const http = require('node:http');
const { randomUUID } = require('node:crypto');

const PORT = Number(process.env.PORT) || 8080;
const HOST = process.env.HOST || '0.0.0.0';
const MAX_BODY_BYTES = 1024 * 1024;
const startTime = Date.now();
const allowedOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#0b1020">
<title>Server Mariam</title>
<style>
*{box-sizing:border-box}
body{margin:0;font-family:Arial,sans-serif;background:#0b1020;color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
.card{width:100%;max-width:520px;padding:35px;background:#151d33;border:1px solid #293654;border-radius:22px;text-align:center;box-shadow:0 20px 60px #0005}
.logo{font-size:48px;margin-bottom:15px}
h1{margin:10px 0;color:#80aaff}
p{color:#b7c4dc;line-height:1.8}
.status{display:inline-block;padding:9px 18px;border-radius:30px;background:#123c2a;color:#65e6a0;margin:15px}
button{border:0;padding:12px 22px;border-radius:10px;background:#477cff;color:white;font-size:15px;cursor:pointer}
button:focus-visible{outline:3px solid #fff;outline-offset:3px}
#result{margin-top:20px;color:#9fb8e8;word-break:break-word}
</style>
</head>
<body>
<main class="card">
<div class="logo" aria-hidden="true">⚡</div>
<h1>Server Mariam</h1>
<p>مرحباً بك في خادم التطبيقات الخاص بنا.</p>
<div class="status">● السيرفر يعمل</div>
<p>Node.js Native HTTP Server</p>
<button id="check" type="button">فحص السيرفر</button>
<div id="result" role="status" aria-live="polite"></div>
</main>
<script>
document.getElementById('check').addEventListener('click', async () => {
 const result = document.getElementById('result');
 result.textContent = 'جارٍ فحص السيرفر...';
 try {
  const response = await fetch('/health', { headers: { Accept: 'application/json' } });
  const data = await response.json();
  result.textContent = response.ok && data.status === 'ok' ? 'الاتصال ناجح ✓' : 'يوجد خطأ في السيرفر';
 } catch {
  result.textContent = 'تعذر الاتصال بالسيرفر';
 }
});
</script>
</body>
</html>`;

class HttpError extends Error {
    constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
    }
}

function sendJSON(res, statusCode, data) {
    if (res.writableEnded) return;
    const body = JSON.stringify(data);
    res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(body),
        'Cache-Control': 'no-store'
    });
    res.end(body);
}

function sendHTML(res) {
    res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Length': Buffer.byteLength(html),
        'Cache-Control': 'no-cache'
    });
    res.end(html);
}

function readJSONBody(req) {
    return new Promise((resolve, reject) => {
        const declaredLength = Number(req.headers['content-length']);
        if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
            req.resume();
            reject(new HttpError(413, 'Request body is too large'));
            return;
        }

        const chunks = [];
        let bytes = 0;
        req.on('data', chunk => {
            bytes += chunk.length;
            if (bytes > MAX_BODY_BYTES) {
                req.pause();
                req.removeAllListeners('data');
                req.resume();
                reject(new HttpError(413, 'Request body is too large'));
                return;
            }
            chunks.push(chunk);
        });
        req.once('end', () => {
            try {
                const text = Buffer.concat(chunks).toString('utf8');
                resolve(text ? JSON.parse(text) : {});
            } catch {
                reject(new HttpError(400, 'Invalid JSON'));
            }
        });
        req.once('error', () => reject(new HttpError(400, 'Unable to read request body')));
        req.once('aborted', () => reject(new HttpError(400, 'Request was aborted')));
    });
}

function applySecurityHeaders(res, requestId) {
    res.setHeader('X-Request-Id', requestId);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
}

function applyCors(req, res) {
    const origin = req.headers.origin;
    if (!origin) return true;

    const wildcardAllowed = allowedOrigins.includes('*');
    if (!wildcardAllowed && !allowedOrigins.includes(origin)) return false;

    res.setHeader('Access-Control-Allow-Origin', wildcardAllowed ? '*' : origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
    res.setHeader('Access-Control-Max-Age', '600');
    return true;
}

const server = http.createServer(async (req, res) => {
    const requestId = randomUUID();
    const startedAt = Date.now();
    applySecurityHeaders(res, requestId);

    res.once('finish', () => {
        console.log(JSON.stringify({
            level: 'info',
            requestId,
            method: req.method,
            path: (req.url || '/').split('?')[0],
            status: res.statusCode,
            durationMs: Date.now() - startedAt
        }));
    });

    if (!applyCors(req, res)) {
        return sendJSON(res, 403, { status: 'error', message: 'Origin not allowed' });
    }

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        return res.end();
    }

    let pathname;
    try {
        pathname = new URL(req.url, 'http://localhost').pathname;
    } catch {
        return sendJSON(res, 400, { status: 'error', message: 'Invalid request URL' });
    }

    if (req.method === 'GET' && pathname === '/') return sendHTML(res);

    if (req.method === 'GET' && pathname === '/health') {
        return sendJSON(res, 200, {
            status: 'ok',
            service: 'server-mariam',
            uptime: Math.floor((Date.now() - startTime) / 1000),
            timestamp: new Date().toISOString()
        });
    }

    if (req.method === 'GET' && pathname === '/api/info') {
        return sendJSON(res, 200, {
            name: 'server-mariam',
            runtime: 'Node.js',
            version: process.version,
            database: 'disabled',
            externalDependencies: false
        });
    }

    if (pathname === '/api/db') {
        if (req.method !== 'GET') {
            res.setHeader('Allow', 'GET');
            return sendJSON(res, 405, { status: 'error', message: 'Method not allowed' });
        }
        return sendJSON(res, 503, {
            status: 'disabled',
            message: 'Database functionality is disabled.'
        });
    }

    if (pathname === '/api/echo') {
        if (req.method !== 'POST') {
            res.setHeader('Allow', 'POST');
            return sendJSON(res, 405, { status: 'error', message: 'Method not allowed' });
        }
        const contentType = (req.headers['content-type'] || '').split(';', 1)[0].trim().toLowerCase();
        if (contentType !== 'application/json') {
            req.resume();
            return sendJSON(res, 415, { status: 'error', message: 'Content-Type must be application/json' });
        }

        try {
            const data = await readJSONBody(req);
            return sendJSON(res, 200, { status: 'ok', received: data });
        } catch (error) {
            const statusCode = error instanceof HttpError ? error.statusCode : 400;
            return sendJSON(res, statusCode, { status: 'error', message: error.message || 'Invalid request' });
        }
    }

    const knownPath = ['/', '/health', '/api/info', '/api/db', '/api/echo'].includes(pathname);
    if (knownPath) {
        const allowedMethod = pathname === '/api/echo' ? 'POST' : 'GET';
        res.setHeader('Allow', allowedMethod);
        return sendJSON(res, 405, { status: 'error', message: 'Method not allowed' });
    }

    return sendJSON(res, 404, { status: 'error', message: 'Route not found' });
});

server.headersTimeout = 10_000;
server.requestTimeout = 30_000;
server.keepAliveTimeout = 5_000;
server.maxRequestsPerSocket = 100;

server.listen(PORT, HOST, () => {
    console.log(JSON.stringify({ level: 'info', message: 'Server started', host: HOST, port: PORT, environment: process.env.NODE_ENV || 'development' }));
});

server.on('error', error => {
    console.error(JSON.stringify({ level: 'error', message: 'Server error', error: error.message }));
    process.exitCode = 1;
});

let shuttingDown = false;
function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(JSON.stringify({ level: 'info', message: 'Graceful shutdown started', signal }));

    const forceExit = setTimeout(() => {
        console.error(JSON.stringify({ level: 'error', message: 'Shutdown timed out; closing active connections' }));
        server.closeAllConnections();
    }, 10_000);
    forceExit.unref();

    server.close(error => {
        clearTimeout(forceExit);
        if (error) {
            console.error(JSON.stringify({ level: 'error', message: 'Shutdown failed', error: error.message }));
            process.exitCode = 1;
        }
    });
    server.closeIdleConnections();
}

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));
