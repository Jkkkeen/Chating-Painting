"use strict";

const fs = require("fs");
const http = require("http");
const path = require("path");
const { parseWithDeepSeek } = require("./llm");

const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.env.PORT || process.env.BACKEND_PORT || 8787);
const MAX_BODY = 20 * 1024;

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key && !Object.prototype.hasOwnProperty.call(process.env, key)) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(path.join(ROOT, ".env"));
loadEnvFile(path.join(__dirname, ".env"));

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > MAX_BODY) {
        reject(new Error("request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(new Error("invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

async function handleParse(req, res) {
  let payload;
  try {
    payload = await readJsonBody(req);
  } catch (err) {
    sendJson(res, 400, { ok: false, error: err.message });
    return;
  }

  const text = typeof payload.text === "string" ? payload.text.trim() : "";
  if (!text) {
    sendJson(res, 400, { ok: false, error: "text is required" });
    return;
  }

  if (!process.env.DEEPSEEK_API_KEY) {
    sendJson(res, 503, { ok: false, error: "DEEPSEEK_API_KEY is not configured" });
    return;
  }

  try {
    const command = await parseWithDeepSeek(text);
    sendJson(res, 200, { ok: true, command: command });
  } catch (err) {
    sendJson(res, 502, { ok: false, error: err.message });
  }
}

function handle(req, res) {
  if (req.method === "OPTIONS") {
    sendJson(res, 204, {});
    return;
  }

  const url = new URL(req.url, "http://localhost");
  if (req.method === "GET" && url.pathname === "/health") {
    sendJson(res, 200, {
      ok: true,
      llmConfigured: Boolean(process.env.DEEPSEEK_API_KEY),
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/parse") {
    handleParse(req, res);
    return;
  }

  sendJson(res, 404, { ok: false, error: "not found" });
}

function start(port) {
  const server = http.createServer(handle);
  server.listen(port, () => {
    console.log("[Chating-Painting] backend listening on http://localhost:" + port);
  });
  return server;
}

if (require.main === module) {
  start(PORT);
}

module.exports = {
  handle,
  loadEnvFile,
  readJsonBody,
  start,
};
