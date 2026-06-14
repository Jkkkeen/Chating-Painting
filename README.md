# Chating-Painting · 语音绘图工具

> 一款**纯语音控制**的绘图工具：用户全程不使用鼠标或键盘，仅通过语音指令完成绘图创作。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## 这是什么

Chating-Painting 让你用嘴画画。说「画一个红色的圆」「把它移到右边」「清空画布」，
「保存为图片」，应用就把语音变成画布上的图形并导出作品。设计上重点解决四个问题：指令理解的**准确性与容错**、
语音到绘图的**响应延迟**、**复杂指令的拆解执行**，以及纯语音交互的**健壮性**（防止讲解被误识别为命令）。

> 当前进度：项目以细粒度 PR 持续开发中，本版本（PR1）为可运行的应用脚手架。
> 完整指令能力请见 [`docs/设计文档.md`](docs/设计文档.md) 的实现状态表。

## 双模式

| 模式 | 依赖 | 说明 |
| --- | --- | --- |
| **核心模式**（默认） | 无，纯前端 | 直接打开 `frontend/index.html` 即可运行，本地规则引擎完成主要绘图能力 |
| **增强模式**（可选） | Node 后端 + 自备 LLM API key | 仅用于复杂自然语言指令的兜底，关闭后主功能不受影响 |

## 运行方式（核心模式）

1. 使用 **Chrome 或 Edge** 浏览器（见下方「浏览器要求」）。
2. 打开 `frontend/index.html`：
   - 直接双击即可；或
   - 用本地静态服务器以获得稳定的麦克风权限（推荐）：
     ```bash
     cd frontend
     # 任选其一
     python -m http.server 8000
     # 然后浏览器访问 http://localhost:8000
     ```

> 后续接入语音识别后，浏览器多要求在 `https` 或 `localhost` 环境下才允许使用麦克风，
> 故推荐用本地服务器方式打开。

## 运行方式（增强模式）

增强模式只在本地规则解析失败时调用 Node 后端，由后端使用 DeepSeek API 解析复杂自然语言。
真实 API key 不要写进代码，也不要提交到仓库。

1. 准备本地环境变量：
   ```bash
   copy backend\.env.example backend\.env
   ```
   然后在 `backend/.env` 中填写自己的 `DEEPSEEK_API_KEY`。

2. 启动后端：
   ```bash
   node backend/server.js
   ```

3. 本地联调时把 `frontend/js/config.js` 里的 `backendUrl` 临时设为：
   ```js
   backendUrl: "http://localhost:8787",
   ```

`.env` 与 `backend/.env` 已被 `.gitignore` 忽略，提交前请确认不要把真实 key 放入任何 tracked 文件。

## 浏览器要求

本应用依赖浏览器原生的 **Web Speech API**。该 API 的 `SpeechRecognition` 在 MDN 上标注为
*limited availability*，并非所有浏览器都稳定支持中文流式识别。

- ✅ **推荐：Chrome / Edge（桌面版）**
- ⚠️ 其他浏览器可能无法启用语音识别。

参考：MDN [SpeechRecognition](https://developer.mozilla.org/docs/Web/API/SpeechRecognition)、
[Web Speech API](https://developer.mozilla.org/docs/Web/API/Web_Speech_API)。

## 项目结构

```
Chating-Painting/
├── frontend/            # 核心模式：原生 HTML + JS + Canvas，零构建
│   ├── index.html
│   ├── css/style.css
│   └── js/{config,main}.js
├── backend/             # 增强模式：Node LLM 代理（可选启动）
├── docs/设计文档.md       # 计划支持 / 已实现 / 未完成原因
└── README.md
```

## 依赖声明

- **核心模式**：无任何第三方运行时依赖，仅使用浏览器原生能力
  （Web Speech API、Canvas）。所有指令解析、容错、绘图逻辑均为原创实现。
- **增强模式**：依赖 Node.js 18+ 运行时，使用内置 `fetch` 调用 DeepSeek OpenAI-compatible API，
  不引入第三方 SDK。API key 通过 `DEEPSEEK_API_KEY` 环境变量提供。

## Demo 视频

> 将在功能完善后补充（B 站 / 云盘链接）。

## 许可

[MIT](LICENSE)
