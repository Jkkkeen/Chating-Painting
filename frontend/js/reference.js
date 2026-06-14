/**
 * reference.js — 对象指代解析
 *
 * 复杂指令的真正难点：「它 / 那个 / 第二个圆 / 最右边的方块 / 红色的圆」指代谁。
 * 本模块做两件事：
 *   1. parseRef(text)  从文本中抽取指代描述符（descriptor）
 *   2. resolve(desc, store, ctx)  在 store 中按描述符定位目标图形
 *
 * 指代描述符字段（均可选）：
 *   { pronoun, type, color, ordinal, spatial }
 *     pronoun  true 表示「它/那个/这个」等代词
 *     type     形状类型过滤（circle/rect/line/text）
 *     color    颜色名过滤（red/blue...）
 *     ordinal  序数（1 起），在过滤后的候选里按创建顺序取第 N 个
 *     spatial  空间极值：leftmost/rightmost/topmost/bottommost
 *
 * resolve 返回：{ shapes: Shape[], reason: 'pronoun'|'ordinal'|'spatial'|'filter'|'all'|'none' }
 *   - shapes.length === 1 → 命中唯一目标
 *   - shapes.length > 1   → 存在歧义（交由上层澄清，PR9）
 *   - shapes.length === 0 → 未找到
 */
(function () {
  "use strict";

  const PRONOUN = /(它|他|她|那个|这个|那一个|这一个|刚才那个|刚画的|刚才的)/;

  // 中文序数（PR11 会接入更完整的中文数字转换，这里先覆盖常用）
  const ORDINAL_WORDS = [
    { n: 1, words: ["第一个", "第一", "第1个", "第1"] },
    { n: 2, words: ["第二个", "第二", "第2个", "第2", "第两个"] },
    { n: 3, words: ["第三个", "第三", "第3个", "第3"] },
    { n: 4, words: ["第四个", "第四", "第4个", "第4"] },
    { n: 5, words: ["第五个", "第五", "第5个", "第5"] },
    { n: 6, words: ["第六个", "第六", "第6个", "第6"] },
  ];

  const SPATIAL = [
    { key: "leftmost", words: ["最左边", "最左侧", "最左", "左边那个", "左边的"] },
    { key: "rightmost", words: ["最右边", "最右侧", "最右", "右边那个", "右边的"] },
    { key: "topmost", words: ["最上面", "最上边", "最上", "上面那个", "上边那个", "上面的"] },
    { key: "bottommost", words: ["最下面", "最下边", "最下", "下面那个", "下边那个", "下面的"] },
  ];

  function detectOrdinal(t) {
    if (window.Corrector) {
      const n = window.Corrector.detectOrdinal(t);
      if (n) return n;
    }
    for (const o of ORDINAL_WORDS) {
      for (const w of o.words) if (t.indexOf(w) >= 0) return o.n;
    }
    return null;
  }

  function detectSpatial(t) {
    let best = null;
    for (const s of SPATIAL) {
      for (const w of s.words) {
        const idx = t.indexOf(w);
        if (idx >= 0 && (!best || w.length > best.len)) {
          best = { key: s.key, len: w.length };
        }
      }
    }
    return best ? best.key : null;
  }

  /** 从文本抽取指代描述符；若没有任何指代线索返回 null */
  function parseRef(text) {
    const corrected = window.Corrector
      ? window.Corrector.normalizeText(text)
      : text;
    const t = (corrected || "").replace(/\s/g, "");
    const desc = {};

    if (PRONOUN.test(t)) desc.pronoun = true;

    const shape = window.Parser && window.Parser.detectShape(t);
    if (shape) desc.type = shape;

    const color = window.Colors && window.Colors.detect(t);
    if (color) desc.color = color.name;

    const ord = detectOrdinal(t);
    if (ord) desc.ordinal = ord;

    const sp = detectSpatial(t);
    if (sp) desc.spatial = sp;

    const hasAny =
      desc.pronoun || desc.type || desc.color || desc.ordinal || desc.spatial;
    return hasAny ? desc : null;
  }

  /** 中心点坐标，用于空间极值比较 */
  function centerOf(s) {
    switch (s.type) {
      case "circle":
        return { x: s.x, y: s.y };
      case "rect":
        return { x: s.x + s.w / 2, y: s.y + s.h / 2 };
      case "line":
        return { x: s.x + s.w / 2, y: s.y + s.h / 2 };
      default:
        return { x: s.x, y: s.y };
    }
  }

  function pickSpatial(list, key) {
    const withC = list.map((s) => ({ s: s, c: centerOf(s) }));
    let best = withC[0];
    for (const item of withC) {
      if (key === "leftmost" && item.c.x < best.c.x) best = item;
      if (key === "rightmost" && item.c.x > best.c.x) best = item;
      if (key === "topmost" && item.c.y < best.c.y) best = item;
      if (key === "bottommost" && item.c.y > best.c.y) best = item;
    }
    return best.s;
  }

  /**
   * 在 store 中定位描述符对应的图形。
   * @param {object} desc parseRef 的结果
   * @param {object} store
   */
  function resolve(desc, store) {
    if (!desc) return { shapes: [], reason: "none" };

    const all = store.all();

    // 1) 纯代词且无其它限定 → 选中优先，否则最近创建
    const onlyPronoun =
      desc.pronoun && !desc.type && !desc.color && !desc.ordinal && !desc.spatial;
    if (onlyPronoun) {
      const sel = store.getSelected();
      if (sel.length === 1) return { shapes: [sel[0]], reason: "pronoun" };
      const last = store.last();
      return { shapes: last ? [last] : [], reason: last ? "pronoun" : "none" };
    }

    // 2) 按 type / color 过滤候选
    let candidates = all;
    if (desc.type) candidates = candidates.filter((s) => s.type === desc.type);
    if (desc.color) {
      const hex = window.Colors && window.Colors.hexOf(desc.color);
      candidates = candidates.filter((s) => s.color === hex);
    }

    if (candidates.length === 0) return { shapes: [], reason: "none" };

    // 3) 序数：按创建顺序取第 N 个
    if (desc.ordinal) {
      const sorted = candidates
        .slice()
        .sort((a, b) => a.createdOrder - b.createdOrder);
      const picked = sorted[desc.ordinal - 1];
      return { shapes: picked ? [picked] : [], reason: "ordinal" };
    }

    // 4) 空间极值
    if (desc.spatial) {
      return { shapes: [pickSpatial(candidates, desc.spatial)], reason: "spatial" };
    }

    // 5) 纯过滤：唯一则命中，多个则歧义
    return { shapes: candidates, reason: "filter" };
  }

  window.Reference = { parseRef, resolve };
})();
