/**
 * parser.js — 指令解析器（规则引擎 · 快路径）
 *
 * 把一句中文识别文本解析成结构化命令对象。本 PR 覆盖：
 *   - 创建基本图形：画圆 / 画矩形 / 画线 / 写字（可带颜色与方位，如「在左上角画一个红色的圆」）
 *   - 修改属性：改成蓝色 / 大一点 / 小一点 / 线条粗一点 / 细一点 / 填充 / 只描边
 *
 * 返回命令对象：
 *   创建: { action: 'create', type, color?: hex, position?: key, text?: string }
 *   选择: { action: 'select', ref: <指代描述符> }
 *   修改: { action: 'modify', changes: {...}, ref?: <指代描述符> }
 *   移动: { action: 'move', delta: {dx, dy}, ref?: <指代描述符> }
 *   删除: { action: 'delete', ref?: <指代描述符> }
 *   复制: { action: 'copy', ref?: <指代描述符> }
 *   确认: { action: 'confirm' } / 取消: { action: 'cancel' }
 *   清空: { action: 'clearCanvas', destructive: true }
 *   撤销/重做: { action: 'undo' } / { action: 'redo' }
 *   解析不出则返回 null。
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
  // 选择动作词
  const SELECT_VERB = /(选中|选择|选取|选定|选)/;
  const DELETE_VERB = /(删除|删掉|删去|删|移除|去掉|擦掉)/;
  const COPY_VERB = /(复制|拷贝|克隆|再来一个|再来一份|再复制|复制一份)/;
  const MOVE_VERB = /(移动|移到|挪动|挪|平移|向[上下左右]移|往[上下左右]移|上移|下移|左移|右移)/;
  const CONFIRM_REPLY = /^(确认|确定|是的|对|好|好的|可以)$/;
  const CANCEL_REPLY = /(取消|不用|不要|算了|停止|别|不确认)/;
  const CLEAR_CANVAS = /(清空|清除|清理|全部删除|全部删掉|删光|擦掉全部).*(画布|全部|所有|所有图形)|^(清空画布|清除画布)$/;
  const UNDO_CMD = /^(撤销|撤回|回退|后悔)(刚才|刚刚|上一步|一下)?$/;
  const REDO_CMD = /^(重做|恢复上一步|恢复刚才|再做一次|重来刚才)$/;

  /** 检测属性修改意图，返回 changes 对象或 null */
  function detectModify(t) {
    const changes = {};
    let matched = false;

    // 改色：改成/变成/换成 + 颜色，或单独出现颜色 + 「色」类修改语境由上层判断
    if (/(改成|变成|换成|改为|变为|涂成|填成)/.test(t)) {
      const color = window.Colors && window.Colors.detect(t);
      if (color) {
        changes.color = color.hex;
        changes.colorName = color.name;
        matched = true;
      }
    }

    // 大小：大一点/放大/变大；小一点/缩小/变小
    if (/(大一点|大一些|大点|放大|变大|更大|大大)/.test(t)) {
      changes.scale = 1.3;
      matched = true;
    } else if (/(小一点|小一些|小点|缩小|变小|更小)/.test(t)) {
      changes.scale = 1 / 1.3;
      matched = true;
    }

    // 线宽：粗一点/加粗；细一点/变细
    if (/(粗一点|粗一些|加粗|变粗|更粗|粗点)/.test(t)) {
      changes.lineWidthDelta = 2;
      matched = true;
    } else if (/(细一点|细一些|变细|更细|细点)/.test(t)) {
      changes.lineWidthDelta = -2;
      matched = true;
    }

    // 填充 / 描边
    if (/(填充|实心|涂满)/.test(t)) {
      changes.filled = true;
      matched = true;
    } else if (/(描边|只描边|空心|轮廓|不填充)/.test(t)) {
      changes.filled = false;
      matched = true;
    }

    return matched ? changes : null;
  }

  function detectMove(t) {
    if (!MOVE_VERB.test(t)) return null;

    const dir = detectDirection(t);
    if (!dir) return null;

    const step = detectMoveStep(t);
    return { dx: dir.dx * step, dy: dir.dy * step };
  }

  function detectDirection(t) {
    const directions = [
      { dx: 1, dy: 0, words: ["向右", "往右", "朝右", "右移", "右移动", "往右边"] },
      { dx: -1, dy: 0, words: ["向左", "往左", "朝左", "左移", "左移动", "往左边"] },
      { dx: 0, dy: -1, words: ["向上", "往上", "朝上", "上移", "上移动", "往上面"] },
      { dx: 0, dy: 1, words: ["向下", "往下", "朝下", "下移", "下移动", "往下面"] },
    ];

    for (const d of directions) {
      for (const w of d.words) {
        if (t.indexOf(w) >= 0) return { dx: d.dx, dy: d.dy };
      }
    }
    return null;
  }

  function detectMoveStep(t) {
    if (/(一点|一些|小一点|小步|稍微|轻轻|少一点)/.test(t)) return 20;
    if (/(远一点|多一点|大步|多移|移动多点|远些)/.test(t)) return 80;
    return 40;
  }

  function parse(text) {
    const t = normalize(text);
    if (!t) return null;

    if (CONFIRM_REPLY.test(t)) return { action: "confirm" };
    if (CANCEL_REPLY.test(t)) return { action: "cancel" };
    if (UNDO_CMD.test(t)) return { action: "undo" };
    if (REDO_CMD.test(t)) return { action: "redo" };

    if (CLEAR_CANVAS.test(t)) {
      return { action: "clearCanvas", destructive: true };
    }

    // 1) 文字优先：含「写/输入」类动词
    if (WRITE_VERB.test(t)) {
      const content = detectText(t);
      if (content) {
        return { action: "create", type: "text", text: content };
      }
    }

    const shape = detectShape(t);
    const hasDrawVerb = DRAW_VERB.test(t);

    // 2) 明确创建：有绘制动词 + 形状名 → 创建（可带颜色/方位）
    //    放在修改/选择之前，保证「画一条线」不被「线」误判。
    if (hasDrawVerb && shape) {
      return buildCreate(shape, t);
    }

    // 3) 编辑：移动 / 删除 / 复制，可带 PR7 的指代描述符。
    const moveDelta = detectMove(t);
    if (moveDelta) {
      const cmd = { action: "move", delta: moveDelta };
      const ref = window.Reference && window.Reference.parseRef(t);
      if (ref) cmd.ref = ref;
      return cmd;
    }

    if (DELETE_VERB.test(t)) {
      const cmd = { action: "delete" };
      const ref = window.Reference && window.Reference.parseRef(t);
      if (ref) cmd.ref = ref;
      return cmd;
    }

    if (COPY_VERB.test(t)) {
      const cmd = { action: "copy" };
      const ref = window.Reference && window.Reference.parseRef(t);
      if (ref) cmd.ref = ref;
      return cmd;
    }

    // 4) 选择：含「选中/选择/选」动词 → 解析指代描述符
    if (SELECT_VERB.test(t)) {
      const ref = window.Reference && window.Reference.parseRef(t);
      if (ref) return { action: "select", ref: ref };
    }

    // 5) 修改属性：可带指代（把红色的圆改成蓝色）。
    //    放在「无动词形状词」之前，保证「线条粗一点」判为改线宽而非画线。
    const changes = detectModify(t);
    if (changes) {
      const cmd = { action: "modify", changes: changes };
      const ref = window.Reference && window.Reference.parseRef(t);
      if (ref) cmd.ref = ref;
      return cmd;
    }

    // 6) 容错创建：没说「画」但只说了形状名（如「圆」「矩形」）
    if (shape) {
      return buildCreate(shape, t);
    }

    return null;
  }

  function buildCreate(shape, t) {
    const cmd = { action: "create", type: shape };
    const color = window.Colors && window.Colors.detect(t);
    if (color) {
      cmd.color = color.hex;
      cmd.colorName = color.name;
    }
    const pos = window.Position && window.Position.detect(t);
    if (pos) {
      cmd.position = pos;
    }
    return cmd;
  }

  window.Parser = {
    parse,
    detectShape,
    detectText,
    detectModify,
    detectMove,
    DRAW_VERB,
  };
})();
