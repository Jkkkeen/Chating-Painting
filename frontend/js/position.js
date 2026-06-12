/**
 * position.js — 方位词解析与区域定位
 *
 * 把中文方位说法解析成九宫格区域，并给出该区域在画布中的参考中心点，
 * 供创建图形时定位（如「在左上角画一个圆」「画在中间」）。
 *
 * 九宫格 key：
 *   topleft    top     topright
 *   left      center   right
 *   bottomleft bottom  bottomright
 *
 * 相对方位（「那个圆的右边」）属对象指代，由后续 PR 处理；此处只做画布绝对方位。
 */
(function () {
  "use strict";

  // 复合方位优先（左上 > 左），按词长降序匹配
  const PATTERNS = [
    { key: "topleft", words: ["左上角", "左上方", "左上"] },
    { key: "topright", words: ["右上角", "右上方", "右上"] },
    { key: "bottomleft", words: ["左下角", "左下方", "左下"] },
    { key: "bottomright", words: ["右下角", "右下方", "右下"] },
    { key: "top", words: ["顶部", "上方", "上面", "最上", "上边"] },
    { key: "bottom", words: ["底部", "下方", "下面", "最下", "下边"] },
    { key: "left", words: ["左边", "左侧", "最左", "左方"] },
    { key: "right", words: ["右边", "右侧", "最右", "右方"] },
    { key: "center", words: ["正中间", "正中央", "中间", "中央", "中心", "居中", "中部"] },
  ];

  /** 检测方位词，返回九宫格 key 或 null */
  function detect(text) {
    const t = text || "";
    let best = null;
    for (const p of PATTERNS) {
      for (const w of p.words) {
        const idx = t.indexOf(w);
        if (idx >= 0 && (!best || w.length > best.len)) {
          best = { key: p.key, len: w.length };
        }
      }
    }
    return best ? best.key : null;
  }

  /**
   * 返回某方位区域的参考中心点（CSS 像素）。
   * margin 让靠边区域留出边距，避免图形贴边或溢出。
   * @param {string} key 九宫格 key
   * @param {{width:number,height:number}} size
   * @param {number} [marginRatio] 边距占较短边的比例
   * @returns {{cx:number, cy:number}}
   */
  function regionCenter(key, size, marginRatio) {
    const m = (marginRatio || 0.18) * Math.min(size.width, size.height);
    const left = m;
    const right = size.width - m;
    const top = m;
    const bottom = size.height - m;
    const midX = size.width / 2;
    const midY = size.height / 2;

    const X = { left: left, center: midX, right: right };
    const Y = { top: top, center: midY, bottom: bottom };

    const map = {
      topleft: ["left", "top"],
      top: ["center", "top"],
      topright: ["right", "top"],
      left: ["left", "center"],
      center: ["center", "center"],
      right: ["right", "center"],
      bottomleft: ["left", "bottom"],
      bottom: ["center", "bottom"],
      bottomright: ["right", "bottom"],
    };
    const pair = map[key] || ["center", "center"];
    return { cx: X[pair[0]], cy: Y[pair[1]] };
  }

  // 方位 key → 中文名（用于语音反馈）
  const LABEL = {
    topleft: "左上角", top: "上方", topright: "右上角",
    left: "左边", center: "中间", right: "右边",
    bottomleft: "左下角", bottom: "下方", bottomright: "右下角",
  };

  window.Position = { detect, regionCenter, LABEL };
})();
