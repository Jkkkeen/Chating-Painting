/**
 * sequence.js — 复合指令本地切分
 *
 * 把「然后 / 接着 / 再」串联的自然语言拆成原子命令文本。
 * 只做文本切分，不理解具体动作，避免和 parser 的职责混在一起。
 */
(function () {
  "use strict";

  const STRONG_CONNECTORS = ["然后", "接着", "随后", "之后"];
  const ZAI_GUARD = /^(再来一个|再来一份|再复制)/;
  const NEXT_COMMAND_AFTER_ZAI =
    /^(画|绘制|添加|写|输入|选|选中|选择|把|将|删除|删掉|复制|移动|向|往|改成|变成|换成|放大|缩小|清空|撤销|重做)/;

  function normalize(text) {
    const corrected = window.Corrector
      ? window.Corrector.normalizeText(text)
      : text;
    return (corrected || "").trim().replace(/\s/g, "");
  }

  function pushPart(parts, value) {
    const s = value.replace(/^[，。；;、]+|[，。；;、]+$/g, "");
    if (s) parts.push(s);
  }

  function split(text) {
    const t = normalize(text);
    if (!t) return [];

    const parts = [];
    let buffer = "";
    let i = 0;

    while (i < t.length) {
      let matched = null;
      for (const c of STRONG_CONNECTORS) {
        if (t.slice(i, i + c.length) === c) {
          matched = c;
          break;
        }
      }

      if (matched) {
        pushPart(parts, buffer);
        buffer = "";
        i += matched.length;
        continue;
      }

      if (t[i] === "再" && !ZAI_GUARD.test(t.slice(i))) {
        const rest = t.slice(i + 1);
        if (buffer && NEXT_COMMAND_AFTER_ZAI.test(rest)) {
          pushPart(parts, buffer);
          buffer = "";
          i += 1;
          continue;
        }
      }

      buffer += t[i];
      i += 1;
    }

    pushPart(parts, buffer);
    return parts;
  }

  function hasCompound(text) {
    return split(text).length > 1;
  }

  window.Sequence = {
    split,
    hasCompound,
  };
})();
