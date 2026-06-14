/**
 * corrector.js — 中文纠错与数字转换
 *
 * 对 ASR 常见同音/近音误识别做轻量归一，并把常见中文数字转为整数。
 * 规则引擎优先走本地纠错，保持低延迟。
 */
(function () {
  "use strict";

  const PHRASE_REPLACEMENTS = [
    ["园圈", "圆圈"],
    ["园形", "圆形"],
    ["原圈", "圆圈"],
    ["篮色", "蓝色"],
    ["兰色", "蓝色"],
    ["方快", "方块"],
    ["长方行", "长方形"],
    ["只线", "直线"],
  ];

  const SINGLE_REPLACEMENTS = [
    ["话", "画"],
    ["划", "画"],
    ["园", "圆"],
    ["篮", "蓝"],
    ["兰", "蓝"],
  ];

  const DIGIT = {
    零: 0,
    〇: 0,
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
  };

  function replaceAll(text, from, to) {
    return text.split(from).join(to);
  }

  function normalizeText(text) {
    let t = text || "";
    PHRASE_REPLACEMENTS.forEach(function (pair) {
      t = replaceAll(t, pair[0], pair[1]);
    });
    SINGLE_REPLACEMENTS.forEach(function (pair) {
      t = replaceAll(t, pair[0], pair[1]);
    });
    return t;
  }

  function chineseNumberToInt(input) {
    const s = String(input || "").replace(/\s/g, "");
    if (!s) return null;
    if (/^\d+$/.test(s)) return Number(s);
    if (Object.prototype.hasOwnProperty.call(DIGIT, s)) return DIGIT[s];

    const tenIndex = s.indexOf("十");
    if (tenIndex >= 0) {
      const left = s.slice(0, tenIndex);
      const right = s.slice(tenIndex + 1);
      const tens = left ? DIGIT[left] : 1;
      const ones = right ? DIGIT[right] : 0;
      if (typeof tens === "number" && typeof ones === "number") {
        return tens * 10 + ones;
      }
    }

    return null;
  }

  function detectCount(text) {
    const t = normalizeText(text).replace(/\s/g, "");
    const m = t.match(/([0-9]+|[一二两三四五六七八九十]{1,3})(?:个|只|条|块|份)?/);
    if (!m) return null;
    const n = chineseNumberToInt(m[1]);
    return n && n > 0 ? n : null;
  }

  function detectOrdinal(text) {
    const t = normalizeText(text).replace(/\s/g, "");
    const m = t.match(/第([0-9]+|[一二两三四五六七八九十]{1,3})(?:个|只|条|块|份)?/);
    if (!m) return null;
    const n = chineseNumberToInt(m[1]);
    return n && n > 0 ? n : null;
  }

  window.Corrector = {
    normalizeText,
    chineseNumberToInt,
    detectCount,
    detectOrdinal,
  };
})();
