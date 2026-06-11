/**
 * speech.js — Web Speech API（SpeechRecognition）封装
 *
 * 职责：把浏览器原生的语音识别封装成一个稳定、可复用的模块，
 * 屏蔽各浏览器前缀差异与「识别会自动结束」的坑，向上层提供：
 *   - start() / stop()
 *   - 回调：onInterim（中间结果）、onFinal（最终结果）、onError、onStateChange
 *
 * 设计要点：
 *   1. continuous + interimResults：持续监听并实时回传中间文本，体感「边说边出字」。
 *   2. 自动重启：SpeechRecognition 在静默或一段时间后会触发 onend，
 *      若仍处于「希望监听」状态则自动重新 start()，实现长时间持续监听。
 *   3. 不在此处做状态机/命令解析，保持单一职责，供后续 PR 复用。
 */
(function () {
  "use strict";

  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  /** 浏览器是否支持语音识别 */
  function isSupported() {
    return Boolean(SpeechRecognition);
  }

  function createRecognizer(options) {
    options = options || {};
    const lang = options.lang || "zh-CN";

    // 回调（由上层注入）
    const handlers = {
      onInterim: options.onInterim || function () {},
      onFinal: options.onFinal || function () {},
      onError: options.onError || function () {},
      onStateChange: options.onStateChange || function () {},
    };

    let recognition = null;
    // wantListening：上层的意图（是否希望持续监听），用于决定 onend 后是否自动重启
    let wantListening = false;
    // running：底层 recognition 当前是否真的在跑，避免重复 start 抛错
    let running = false;

    function build() {
      const rec = new SpeechRecognition();
      rec.lang = lang;
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;

      rec.onstart = function () {
        running = true;
        handlers.onStateChange("listening");
      };

      rec.onresult = function (event) {
        let interim = "";
        let final = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const transcript = result[0].transcript;
          if (result.isFinal) {
            final += transcript;
          } else {
            interim += transcript;
          }
        }
        if (interim) handlers.onInterim(interim);
        if (final) handlers.onFinal(final.trim());
      };

      rec.onerror = function (event) {
        // no-speech / aborted 属常见非致命错误，交由上层决定如何提示
        handlers.onError(event.error || "unknown");
      };

      rec.onend = function () {
        running = false;
        // 若上层仍希望监听，则自动重启，保证「持续监听」不中断
        if (wantListening) {
          try {
            rec.start();
          } catch (e) {
            // 极少数情况下 start 过快会抛错，下一轮 onend 会再尝试
          }
        } else {
          handlers.onStateChange("stopped");
        }
      };

      return rec;
    }

    return {
      /** 开始持续监听 */
      start: function () {
        if (!isSupported()) {
          handlers.onError("not-supported");
          return;
        }
        wantListening = true;
        if (!recognition) recognition = build();
        if (!running) {
          try {
            recognition.start();
          } catch (e) {
            // 已在运行时 start 会抛 InvalidStateError，忽略即可
          }
        }
      },

      /** 停止监听（不自动重启） */
      stop: function () {
        wantListening = false;
        if (recognition && running) {
          recognition.stop();
        }
        handlers.onStateChange("stopped");
      },

      isListening: function () {
        return wantListening;
      },
    };
  }

  window.Speech = { isSupported, createRecognizer };
})();
