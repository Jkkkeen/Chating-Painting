/**
 * config.js — 全局配置
 *
 * 集中存放与语音、画布、增强模式相关的可调参数。
 * PR1 仅放置脚手架阶段需要的基础配置，后续 PR 会逐步扩充。
 */
window.APP_CONFIG = {
  // 语音识别语言（中文为主）
  speechLang: "zh-CN",

  // 增强模式（可选 Node 后端 LLM 兜底）。
  // 为空时应用运行在「核心模式」：纯前端 + 本地规则引擎，不依赖任何后端。
  backendUrl: "",

  // 画布默认背景色
  canvasBackground: "#ffffff",
};
