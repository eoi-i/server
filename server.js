
"use strict";

const http = require("http");
const os = require("os");
const { Pool } = require("pg");

const PORT = Number(process.env.PORT || 8080);
const DATABASE_URL = process.env.DATABASE_URL;

// إعداد اتصال PostgreSQL
const pool = DATABASE_URL
  ? new Pool({
      connectionString: DATABASE_URL,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
      max: 10
    })
  : null;

if (pool) {
  pool.on("error", (error) => {
    console.error("PostgreSQL pool error:", error.message);
  });
}

// إرسال JSON
function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  });

  res.end(JSON.stringify(data, null, 2));
}

// فحص اتصال قاعدة البيانات
async function checkDatabase() {
  if (!pool) {
    return {
      connected: false,
      status: "not_configured",
      message: "DATABASE_URL is not configured"
    };
  }

  try {
    const result = await pool.query(`
      SELECT
        NOW() AS server_time,
        current_database() AS database_name,
        version() AS postgres_version
    `);

    return {
      connected: true,
      status: "connected",
      database: result.rows[0].database_name,
      server_time: result.rows[0].server_time,
      version: result.rows[0].postgres_version
    };
  } catch (error) {
    return {
      connected: false,
      status: "disconnected",
      message: error.message
    };
  }
}

// قراءة جسم الطلب
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    let size = 0;
    const limit = 1024 * 1024;

    req.on("data", chunk => {
      size += chunk.length;

      if (size > limit) {
        reject(new Error("Request body too large"));
        req.destroy();
        return;
      }

      body += chunk.toString();
    });

    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

// صفحة الحالة الرئيسية
function htmlPage(db) {
  const color = db.connected ? "#16a34a" : "#dc2626";
  const label = db.connected ? "CONNECTED" : "DISCONNECTED";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Server Status</title>
<style>
body {
  margin: 0;
  padding: 30px;
  background: #101827;
  color: white;
  font-family: Arial, sans-serif;
}
.container {
  max-width: 650px;
  margin: 30px auto;
  background: #1e293b;
  padding: 25px;
  border-radius: 16px;
}
.status {
  color: ${color};
  font-weight: bold;
  font-size: 22px;
}
.item {
  padding: 13px;
  margin-top: 12px;
  background: #293548;
  border-radius: 8px;
  overflow-wrap: anywhere;
}
</style>
</head>
<body>
<div class="container">
  <h1>KrAR Server</h1>
  <p>Application: <strong>ONLINE</strong></p>
  <p>PostgreSQL:
    <span class="status">${label}</span>
  </p>
  <div class="item">
    <strong>Database:</strong>
    ${db.database || "Not available"}
  </div>
  <div class="item">
    <strong>Message:</strong>
    ${db.message || (db.connected ? "Connection successful" : "Connection unavailable")}
  </div>
  <div class="item">
    <strong>Server time:</strong>
    ${db.server_time || "Not available"}
  </div>
  <div class="item">
    <strong>Runtime:</strong> Node.js ${process.version}
  </div>
  <div class="item">
    <strong>Platform:</strong> ${os.platform()} / ${os.arch()}
  </div>
  <p>API: <code>/health</code></p>
  <p>Database: <code>/api/db</code></p>
</div>
</body>
</html>`;
}

// إنشاء السيرفر
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    });
    return res.end();
  }

  try {
    // الصفحة الرئيسية
    if (req.method === "GET" && url.pathname === "/") {
      const db = await checkDatabase();

      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8"
      });

      return res.end(htmlPage(db));
    }

    // فحص صحة السيرفر وقاعدة البيانات
    if (req.method === "GET" && url.pathname === "/health") {
      const db = await checkDatabase();

      return sendJSON(res, db.connected ? 200 : 503, {
        status: "ok",
        service: "server-mariam",
        application: "online",
        database: db,
        uptime_seconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString()
      });
    }

    // معلومات اتصال قاعدة البيانات
    if (req.method === "GET" && url.pathname === "/api/db") {
      const db = await checkDatabase();

      return sendJSON(res, db.connected ? 200 : 503, db);
    }

    // معلومات النظام
    if (req.method === "GET" && url.pathname === "/api/info") {
      return sendJSON(res, 200, {
        application: "server-mariam",
        node: process.version,
        platform: os.platform(),
        architecture: os.arch(),
        hostname: os.hostname(),
        memory: {
          total: os.totalmem(),
          free: os.freemem()
        },
        uptime: process.uptime()
      });
    }

    // اختبار استقبال وإعادة JSON
    if (req.method === "POST" && url.pathname === "/api/echo") {
      const body = await readBody(req);

      let data;

      try {
        data = JSON.parse(body);
      } catch {
        return sendJSON(res, 400, {
          error: "Invalid JSON"
        });
      }

      return sendJSON(res, 200, {
        success: true,
        received: data,
        timestamp: new Date().toISOString()
      });
    }

    // مسار غير موجود
    return sendJSON(res, 404, {
      error: "Not Found",
      path: url.pathname
    });

  } catch (error) {
    console.error("Request error:", error.message);

    if (!res.headersSent) {
      return sendJSON(res, 500, {
        error: "Internal Server Error"
      });
    }
  }
});

// تشغيل السيرفر
server.listen(PORT, "0.0.0.0", () => {
  console.log("================================");
  console.log("       KrAR SERVER STARTED");
  console.log("================================");
  console.log("Port:", PORT);
  console.log("Node:", process.version);
  console.log("Database URL:", DATABASE_URL ? "CONFIGURED" : "MISSING");
});

// إغلاق الاتصالات بشكل آمن
async function shutdown() {
  console.log("Shutting down server...");

  server.close(async () => {
    if (pool) {
      await pool.end();
    }

    process.exit(0);
  });

  setTimeout(() => process.exit(1), 10000).unref();
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
