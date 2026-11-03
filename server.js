const http = require("node:http");
const os = require("node:os");

const PORT = Number(process.env.PORT || 8080);
const HOST = "0.0.0.0";

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(JSON.stringify(data, null, 2));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Request body is too large (maximum 1 MB)."));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      });
      return res.end();
    }

    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

    if (req.method === "GET" && url.pathname === "/") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Server Mariam</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#101827;color:#e8eefc;font:16px system-ui;display:grid;place-items:center;min-height:100vh;padding:20px}
main{max-width:680px;width:100%;background:#1b2940;border:1px solid #34445f;border-radius:18px;padding:28px}
h1{margin-top:0}.ok{color:#5ee0a0;font-weight:700}.links a{color:#8fc5ff;margin-right:18px}
code{background:#101827;padding:3px 7px;border-radius:6px}
</style></head><body><main>
<h1>Server Mariam</h1><p class="ok">● Server is running</p>
<p>A lightweight Node.js test server deployed on Fly.io.</p>
<div class="links"><a href="/health">Health</a><a href="/api/info">API info</a></div>
<p>Try sending JSON to <code>POST /api/echo</code>.</p>
</main></body></html>`);
    }

    if (req.method === "GET" && url.pathname === "/health") {
      return sendJson(res, 200, {
        status: "ok",
        service: "server-mariam",
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString()
      });
    }

    if (req.method === "GET" && url.pathname === "/api/info") {
      return sendJson(res, 200, {
        name: "Server Mariam",
        runtime: `Node.js ${process.version}`,
        platform: process.platform,
        architecture: process.arch,
        hostname: os.hostname(),
        memory: {
          totalBytes: os.totalmem(),
          freeBytes: os.freemem()
        },
        uptimeSeconds: Math.floor(process.uptime())
      });
    }

    if (req.method === "POST" && url.pathname === "/api/echo") {
      const raw = await readBody(req);
      let payload;
      try {
        payload = raw ? JSON.parse(raw) : null;
      } catch {
        return sendJson(res, 400, { error: "Invalid JSON body." });
      }
      return sendJson(res, 200, {
        message: "Data received successfully.",
        received: payload,
        receivedAt: new Date().toISOString()
      });
    }

    return sendJson(res, 404, {
      error: "Not found",
      availableRoutes: ["GET /", "GET /health", "GET /api/info", "POST /api/echo"]
    });
  } catch (error) {
    console.error("Request error:", error);
    if (!res.headersSent) {
      sendJson(res, 500, { error: "Internal server error." });
    }
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Server Mariam listening on ${HOST}:${PORT}`);
});

process.on("SIGTERM", () => {
  console.log("SIGTERM received; shutting down.");
  server.close(() => process.exit(0));
});
