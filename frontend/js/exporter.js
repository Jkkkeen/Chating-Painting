/**
 * exporter.js — 画布图片导出
 *
 * 把当前 Canvas 保存为 PNG。模块只负责生成下载，不参与绘图状态变更。
 */
(function () {
  "use strict";

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function buildFilename(now) {
    const d = now || new Date();
    return (
      "chating-painting-" +
      d.getUTCFullYear() +
      pad(d.getUTCMonth() + 1) +
      pad(d.getUTCDate()) +
      "-" +
      pad(d.getUTCHours()) +
      pad(d.getUTCMinutes()) +
      pad(d.getUTCSeconds()) +
      ".png"
    );
  }

  function envDeps(options) {
    return (options && options.deps) || {
      document: window.document,
      URL: window.URL || window.webkitURL,
    };
  }

  function clickDownload(href, filename, deps) {
    const link = deps.document.createElement("a");
    link.href = href;
    link.download = filename;
    deps.document.body.appendChild(link);
    link.click();
    deps.document.body.removeChild(link);
  }

  function downloadBlob(blob, filename, deps) {
    const url = deps.URL.createObjectURL(blob);
    try {
      clickDownload(url, filename, deps);
    } finally {
      deps.URL.revokeObjectURL(url);
    }
  }

  function canvasToBlob(canvas) {
    return new Promise(function (resolve) {
      if (!canvas || typeof canvas.toBlob !== "function") {
        resolve(null);
        return;
      }
      canvas.toBlob(function (blob) {
        resolve(blob || null);
      }, "image/png");
    });
  }

  async function downloadCanvas(canvas, options) {
    const opts = options || {};
    const deps = envDeps(opts);
    const filename = opts.filename || buildFilename(opts.now);

    const blob = await canvasToBlob(canvas);
    if (blob) {
      downloadBlob(blob, filename, deps);
      return { ok: true, filename: filename };
    }

    if (canvas && typeof canvas.toDataURL === "function") {
      clickDownload(canvas.toDataURL("image/png"), filename, deps);
      return { ok: true, filename: filename };
    }

    return { ok: false, error: "canvas export is not supported" };
  }

  window.Exporter = {
    buildFilename,
    downloadCanvas,
  };
})();
