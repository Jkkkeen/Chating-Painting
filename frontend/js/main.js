/**
 * main.js — 应用入口（PR4：基本图形绘制）
 *
 * 当前职责：
 *   1. 初始化画布（高 DPI 缩放、窗口自适应），用绘图引擎渲染 store 中的图形。
 *   2. 启动遮罩获取一次用户手势后，开启 Web Speech API 持续监听。
 *   3. 识别文本经语音状态机裁决后，交给解析器 → 创建图形 → 重绘 → 语音反馈。
 *
 * 本 PR 支持创建带颜色的图形（画一个红色的圆）与属性修改
 * （改成蓝色 / 大一点 / 线条粗一点 / 填充 / 描边）。修改目标为选中或最近创建的图形。
 * 精确位置、完整指代解析、编辑等将在后续 PR 扩展。
 */
(function () {
  "use strict";

  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");
  const statusDot = document.getElementById("statusDot");
  const statusText = document.getElementById("statusText");
  const heardText = document.getElementById("heardText");
  const replyText = document.getElementById("replyText");
  const startOverlay = document.getElementById("startOverlay");

  // ---- 数据模型与绘图引擎 ----
  const store = window.Store.createStore();

  function canvasSize() {
    const rect = canvas.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  }

  // ---- 画布 ----
  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    render();
  }

  function render() {
    const bg = (window.APP_CONFIG && window.APP_CONFIG.canvasBackground) || "#ffffff";
    window.Drawing.renderAll(ctx, canvasSize(), store.all(), bg);
  }

  // ---- 状态与反馈显示 ----
  function setStatus(mode, text) {
    statusDot.className = "status-dot" + (mode === "idle" ? "" : " " + mode);
    statusText.textContent = text;
  }

  function showHeard(text, isInterim) {
    heardText.textContent = text || "—";
    heardText.className = "heard-text" + (isInterim ? " interim" : "");
  }

  function showReply(text) {
    replyText.textContent = text;
  }

  // ---- 语音状态机 ----
  // 状态 → 顶部指示灯与文案
  const STATE_LABEL = {
    idle: { dot: "idle", text: "未启动" },
    listening: { dot: "listening", text: "监听中" },
    paused: { dot: "paused", text: "已暂停" },
    speaking: { dot: "speaking", text: "播报中" },
  };

  const voiceMode = window.VoiceMode.create({
    // 经状态机调用 TTS 播报；onDone 在播报结束时回调，用于恢复识别
    speak: function (text, onDone) {
      showReply(text);
      if (window.TTS && window.TTS.isSupported()) {
        window.TTS.speak(text, { onEnd: onDone });
      } else if (onDone) {
        // 不支持 TTS 时，给一个短延迟模拟播报时长
        setTimeout(onDone, 300);
      }
    },
    onState: function (state) {
      const label = STATE_LABEL[state] || STATE_LABEL.idle;
      setStatus(label.dot, label.text);
    },
    onCommand: function (text) {
      executeCommand(text);
    },
    onUndoLast: function () {
      // 「撤销刚才」的实际撤销逻辑在后续 PR（撤销/重做）落地
    },
  });

  // ---- 指令执行：解析 → 改动 store → 重绘 → 反馈 ----

  const SHAPE_NAME = { circle: "圆", rect: "矩形", line: "直线", text: "文字" };
  const COLOR_NAME = {
    red: "红色", orange: "橙色", yellow: "黄色", green: "绿色",
    cyan: "青色", blue: "蓝色", purple: "紫色", pink: "粉色",
    brown: "棕色", black: "黑色", white: "白色", gray: "灰色",
  };

  /**
   * 为新图形计算默认几何。新图形以画布中心为基准，按已有数量做轻微错位，
   * 避免完全重叠。大小/精确位置将在后续 PR 由指令控制。
   */
  function defaultGeometry(type) {
    const size = canvasSize();
    const cx = size.width / 2;
    const cy = size.height / 2;
    const n = store.count();
    const offset = (n % 6) * 28; // 阶梯式错位
    const ox = cx + offset - 70;
    const oy = cy + offset - 70;

    switch (type) {
      case "circle":
        return { x: ox, y: oy, w: 120, h: 120 };
      case "rect":
        return { x: ox - 70, y: oy - 45, w: 140, h: 90 };
      case "line":
        return { x: ox - 80, y: oy, w: 160, h: 0 };
      case "text":
        return { x: ox - 40, y: oy };
      default:
        return { x: ox, y: oy, w: 100, h: 100 };
    }
  }

  /**
   * 选取要修改的目标图形：优先当前选中，否则取最近创建。
   * 完整指代解析（它/第二个/最右边）将在后续 PR 接入。
   */
  function targetShape() {
    const sel = store.getSelected();
    if (sel.length === 1) return sel[0];
    return store.last();
  }

  function describeChanges(changes) {
    const parts = [];
    if (changes.color) parts.push("颜色改为" + (COLOR_NAME[changes.colorName] || "新颜色"));
    if (changes.scale && changes.scale > 1) parts.push("放大");
    if (changes.scale && changes.scale < 1) parts.push("缩小");
    if (changes.lineWidthDelta > 0) parts.push("线条加粗");
    if (changes.lineWidthDelta < 0) parts.push("线条变细");
    if (changes.filled === true) parts.push("改为填充");
    if (changes.filled === false) parts.push("改为描边");
    return parts.join("，");
  }

  function executeCommand(text) {
    const cmd = window.Parser.parse(text);

    if (!cmd) {
      voiceMode.announce("没听清，可以说：画一个红色的圆，或者改成蓝色");
      return;
    }

    if (cmd.action === "create") {
      const geo = defaultGeometry(cmd.type);
      const extra = {};
      if (cmd.color) extra.color = cmd.color;
      if (cmd.type === "text") extra.text = cmd.text;
      const shape = store.add(Object.assign({ type: cmd.type }, geo, extra));
      render();
      const name = SHAPE_NAME[cmd.type] || "图形";
      const colorPrefix = cmd.colorName ? (COLOR_NAME[cmd.colorName] || "") : "";
      const desc =
        cmd.type === "text"
          ? "文字「" + shape.text + "」"
          : "一个" + colorPrefix + name;
      voiceMode.announce("好的，已画" + desc);
      return;
    }

    if (cmd.action === "modify") {
      const target = targetShape();
      if (!target) {
        voiceMode.announce("还没有图形可以修改，请先画一个");
        return;
      }
      store.applyChanges(target, cmd.changes);
      render();
      const summary = describeChanges(cmd.changes);
      voiceMode.announce(summary ? "已" + summary : "已修改");
      return;
    }

    voiceMode.announce("这个指令暂时还不支持");
  }

  // ---- 语音识别接入 ----
  let recognizer = null;

  function friendlyError(err) {
    switch (err) {
      case "not-supported":
        return "当前浏览器不支持语音识别，请改用 Chrome / Edge。";
      case "not-allowed":
      case "service-not-allowed":
        return "麦克风权限被拒绝，请在浏览器设置中允许后刷新页面。";
      case "no-speech":
        return "没有听到声音，继续监听中……";
      case "audio-capture":
        return "未检测到麦克风设备，请检查后刷新。";
      case "network":
        return "语音识别服务网络异常，正在重试……";
      default:
        return "语音识别出现问题（" + err + "），正在重试……";
    }
  }

  function startListening() {
    if (!window.Speech || !window.Speech.isSupported()) {
      setStatus("idle", "不支持");
      showReply(friendlyError("not-supported"));
      return;
    }

    recognizer = window.Speech.createRecognizer({
      lang: (window.APP_CONFIG && window.APP_CONFIG.speechLang) || "zh-CN",
      onInterim: function (text) {
        // 系统播报期间不显示中间结果，避免把 TTS 余音显示出来
        if (voiceMode.isSuppressed()) return;
        showHeard(text, true);
      },
      onFinal: function (text) {
        if (voiceMode.isSuppressed()) return;
        showHeard(text, false);
        voiceMode.handleFinal(text);
      },
      onError: function (err) {
        showReply(friendlyError(err));
        if (err === "not-allowed" || err === "service-not-allowed") {
          setStatus("idle", "无权限");
        }
      },
      onStateChange: function (state) {
        // 底层识别器的运行状态仅用于提示；显示状态以语音状态机为准
        if (state === "listening" && voiceMode.getState() === "idle") {
          showReply("已就绪。说「开始绘图」进入绘图模式。");
        }
      },
    });

    recognizer.start();
  }

  function handleStart() {
    startOverlay.classList.add("hidden");
    showReply("正在请求麦克风权限……");
    startListening();
  }

  // 启动遮罩：唯一一次用户手势，用于满足浏览器麦克风授权要求
  startOverlay.addEventListener("click", handleStart, { once: true });

  // 暴露给后续模块的接口
  window.App = {
    canvas,
    ctx,
    render,
    setStatus,
    showHeard,
    showReply,
    voiceMode,
    store,
  };

  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();
  setStatus("idle", "未启动");

  console.info("[Chating-Painting] PR5：颜色与属性已就绪。试试「画一个红色的圆」「改成蓝色」「大一点」。");
})();
