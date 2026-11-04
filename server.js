'use strict';

const http = require('http');

const PORT = Number(process.env.PORT) || 8080;
const HOST = '0.0.0.0';

const startTime = Date.now();

const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Server Mariam</title>
<style>
*{box-sizing:border-box}
body{
 margin:0;
 font-family:Arial,sans-serif;
 background:#0b1020;
 color:#fff;
 min-height:100vh;
 display:flex;
 align-items:center;
 justify-content:center;
 padding:20px
}
.card{
 width:100%;
 max-width:520px;
 padding:35px;
 background:#151d33;
 border:1px solid #293654;
 border-radius:22px;
 text-align:center;
 box-shadow:0 20px 60px #0005
}
.logo{font-size:48px;margin-bottom:15px}
h1{margin:10px 0;color:#80aaff}
p{color:#b7c4dc;line-height:1.8}
.status{
 display:inline-block;
 padding:9px 18px;
 border-radius:30px;
 background:#123c2a;
 color:#65e6a0;
 margin:15px
}
button{
 border:0;
 padding:12px 22px;
 border-radius:10px;
 background:#477cff;
 color:white;
 font-size:15px;
 cursor:pointer
}
#result{
 margin-top:20px;
 color:#9fb8e8;
 word-break:break-word
}
</style>
</head>
<body>
<div class="card">
<div class="logo">⚡</div>
<h1>Server Mariam</h1>
<p>مرحباً بك في خادم التطبيقات الخاص بنا.</p>
<div class="status">● السيرفر يعمل</div>
<p>Node.js Native HTTP Server</p>
<button onclick="checkServer()">فحص السيرفر</button>
<div id="result"></div>
</div>
<script>
async function checkServer(){
 const result=document.getElementById('result');
 result.textContent='جارٍ فحص السيرفر...';
 try{
  const response=await fetch('/health');
  const data=await response.json();
  result.textContent=data.status==='ok'
   ? 'الاتصال ناجح ✓'
   : 'يوجد خطأ في السيرفر';
 }catch(error){
  result.textContent='تعذر الاتصال بالسيرفر';
 }
}
</script>
</body>
</html>`;

function sendJSON(res, statusCode, data) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store'
    });
    res.end(JSON.stringify(data, null, 2));
}

function sendHTML(res) {
    res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache'
    });
    res.end(html);
}

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        return res.end();
    }

    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    if (req.method === 'GET' && url.pathname === '/') {
        return sendHTML(res);
    }

    if (req.method === 'GET' && url.pathname === '/health') {
        return sendJSON(res, 200, {
            status: 'ok',
            service: 'server-mariam',
            uptime: Math.floor((Date.now() - startTime) / 1000),
            timestamp: new Date().toISOString()
        });
    }

    if (req.method === 'GET' && url.pathname === '/api/info') {
        return sendJSON(res, 200, {
            name: 'server-mariam',
            runtime: 'Node.js',
            version: process.version,
            database: 'disabled',
            externalDependencies: false
        });
    }

    if (req.method === 'GET' && url.pathname === '/api/db') {
        return sendJSON(res, 503, {
            status: 'disabled',
            message: 'Database functionality is disabled.'
        });
    }

    if (req.method === 'POST' && url.pathname === '/api/echo') {
        let body = '';
        let tooLarge = false;

        req.on('data', chunk => {
            body += chunk;

            if (body.length > 1024 * 1024) {
                tooLarge = true;
                res.writeHead(413);
                res.end('Request too large');
                req.destroy();
            }
        });

        req.on('end', () => {
            if (tooLarge) return;

            try {
                const data = body ? JSON.parse(body) : {};

                return sendJSON(res, 200, {
                    status: 'ok',
                    received: data
                });
            } catch {
                return sendJSON(res, 400, {
                    status: 'error',
                    message: 'Invalid JSON'
                });
            }
        });

        return;
    }

    sendJSON(res, 404, {
        status: 'error',
        message: 'Route not found'
    });
});

server.listen(PORT, HOST, () => {
    console.log('================================');
    console.log('SERVER MARIAM STARTED');
    console.log('Host:', HOST);
    console.log('Port:', PORT);
    console.log('Database: Disabled');
    console.log('External dependencies: None');
    console.log('================================');
});

server.on('error', error => {
    console.error('Server error:', error);
    process.exitCode = 1;
});
