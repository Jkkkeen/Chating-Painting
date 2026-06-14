/**
 * llm_fallback.js — 增强模式 LLM 兜底客户端
 *
 * 默认禁用。只有 APP_CONFIG.backendUrl 配置后，才会在本地规则解析失败时
 * 请求 Node 后端，由后端持有 API key 并调用 LLM。
 */
(function () {
  "use strict";

  function backendUrl() {
    const cfg = window.APP_CONFIG || {};
    const value = (cfg.backendUrl || "").trim();
    return value.replace(/\/+$/, "");
  }

  function isEnabled() {
    return Boolean(backendUrl());
  }

  async function parse(text) {
    const base = backendUrl();
    if (!base) return null;

    try {
      const response = await fetch(base + "/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text }),
      });
      if (!response.ok) return null;
      const payload = await response.json();
      return payload && payload.ok && payload.command ? payload.command : null;
    } catch (err) {
      console.warn("[Chating-Painting] LLM fallback failed:", err.message || err);
      return null;
    }
  }

  window.LLMFallback = {
    isEnabled,
    parse,
  };
})();
