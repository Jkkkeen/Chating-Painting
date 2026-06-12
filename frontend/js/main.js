/**
 * main.js — 应用入口（PR3：语音模式状态机）
 *
 * 当前职责：
 *   1. 初始化画布（高 DPI 缩放、窗口自适应、空画布占位）。
 *   2. 启动遮罩获取一次用户手势后，开启 Web Speech API 持续监听。
 *   3. 把识别文本接入语音状态机（开始/暂停/继续），由状态机裁决是否执行。
 *   4. 状态机通过 TTS 播报反馈，播报期间屏蔽识别输入（防自我触发）。
 *
 * 指令解析与绘图引擎将在后续 PR 接入；普通绘图指令此处先做占位反馈。
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
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.fillStyle = "#c8ccd4";
    ctx.font = "16px 'PingFang SC', 'Microsoft YaHei', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      "空白画布 · 说「开始绘图」进入绘图模式",
      rect.width / 2,
      rect.height / 2
    );
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
      // PR3 阶段：普通绘图指令暂未接入解析器，先做占位反馈。
      // 指令解析与绘图将在后续 PR 实现。
      voiceMode.announce("收到指令：" + text + "，绘图功能即将上线");
    },
    onUndoLast: function () {
      // 「撤销刚才」的实际撤销逻辑在后续 PR（撤销/重做）落地
    },
  });

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
  window.App = { canvas, ctx, render, setStatus, showHeard, showReply, voiceMode };

  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();
  setStatus("idle", "未启动");

  console.info("[Chating-Painting] PR3：语音状态机已就绪。点击页面后说「开始绘图」。");
})();
