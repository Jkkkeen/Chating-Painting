"use strict";

const DEFAULT_BASE_URL = "https://api.deepseek.com";
const DEFAULT_MODEL = "deepseek-v4-flash";

const COLOR_HEX = {
  red: "#e23b3b",
  orange: "#f08a24",
  yellow: "#f4c020",
  green: "#2faf4e",
  cyan: "#19b3b3",
  blue: "#2f6fe2",
  purple: "#8e44ad",
  pink: "#ff7eb6",
  brown: "#8b5a2b",
  black: "#222222",
  white: "#ffffff",
  gray: "#888888",
};

const SHAPES = new Set(["circle", "rect", "line", "text"]);
const POSITIONS = new Set([
  "topleft",
  "top",
  "topright",
  "left",
  "center",
  "right",
  "bottomleft",
  "bottom",
  "bottomright",
]);
const SPATIAL = new Set(["leftmost", "rightmost", "topmost", "bottommost"]);

function cleanText(value, limit) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text) return null;
  return text.slice(0, limit || 120);
}

function isHex(value) {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeRef(ref) {
  if (!ref || typeof ref !== "object" || Array.isArray(ref)) return null;
  const out = {};
  if (ref.pronoun === true) out.pronoun = true;
  if (SHAPES.has(ref.type)) out.type = ref.type;
  if (Object.prototype.hasOwnProperty.call(COLOR_HEX, ref.color)) out.color = ref.color;
  if (Number.isInteger(ref.ordinal) && ref.ordinal >= 1 && ref.ordinal <= 20) {
    out.ordinal = ref.ordinal;
  }
  if (SPATIAL.has(ref.spatial)) out.spatial = ref.spatial;
  return Object.keys(out).length ? out : null;
}

function normalizeChanges(changes) {
  if (!changes || typeof changes !== "object" || Array.isArray(changes)) return null;
  const out = {};

  if (Object.prototype.hasOwnProperty.call(COLOR_HEX, changes.colorName)) {
    out.colorName = changes.colorName;
    out.color = COLOR_HEX[changes.colorName];
  } else if (isHex(changes.color)) {
    out.color = changes.color.toLowerCase();
  }

  if (finiteNumber(changes.scale) && changes.scale > 0) {
    out.scale = clamp(changes.scale, 0.2, 5);
  }

  if (finiteNumber(changes.lineWidthDelta)) {
    out.lineWidthDelta = clamp(Math.round(changes.lineWidthDelta), -20, 20);
  }

  if (typeof changes.filled === "boolean") out.filled = changes.filled;

  return Object.keys(out).length ? out : null;
}

function normalizeCommand(input, depth) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;

  const action = input.action;
  if (action === "sequence") {
    if ((depth || 0) > 0 || !Array.isArray(input.commands)) return null;
    const commands = input.commands
      .slice(0, 8)
      .map((item) => normalizeCommand(item, (depth || 0) + 1))
      .filter(Boolean);
    return commands.length ? { action: "sequence", commands: commands } : null;
  }

  if (action === "create") {
    if (!SHAPES.has(input.type)) return null;
    const out = { action: "create", type: input.type };
    if (Object.prototype.hasOwnProperty.call(COLOR_HEX, input.colorName)) {
      out.colorName = input.colorName;
      out.color = COLOR_HEX[input.colorName];
    } else if (isHex(input.color)) {
      out.color = input.color.toLowerCase();
    }
    if (POSITIONS.has(input.position)) out.position = input.position;
    if (input.type === "text") {
      const text = cleanText(input.text, 80);
      if (!text) return null;
      out.text = text;
    }
    if (Number.isInteger(input.count) && input.count > 1) {
      out.count = clamp(input.count, 1, 10);
    }
    return out;
  }

  if (action === "select") {
    const ref = normalizeRef(input.ref);
    return ref ? { action: "select", ref: ref } : null;
  }

  if (action === "modify") {
    const changes = normalizeChanges(input.changes);
    if (!changes) return null;
    const out = { action: "modify", changes: changes };
    const ref = normalizeRef(input.ref);
    if (ref) out.ref = ref;
    return out;
  }

  if (action === "move") {
    const delta = input.delta;
    if (!delta || !finiteNumber(delta.dx) || !finiteNumber(delta.dy)) return null;
    const out = {
      action: "move",
      delta: {
        dx: clamp(Math.round(delta.dx), -300, 300),
        dy: clamp(Math.round(delta.dy), -300, 300),
      },
    };
    const ref = normalizeRef(input.ref);
    if (ref) out.ref = ref;
    return out;
  }

  if (action === "delete" || action === "copy") {
    const out = { action: action };
    const ref = normalizeRef(input.ref);
    if (ref) out.ref = ref;
    return out;
  }

  if (action === "clearCanvas") return { action: "clearCanvas", destructive: true };
  if (action === "exportImage") return { action: "exportImage" };
  if (action === "undo") return { action: "undo" };
  if (action === "redo") return { action: "redo" };
  if (action === "confirm") return { action: "confirm" };
  if (action === "cancel") return { action: "cancel" };

  return null;
}

