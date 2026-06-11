/**
 * main.js — 应用入口（PR1 脚手架版）
 *
 * 当前职责：
 *   1. 初始化画布，处理高 DPI 缩放与窗口尺寸自适应。
 *   2. 渲染空画布的占位提示。
 *   3. 暴露最小的状态显示接口，供后续 PR（语音状态机、绘图引擎）复用。
 *
 * 语音识别、指令解析、绘图引擎将在后续 PR 中接入，
 * 此处刻意保持轻量，只搭好可运行的骨架。
 */
(function () {
  "use strict";

  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");
  const statusDot = document.getElementById("statusDot");
  const statusText = document.getElementById("statusText");

  /**
   * 适配高 DPI 屏幕：按设备像素比放大画布缓冲区，
   * 避免线条与文字模糊。
   */
  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    render();
  }

  /**
   * 渲染画布内容。PR1 阶段画布为空，仅显示居中占位提示。
   */
  function render() {
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);

    ctx.fillStyle = "#c8ccd4";
    ctx.font = "16px 'PingFang SC', 'Microsoft YaHei', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      "空白画布 · 语音控制功能将在后续版本接入",
      rect.width / 2,
      rect.height / 2
    );
  }

  /**
   * 更新顶部状态指示。后续语音状态机会调用此接口。
   * @param {"idle"|"listening"|"paused"|"speaking"} mode
   * @param {string} text
   */
  function setStatus(mode, text) {
    statusDot.className = "status-dot" + (mode === "idle" ? "" : " " + mode);
    statusText.textContent = text;
  }

  // 暴露给后续模块的最小接口
  window.App = { canvas, ctx, render, setStatus };

  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();
  setStatus("idle", "未启动");

  console.info("[Chating-Painting] 脚手架已加载（PR1）。语音功能将在后续 PR 接入。");
})();
