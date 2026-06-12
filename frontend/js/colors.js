/**
 * colors.js — 中文颜色词典
 *
 * 把中文颜色说法映射到十六进制色值。作为参考数据独立成模块，
 * 供解析器（创建/改色）与后续的选择、纠错复用。
 *
 * 设计：同一颜色登记多个别名（红 / 红色 / 大红），匹配时按词长优先，
 * 避免「红」误命中「红色」之外的歧义。
 */
(function () {
  "use strict";

  // 内部色名 → 色值
  const HEX = {
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

  // 中文别名 → 内部色名
  const ALIASES = [
    { name: "red", words: ["红色", "大红", "红"] },
    { name: "orange", words: ["橙色", "橘色", "橙", "橘"] },
    { name: "yellow", words: ["黄色", "金黄", "黄"] },
    { name: "green", words: ["绿色", "草绿", "墨绿", "绿"] },
    { name: "cyan", words: ["青色", "青绿", "青"] },
    { name: "blue", words: ["蓝色", "天蓝", "深蓝", "蓝"] },
    { name: "purple", words: ["紫色", "紫"] },
    { name: "pink", words: ["粉红", "粉色", "粉"] },
    { name: "brown", words: ["棕色", "褐色", "咖啡色", "棕", "褐"] },
    { name: "black", words: ["黑色", "黑"] },
    { name: "white", words: ["白色", "白"] },
    { name: "gray", words: ["灰色", "灰"] },
  ];

  /**
   * 在文本中检测颜色，返回 { name, hex } 或 null。
   * 取最先出现、词更长优先的匹配。
   */
  function detect(text) {
    const t = text || "";
    let best = null;
    for (const entry of ALIASES) {
      for (const w of entry.words) {
        const idx = t.indexOf(w);
        if (idx >= 0) {
          if (
            !best ||
            idx < best.idx ||
            (idx === best.idx && w.length > best.len)
          ) {
            best = { name: entry.name, hex: HEX[entry.name], idx, len: w.length };
          }
        }
      }
    }
    return best ? { name: best.name, hex: best.hex } : null;
  }

  function hexOf(name) {
    return HEX[name] || null;
  }

  window.Colors = { detect, hexOf, HEX };
})();
