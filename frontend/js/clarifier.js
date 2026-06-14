/**
 * clarifier.js — 确认与澄清状态
 *
 * 保存一次待确认/待澄清上下文，把用户后续的「确认 / 取消 / 第几个」
 * 转成可执行结果。具体动作仍由 main.js 执行，避免本模块耦合 store。
 */
(function () {
  "use strict";

  const ORDINAL_REPLY = [
    { n: 1, words: ["第一个", "第一", "一", "1", "第1个", "第1"] },
    { n: 2, words: ["第二个", "第二", "二", "两", "2", "第2个", "第2"] },
    { n: 3, words: ["第三个", "第三", "三", "3", "第3个", "第3"] },
    { n: 4, words: ["第四个", "第四", "四", "4", "第4个", "第4"] },
    { n: 5, words: ["第五个", "第五", "五", "5", "第5个", "第5"] },
    { n: 6, words: ["第六个", "第六", "六", "6", "第6个", "第6"] },
  ];

  function normalize(text) {
    return (text || "").replace(/\s/g, "");
  }

  function parseOrdinalReply(text) {
    const t = normalize(text);
    for (const entry of ORDINAL_REPLY) {
      for (const w of entry.words) {
        if (t === w || t.indexOf(w) >= 0) return entry.n;
      }
    }
    return null;
  }

  function replyAction(text) {
    const cmd = window.Parser && window.Parser.parse(text);
    return cmd ? cmd.action : null;
  }

  function ordinalLabel(n) {
    return ["", "第一个", "第二个", "第三个", "第四个", "第五个", "第六个"][n] || ("第" + n + "个");
  }

  function create(options) {
    const opts = options || {};
    const describeCandidate =
      opts.describeCandidate ||
      function (_shape, index) {
        return "候选" + (index + 1);
      };
    let pending = null;

    function hasPending() {
      return !!pending;
    }

    function clear() {
      pending = null;
    }

    function askAmbiguous(command, candidates) {
      pending = {
        type: "ambiguous",
        command: command,
        candidates: candidates.slice(),
      };
      const parts = pending.candidates.map(function (shape, index) {
        return ordinalLabel(index + 1) + "是" + describeCandidate(shape, index);
      });
      return "找到" + pending.candidates.length + "个候选：" + parts.join("，") + "。请说第几个，或说取消。";
    }

    function askConfirm(command, message) {
      pending = { type: "confirm", command: command };
      return message;
    }

    function handle(text) {
      if (!pending) return { type: "none" };

      const action = replyAction(text);
      if (action === "cancel") {
        clear();
        return { type: "cancelled", message: "已取消" };
      }

      if (pending.type === "confirm") {
        if (action === "confirm") {
          const command = pending.command;
          clear();
          return { type: "confirmed", command: command };
        }
        return { type: "waiting", message: "请说确认或取消。" };
      }

      if (pending.type === "ambiguous") {
        const n = parseOrdinalReply(text);
        if (n && n >= 1 && n <= pending.candidates.length) {
          const command = pending.command;
          const shape = pending.candidates[n - 1];
          clear();
          return { type: "resolved", command: command, shape: shape };
        }
        return { type: "waiting", message: "请说第几个，或说取消。" };
      }

      clear();
      return { type: "none" };
    }

    return {
      hasPending,
      askAmbiguous,
      askConfirm,
      handle,
    };
  }

  window.Clarifier = {
    create,
    parseOrdinalReply,
  };
})();