function buildChatRequest(text, options) {
  const model = (options && options.model) || DEFAULT_MODEL;
  const system = [
    "你是 Chating-Painting 的中文语音绘图指令解析器。",
    "只输出一个 json 对象，不要输出 markdown 或解释。",
    "允许的 action：create, select, modify, move, delete, copy, clearCanvas, exportImage, undo, redo, confirm, cancel, sequence。",
    "形状 type 只能是 circle, rect, line, text。",
    "颜色 colorName 只能是 red, orange, yellow, green, cyan, blue, purple, pink, brown, black, white, gray。",
    "位置 position 只能是 topleft, top, topright, left, center, right, bottomleft, bottom, bottomright。",
    "移动使用 delta: { dx, dy }，向右为正 dx，向下为正 dy，小幅移动用 20，普通移动用 40，大幅移动用 80。",
    "指代 ref 可包含 pronoun, type, color, ordinal, spatial。spatial 只能是 leftmost, rightmost, topmost, bottommost。",
    "复合指令返回 {\"action\":\"sequence\",\"commands\":[...]}。",
    "保存、导出、下载当前画布图片时返回 {\"action\":\"exportImage\"}。",
    "示例 json：{\"action\":\"create\",\"type\":\"rect\",\"colorName\":\"blue\",\"position\":\"left\"}",
  ].join("\n");

  return {
    model: model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: "请解析这句中文绘图指令：" + cleanText(text, 500) },
    ],
    response_format: { type: "json_object" },
    stream: false,
    temperature: 0,
    max_tokens: 500,
  };
}

function parseModelContent(content) {
  if (typeof content !== "string" || !content.trim()) return null;
  try {
    return normalizeCommand(JSON.parse(content));
  } catch (err) {
    return null;
  }
}

async function parseWithDeepSeek(text, options) {
  const opts = options || {};
  const apiKey = opts.apiKey || process.env.DEEPSEEK_API_KEY;
  const fetchImpl = opts.fetchImpl || global.fetch;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY is required");
  if (typeof fetchImpl !== "function") throw new Error("fetch is required");

  const baseUrl = (opts.baseUrl || process.env.DEEPSEEK_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const body = buildChatRequest(text, {
    model: opts.model || process.env.DEEPSEEK_MODEL || DEFAULT_MODEL,
  });

  const response = await fetchImpl(baseUrl + "/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!response || !response.ok) {
    const status = response && response.status ? response.status : "unknown";
    throw new Error("DeepSeek request failed: " + status);
  }

  const data = await response.json();
  const content =
    data &&
    data.choices &&
    data.choices[0] &&
    data.choices[0].message &&
    data.choices[0].message.content;
  const command = parseModelContent(content);
  if (!command) throw new Error("DeepSeek returned unsupported command JSON");
  return command;
}

module.exports = {
  DEFAULT_BASE_URL,
  DEFAULT_MODEL,
  buildChatRequest,
  normalizeCommand,
  parseModelContent,
  parseWithDeepSeek,
};
