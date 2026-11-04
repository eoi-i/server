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
<meta name="theme-color" content="#080d1a">
<meta name="description" content="لوحة حالة خادم Server Mariam ومعلومات وقت التشغيل.">
<title>Server Mariam — مركز الحالة</title>
<style>
:root{color-scheme:dark;--bg:#080d1a;--panel:#10192b;--panel2:#0d1525;--border:#24324a;--muted:#9aa9c2;--text:#f4f7ff;--blue:#6c96ff;--cyan:#62e6d3;--green:#5ce0a0;--shadow:0 24px 80px #0005}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;background:radial-gradient(ellipse at 82% 4%,#19356755,transparent 36%),radial-gradient(ellipse at 8% 45%,#143c3a33,transparent 32%),var(--bg);color:var(--text);font-family:system-ui,-apple-system,"Segoe UI",Arial,sans-serif;line-height:1.6}
button{font:inherit}
.shell{width:min(1040px,100% - 36px);margin:auto;padding:30px 0 42px}
.topbar{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:42px}
.brand{display:flex;align-items:center;gap:12px;font-weight:750;letter-spacing:.01em}
.brand-mark{display:grid;place-items:center;width:42px;height:42px;border:1px solid #6c96ff55;border-radius:14px;background:linear-gradient(145deg,#24427b,#16243d);font-size:23px;box-shadow:0 8px 26px #315ac933}
.brand small{display:block;color:var(--muted);font-size:12px;font-weight:500;letter-spacing:0}
.live-pill{display:inline-flex;align-items:center;gap:9px;padding:8px 13px;border:1px solid #285a49;border-radius:999px;background:#10291f;color:#a8f3ce;font-size:13px}
.live-dot{width:8px;height:8px;border-radius:50%;background:var(--green);box-shadow:0 0 14px #5ce0a0}
.hero{position:relative;overflow:hidden;padding:clamp(25px,6vw,58px);border:1px solid #334463;border-radius:28px;background:linear-gradient(125deg,#16223aee,#10192beF 65%,#10232cee);box-shadow:var(--shadow)}
.hero:after{position:absolute;content:"";width:290px;height:290px;left:-125px;top:-150px;border-radius:50%;background:#6087ff22;filter:blur(8px);pointer-events:none}
.eyebrow{display:flex;align-items:center;gap:9px;color:#a9c1ff;font-size:13px;font-weight:700;letter-spacing:.06em}
.eyebrow:before{content:"";width:20px;height:1px;background:var(--cyan)}
h1{max-width:700px;margin:12px 0 10px;font-size:clamp(36px,7vw,64px);line-height:1.12;letter-spacing:-.04em}
h1 span{color:var(--blue)}
.lead{max-width:610px;margin:0;color:#b8c5da;font-size:clamp(15px,2vw,18px)}
.hero-bottom{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-top:30px}
.refresh-note{color:var(--muted);font-size:13px}
.button{display:inline-flex;align-items:center;justify-content:center;gap:9px;min-height:46px;padding:10px 17px;border:1px solid #789cff44;border-radius:13px;background:linear-gradient(135deg,#4778ef,#5e8cff);color:white;font-weight:700;cursor:pointer;box-shadow:0 8px 24px #4778ef33;transition:transform .18s ease,filter .18s ease}
.button:hover{filter:brightness(1.09);transform:translateY(-1px)}
.button:focus-visible{outline:3px solid white;outline-offset:3px}
.button:disabled{opacity:.65;cursor:wait;transform:none}
.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:15px;margin-top:18px}
.stat,.section{border:1px solid var(--border);border-radius:19px;background:linear-gradient(150deg,#111b2e,#0d1524);box-shadow:0 12px 40px #0002}
.stat{padding:19px}
.stat-head{display:flex;align-items:center;justify-content:space-between;color:var(--muted);font-size:13px}
.stat-icon{display:grid;place-items:center;width:34px;height:34px;border:1px solid #334665;border-radius:11px;background:#1a2841;color:#93afff;font-size:16px}
.stat-value{margin-top:13px;font-size:clamp(20px,3vw,27px);font-weight:750;letter-spacing:-.02em;direction:ltr;text-align:right}
.stat-caption{margin-top:2px;color:#7f90aa;font-size:12px}
.sections{display:grid;grid-template-columns:1.1fr .9fr;gap:16px;margin-top:16px}
.section{padding:22px}
.section-title{display:flex;align-items:center;gap:10px;margin:0 0 16px;font-size:17px}
.section-title .stat-icon{width:31px;height:31px;font-size:14px}
.endpoint-list{display:grid;gap:10px}
.endpoint{display:flex;align-items:center;gap:11px;padding:11px 12px;border:1px solid #202e44;border-radius:12px;background:#0c1422}
.method{min-width:48px;color:var(--green);font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:11px;font-weight:800;direction:ltr;text-align:left}
.path{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:13px;direction:ltr;text-align:left}
.endpoint-desc{margin-inline-start:auto;color:#8798b2;font-size:12px}
.check-state{display:flex;align-items:flex-start;gap:12px;padding:14px;border:1px solid #24523f;border-radius:13px;background:#10271f}
.check-state-icon{display:grid;place-items:center;flex:0 0 31px;height:31px;border-radius:10px;background:#174a36;color:#78edb4}
.check-state strong{display:block;color:#a9f1cc;font-size:14px}
.check-state p{margin:2px 0 0;color:#91b7a4;font-size:12px}
.info-list{display:grid;gap:10px;margin-top:17px}
.info-row{display:flex;justify-content:space-between;gap:12px;color:var(--muted);font-size:13px}
.info-row b{color:#e1e9f8;font-weight:600;direction:ltr}
footer{display:flex;justify-content:space-between;gap:12px;margin-top:22px;color:#71819b;font-size:12px}
#result{min-height:22px;color:#a9c1ff;font-size:13px}
@media(max-width:720px){.shell{width:min(100% - 26px,560px);padding-top:19px}.topbar{margin-bottom:24px}.grid{grid-template-columns:1fr}.stat{display:grid;grid-template-columns:1fr auto;align-items:center}.stat-value{grid-column:2;grid-row:1/3;margin:0}.stat-caption{grid-column:1}.sections{grid-template-columns:1fr}.hero-bottom{align-items:flex-start;flex-direction:column}.button{width:100%}.endpoint-desc{font-size:11px}}
@media(max-width:390px){.endpoint{gap:7px;padding:10px 8px}.endpoint-desc{display:none}.brand{font-size:14px}.live-pill{font-size:11px;padding:7px 9px}}
@media(prefers-reduced-motion:reduce){*,*:before,*:after{scroll-behavior:auto!important;transition:none!important}}
</style>
</head>
<body>
<main class="shell">
<header class="topbar">
  <div class="brand"><div class="brand-mark" aria-hidden="true">⚡</div><div>Server Mariam<small>لوحة حالة الخادم</small></div></div>
  <div class="live-pill"><span class="live-dot" aria-hidden="true"></span><span id="live-label">الخادم متصل</span></div>
</header>
<section class="hero" aria-labelledby="page-title">
  <div class="eyebrow">مركز الخدمة</div>
  <h1 id="page-title">خادمك يعمل،<br><span>ونحن نتابعه.</span></h1>
  <p class="lead">لوحة مباشرة لمتابعة حالة الخادم وموارده. يمكنك فحص الاتصال وتحديث المعلومات في أي وقت.</p>
  <div class="hero-bottom">
    <button class="button" id="check" type="button"><span aria-hidden="true">↻</span><span id="button-label">فحص الخادم الآن</span></button>
    <div><div class="refresh-note" id="updated">سيتم تحديث الحالة تلقائياً كل 30 ثانية</div><div id="result" role="status" aria-live="polite"></div></div>
  </div>
</section>
<section class="grid" aria-label="إحصاءات الخادم">
  <article class="stat"><div class="stat-head"><span>مدة التشغيل</span><span class="stat-icon" aria-hidden="true">◷</span></div><div class="stat-value" id="uptime">—</div><div class="stat-caption">منذ آخر تشغيل للخدمة</div></article>
  <article class="stat"><div class="stat-head"><span>استخدام الذاكرة</span><span class="stat-icon" aria-hidden="true">▤</span></div><div class="stat-value" id="memory">—</div><div class="stat-caption">ذاكرة العملية الحالية</div></article>
  <article class="stat"><div class="stat-head"><span>زمن الاستجابة</span><span class="stat-icon" aria-hidden="true">⌁</span></div><div class="stat-value" id="latency">—</div><div class="stat-caption">آخر فحص للاتصال</div></article>
</section>
<section class="sections">
  <article class="section">
    <h2 class="section-title"><span class="stat-icon" aria-hidden="true">⌘</span>واجهات الخدمة</h2>
    <div class="endpoint-list">
      <div class="endpoint"><span class="method">GET</span><span class="path">/health</span><span class="endpoint-desc">فحص الصحة</span></div>
      <div class="endpoint"><span class="method">GET</span><span class="path">/api/status</span><span class="endpoint-desc">إحصاءات مباشرة</span></div>
      <div class="endpoint"><span class="method">GET</span><span class="path">/api/info</span><span class="endpoint-desc">معلومات الخدمة</span></div>
      <div class="endpoint"><span class="method">POST</span><span class="path">/api/echo</span><span class="endpoint-desc">اختبار JSON</span></div>
    </div>
  </article>
  <article class="section">
    <h2 class="section-title"><span class="stat-icon" aria-hidden="true">✓</span>حالة النظام</h2>
    <div class="check-state"><span class="check-state-icon" aria-hidden="true">✓</span><div><strong id="system-state">الخدمة جاهزة</strong><p id="system-detail">بانتظار فحص الاتصال…</p></div></div>
    <div class="info-list">
      <div class="info-row"><span>بيئة التشغيل</span><b id="runtime">Node.js</b></div>
      <div class="info-row"><span>قاعدة البيانات</span><b>غير مفعّلة</b></div>
      <div class="info-row"><span>آخر تحديث</span><b id="time">—</b></div>
    </div>
  </article>
</section>
<footer><span>Server Mariam · خدمة تجريبية</span><span>مبني على Node.js</span></footer>
</main>
<script>
(() => {
 const $ = id => document.getElementById(id);
 const button = $('check');
 let checking = false;
 function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (days) parts.push(days + ' يوم');
  if (hours || days) parts.push(hours + ' ساعة');
  parts.push(minutes + ' دقيقة');
  return parts.join('، ');
 }
 async function refresh() {
  if (checking) return;
  checking = true;
  button.disabled = true;
  $('button-label').textContent = 'جارٍ الفحص…';
  const started = performance.now();
  try {
   const response = await fetch('/api/status', { cache: 'no-store', headers: { Accept: 'application/json' } });
   if (!response.ok) throw new Error('status');
   const data = await response.json();
   const elapsed = Math.max(0, Math.round(performance.now() - started));
   $('uptime').textContent = formatUptime(data.uptime);
   $('memory').textContent = data.memory.heapUsed + ' MB';
   $('latency').textContent = elapsed + ' ms';
   $('runtime').textContent = 'Node ' + data.nodeVersion;
   $('time').textContent = new Intl.DateTimeFormat('ar', { hour: '2-digit', minute: '2-digit' }).format(new Date(data.timestamp));
   $('updated').textContent = 'آخر فحص: ' + new Intl.DateTimeFormat('ar', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(data.timestamp));
   $('live-label').textContent = 'الخادم متصل';
   $('system-state').textContent = 'جميع الأنظمة تعمل';
   $('system-detail').textContent = 'تم الاتصال بالخادم بنجاح خلال ' + elapsed + ' مللي ثانية.';
   $('result').textContent = 'اكتمل الفحص بنجاح ✓';
   document.querySelector('.live-pill').style.borderColor = '#285a49';
  } catch {
   $('live-label').textContent = 'تعذر الاتصال';
   $('system-state').textContent = 'تعذر الوصول للخادم';
   $('system-detail').textContent = 'تحقق من اتصالك وحاول مرة أخرى.';
   $('result').textContent = 'فشل فحص الخادم';
   $('latency').textContent = '—';
   document.querySelector('.live-pill').style.borderColor = '#713d47';
  } finally {
   checking = false;
   button.disabled = false;
   $('button-label').textContent = 'فحص الخادم الآن';
  }
 }
 button.addEventListener('click', refresh);
 refresh();
 window.setInterval(refresh, 30000);
})();
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

function getRuntimeStatus() {
    const memory = process.memoryUsage();
    return {
        status: 'ok',
        service: 'server-mariam',
        uptime: Math.floor((Date.now() - startTime) / 1000),
        memory: {
            heapUsed: Math.round(memory.heapUsed / 1024 / 1024),
            rss: Math.round(memory.rss / 1024 / 1024)
        },
        nodeVersion: process.versions.node,
        timestamp: new Date().toISOString()
    };
}

const server = http.createServer(async (req, res) => {
    const requestId = randomUUID();
    const startedAt = Date.now();
    applySecurityHeaders(res, requestId);

    res.once('finish', () => {
        console.log(JSON.stringify({
            level: 'info', requestId, method: req.method,
            path: (req.url || '/').split('?')[0], status: res.statusCode,
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
            status: 'ok', service: 'server-mariam',
            uptime: Math.floor((Date.now() - startTime) / 1000),
            timestamp: new Date().toISOString()
        });
    }

    if (req.method === 'GET' && pathname === '/api/status') {
        return sendJSON(res, 200, getRuntimeStatus());
    }

    if (req.method === 'GET' && pathname === '/api/info') {
        return sendJSON(res, 200, {
            name: 'server-mariam', runtime: 'Node.js', version: process.version,
            database: 'disabled', externalDependencies: false
        });
    }

    if (pathname === '/api/db') {
        if (req.method !== 'GET') {
            res.setHeader('Allow', 'GET');
            return sendJSON(res, 405, { status: 'error', message: 'Method not allowed' });
        }
        return sendJSON(res, 503, { status: 'disabled', message: 'Database functionality is disabled.' });
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

    const knownPath = ['/', '/health', '/api/status', '/api/info', '/api/db', '/api/echo'].includes(pathname);
    if (knownPath) {
        res.setHeader('Allow', pathname === '/api/echo' ? 'POST' : 'GET');
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
