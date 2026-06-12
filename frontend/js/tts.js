/**
 * tts.js — 语音合成（SpeechSynthesis）封装
 *
 * 职责：把系统反馈用中文播报出来，并向上层提供 onStart / onEnd 回调，
 * 供「防自我触发」逻辑在播报期间屏蔽语音识别输入。
 *
 * 说明：浏览器的语音列表是异步加载的（voiceschanged 事件），
 * 因此延迟挑选中文语音；挑不到也能用默认语音播报。
 */
(function () {
  "use strict";

  const synth = window.speechSynthesis;

  function isSupported() {
    return Boolean(synth) && typeof window.SpeechSynthesisUtterance === "function";
  }

  let zhVoice = null;

  function pickVoice() {
    if (!isSupported()) return;
    const voices = synth.getVoices();
    // 优先中文语音
    zhVoice =
      voices.find((v) => /zh[-_]?CN/i.test(v.lang)) ||
      voices.find((v) => /^zh/i.test(v.lang)) ||
      null;
  }

  if (isSupported()) {
    pickVoice();
    // 语音列表异步就绪时再挑一次
    if (typeof synth.addEventListener === "function") {
      synth.addEventListener("voiceschanged", pickVoice);
    }
  }

  /**
   * 播报一段文本。
   * @param {string} text
   * @param {{onStart?:Function, onEnd?:Function, rate?:number}} [opts]
   */
  function speak(text, opts) {
    opts = opts || {};
    if (!isSupported() || !text) {
      // 不支持时也要把 onStart/onEnd 走一遍，避免上层状态卡死
      if (opts.onStart) opts.onStart();
      if (opts.onEnd) opts.onEnd();
      return;
    }

    // 取消正在进行的播报，保证反馈及时
    try {
      synth.cancel();
    } catch (e) {}

    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "zh-CN";
    utter.rate = opts.rate || 1.05;
    if (zhVoice) utter.voice = zhVoice;

    let ended = false;
    function finish() {
      if (ended) return;
      ended = true;
      if (opts.onEnd) opts.onEnd();
    }

    utter.onstart = function () {
      if (opts.onStart) opts.onStart();
    };
    utter.onend = finish;
    utter.onerror = finish;

    synth.speak(utter);

    // 兜底：个别浏览器 onend 不触发，按文本长度估算一个超时
    const fallbackMs = 1500 + text.length * 180;
    setTimeout(finish, fallbackMs);
  }

  function cancel() {
    if (isSupported()) {
      try {
        synth.cancel();
      } catch (e) {}
    }
  }

  window.TTS = { isSupported, speak, cancel };
})();
