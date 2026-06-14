/**
 * voicemode.js — 语音模式状态机
 *
 * 解决纯语音应用的核心风险：把用户的讲解、犹豫、口误，或系统自己的 TTS 播报
 * 当成绘图命令。状态机统一裁决「当前这句话要不要执行」。
 *
 * 状态：
 *   IDLE       未启动，不接收任何命令（仅响应「开始绘图」）
 *   LISTENING  监听并执行绘图命令
 *   PAUSED     暂停执行（讲解/思考用），命令不生效（仅响应「继续绘图」）
 *   SPEAKING   瞬态：系统播报中，屏蔽识别输入以防自我触发，播完回到 LISTENING
 *
 * 模式控制指令（带容错变体）：
 *   开始绘图 / 暂停绘图 / 继续绘图 / 撤销刚才（撤销在后续 PR 落地，此处先识别并占位）
 */
(function () {
  "use strict";

  const STATES = {
    IDLE: "idle",
    LISTENING: "listening",
    PAUSED: "paused",
    SPEAKING: "speaking",
  };

  // 模式控制指令的匹配规则（去除空格后做包含/正则匹配，提升容错）
  const MODE_PATTERNS = [
    { intent: "start", re: /^(开始|启动)(绘图|画图|画画|画)?$|^开始$/ },
    { intent: "pause", re: /(暂停|停一下|停一停|先停|等一下|等等)(绘图|画图|一下)?/ },
    { intent: "resume", re: /(继续|恢复|接着)(绘图|画图|画|画画)?/ },
    { intent: "undoLast", re: /(撤销|撤回|取消)(刚才|刚刚|上一步|一下)/ },
  ];

  function normalize(text) {
    return (text || "").replace(/[\s，。、！!？?,.]/g, "");
  }

  function matchMode(text) {
    const t = normalize(text);
    for (const p of MODE_PATTERNS) {
      if (p.re.test(t)) return p.intent;
    }
    return null;
  }

  /**
   * 创建状态机。
   * @param {{
 *   speak: (text:string, onDone?:Function)=>void,   // 调用 TTS 播报
 *   onState: (state:string)=>void,                  // 状态变化通知（更新 UI）
 *   onCommand: (text:string)=>void,                 // 非模式指令，交给上层解析（后续 PR）
 *   onUndoLast?: ()=>boolean|void                    // 「撤销刚才」回调，返回 true 表示已自行反馈
   * }} deps
   */
  function create(deps) {
    let state = STATES.IDLE;
    // 系统播报期间为 true，期间丢弃一切识别输入（防自我触发）
    let inputSuppressed = false;
    // 播报结束后的尾延迟，避免回声/余音被当成新指令
    const TAIL_MS = 400;

    function setState(next) {
      state = next;
      deps.onState(state);
    }

    /**
     * 经状态机播报：进入 SPEAKING（屏蔽输入），播完加尾延迟后回到 prevState。
     */
    function announce(text, prevStateAfter) {
      const back = prevStateAfter || (state === STATES.IDLE ? STATES.IDLE : STATES.LISTENING);
      inputSuppressed = true;
      const prevVisible = state;
      // 仅在原本处于活动监听时，视觉上切到 SPEAKING
      if (prevVisible === STATES.LISTENING) setState(STATES.SPEAKING);

      deps.speak(text, function () {
        setTimeout(function () {
          inputSuppressed = false;
          setState(back);
        }, TAIL_MS);
      });
    }

    /** 接收一条最终识别结果 */
    function handleFinal(text) {
      // 系统播报期间，一律忽略（防自我触发）
      if (inputSuppressed) return;

      const intent = matchMode(text);

      // 「撤销刚才」任意活动状态下可用
      if (intent === "undoLast") {
        if (state === STATES.IDLE) return;
        const handled = deps.onUndoLast && deps.onUndoLast();
        if (!handled) announce("已撤销刚才的操作");
        return;
      }

      switch (state) {
        case STATES.IDLE:
          if (intent === "start") {
            setState(STATES.LISTENING);
            announce("已进入绘图模式，请下达指令", STATES.LISTENING);
          }
          // IDLE 下其它话语忽略
          return;

        case STATES.LISTENING:
          if (intent === "start") {
            announce("已经在绘图模式了");
          } else if (intent === "pause") {
            setState(STATES.PAUSED);
            announce("已暂停，说继续绘图可恢复", STATES.PAUSED);
          } else if (intent === "resume") {
            announce("正在绘图模式，无需恢复");
          } else {
            // 普通绘图指令，交给上层（后续 PR 接入解析器）
            deps.onCommand(text);
          }
          return;

        case STATES.PAUSED:
          if (intent === "resume") {
            setState(STATES.LISTENING);
            announce("已恢复绘图", STATES.LISTENING);
          } else if (intent === "pause") {
            announce("已经是暂停状态");
          } else if (intent === "start") {
            setState(STATES.LISTENING);
            announce("已进入绘图模式", STATES.LISTENING);
          }
          // PAUSED 下绘图指令一律忽略（防讲解误触发）
          return;

        default:
          // SPEAKING：理论上 inputSuppressed 已拦截
          return;
      }
    }

    return {
      STATES,
      handleFinal,
      getState: function () {
        return state;
      },
      // 允许上层在执行完命令后主动播报（如绘图结果反馈）
      announce,
      isSuppressed: function () {
        return inputSuppressed;
      },
    };
  }

  window.VoiceMode = { create, STATES, matchMode };
})();
