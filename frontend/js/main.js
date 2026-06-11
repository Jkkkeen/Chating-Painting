/**
 * main.js — 应用入口（PR2：接入语音识别）
 *
 * 当前职责：
 *   1. 初始化画布（高 DPI 缩放、窗口自适应、空画布占位）。
 *   2. 通过启动遮罩获取一次用户手势后，开启 Web Speech API 持续监听。
 *   3. 把识别到的中间结果/最终结果实时显示到「听到」区域。
 *   4. 维护并显示顶部语音状态。
 *
 * 指令解析、语音状态机、绘图引擎将在后续 PR 接入；
 * 这里只负责「听到并显示」，验证语音链路打通。
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
      "空白画布 · 试着说点什么，识别结果会显示在下方",
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
        showHeard(text, true);
      },
      onFinal: function (text) {
        showHeard(text, false);
        // PR2 仅显示；指令解析在后续 PR 接入
      },
      onError: function (err) {
        showReply(friendlyError(err));
        if (err === "not-allowed" || err === "service-not-allowed") {
          setStatus("idle", "无权限");
        }
      },
      onStateChange: function (state) {
        if (state === "listening") {
          setStatus("listening", "监听中");
          showReply("正在监听，请说话。识别文本会实时显示在「听到」。");
        } else if (state === "stopped") {
          setStatus("idle", "已停止");
        }
      },
    });

    recognizer.start();
  }

  function handleStart() {
    startOverlay.classList.add("hidden");
    setStatus("listening", "启动中…");
    showReply("正在请求麦克风权限……");
    startListening();
  }

  // 启动遮罩：唯一一次用户手势，用于满足浏览器麦克风授权要求
  startOverlay.addEventListener("click", handleStart, { once: true });

  // 暴露给后续模块的接口
  window.App = { canvas, ctx, render, setStatus, showHeard, showReply };

  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();
  setStatus("idle", "未启动");

  console.info("[Chating-Painting] PR2：语音识别已就绪，点击页面以开启监听。");
})();
