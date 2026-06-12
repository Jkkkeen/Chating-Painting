/**
 * parser.js — 指令解析器（规则引擎 · 快路径）
 *
 * 把一句中文识别文本解析成结构化命令对象。本 PR 只覆盖「创建基本图形」：
 *   画圆 / 画矩形 / 画线 / 写字
 * 颜色、大小、位置、编辑等将在后续 PR 逐步扩展本解析器。
 *
 * 返回命令对象：
 *   { action: 'create', type: 'circle'|'rect'|'line'|'text', text?: string }
 *   解析不出则返回 null（后续将交给澄清机制 / LLM 兜底）。
 */
(function () {
  "use strict";

  // 形状别名 → 内部类型
  const SHAPE_ALIASES = [
    { type: "circle", words: ["圆形", "圆圈", "圆", "圈"] },
    { type: "rect", words: ["矩形", "长方形", "方形", "方块", "方框", "正方形", "方"] },
    { type: "line", words: ["直线", "线条", "线段", "线"] },
  ];

  function normalize(text) {
    return (text || "").trim().replace(/[\s]/g, "");
  }

  /** 从文本中找出形状类型（取最先出现、词更长优先的匹配） */
  function detectShape(t) {
    let best = null;
    for (const entry of SHAPE_ALIASES) {
      for (const w of entry.words) {
        const idx = t.indexOf(w);
        if (idx >= 0) {
          if (!best || w.length > best.wordLen) {
            best = { type: entry.type, wordLen: w.length };
          }
        }
      }
    }
    return best ? best.type : null;
  }

  /** 提取「写字」「写下」「输入」后面的文字内容，支持引号 */
  function detectText(t) {
    // 带引号优先：写字「你好」/ 写"你好"
    const quoted = t.match(/["“”「」'']([^"“”「」'']+)["“”「」'']/);
    if (quoted) return quoted[1];
    // 「写字 你好」「写下你好」「输入你好」
    const m = t.match(/(?:写字|写下|写上|写个|写|输入|打字)(.+)/);
    if (m) {
      let s = m[1].trim();
      // 去掉常见多余词
      s = s.replace(/^[:：]/, "").trim();
      return s || null;
    }
    return null;
  }

  // 是否包含绘制动作词
  const DRAW_VERB = /(画|绘制|添加|加|来|放)/;
  const WRITE_VERB = /(写字|写下|写上|写个|写|输入|打字)/;

  function parse(text) {
    const t = normalize(text);
    if (!t) return null;

    // 1) 文字优先：含「写/输入」类动词
    if (WRITE_VERB.test(t)) {
      const content = detectText(t);
      if (content) {
        return { action: "create", type: "text", text: content };
      }
    }

    // 2) 创建图形：只要识别到形状名即接受。
    //    即使用户漏说「画」（如直接说「圆」「矩形」），也能容错创建。
    const shape = detectShape(t);
    if (shape) {
      return { action: "create", type: shape };
    }

    return null;
  }

  window.Parser = { parse, detectShape, detectText, DRAW_VERB };
})();
