/**
 * drawing.js — Canvas 绘图引擎
 *
 * 职责：把 store 里的图形对象集合渲染到画布上。纯粹的渲染层，
 * 不关心指令解析，只认对象模型。后续选中高亮、导出等都建在此之上。
 *
 * 坐标约定见 store.js。所有绘制使用 CSS 像素坐标
 * （main.js 已用 devicePixelRatio 设置过变换，故此处按显示尺寸作画）。
 */
(function () {
  "use strict";

  function drawCircle(ctx, s) {
    const r = s.w / 2;
    ctx.beginPath();
    ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
    if (s.filled) {
      ctx.fillStyle = s.color;
      ctx.fill();
    } else {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.lineWidth;
      ctx.stroke();
    }
  }

  function drawRect(ctx, s) {
    if (s.filled) {
      ctx.fillStyle = s.color;
      ctx.fillRect(s.x, s.y, s.w, s.h);
    } else {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.lineWidth;
      ctx.strokeRect(s.x, s.y, s.w, s.h);
    }
  }

  function drawLine(ctx, s) {
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    // line 用 w/h 表示终点相对位移
    ctx.lineTo(s.x + s.w, s.y + s.h);
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.lineWidth;
    ctx.lineCap = "round";
    ctx.stroke();
  }

  function drawText(ctx, s) {
    ctx.fillStyle = s.color;
    ctx.font =
      s.fontSize + "px 'PingFang SC', 'Microsoft YaHei', sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(s.text, s.x, s.y);
  }

  const RENDERERS = {
    circle: drawCircle,
    rect: drawRect,
    line: drawLine,
    text: drawText,
  };

  /** 计算图形的包围盒，供选中高亮使用 */
  function boundsOf(ctx, s) {
    switch (s.type) {
      case "circle":
        return { x: s.x - s.w / 2, y: s.y - s.w / 2, w: s.w, h: s.w };
      case "rect":
        return { x: s.x, y: s.y, w: s.w, h: s.h };
      case "line":
        return {
          x: Math.min(s.x, s.x + s.w),
          y: Math.min(s.y, s.y + s.h),
          w: Math.abs(s.w),
          h: Math.abs(s.h),
        };
      case "text": {
        ctx.font =
          s.fontSize + "px 'PingFang SC', 'Microsoft YaHei', sans-serif";
        const m = ctx.measureText(s.text || "");
        return {
          x: s.x,
          y: s.y - s.fontSize,
          w: m.width,
          h: s.fontSize * 1.2,
        };
      }
      default:
        return { x: s.x, y: s.y, w: s.w, h: s.h };
    }
  }

  function drawSelection(ctx, s) {
    const b = boundsOf(ctx, s);
    const pad = 6;
    ctx.save();
    ctx.strokeStyle = "#4f8cff";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(b.x - pad, b.y - pad, b.w + pad * 2, b.h + pad * 2);
    ctx.restore();
  }

  /**
   * 渲染整个画布。
   * @param {CanvasRenderingContext2D} ctx
   * @param {{width:number,height:number}} size  CSS 像素尺寸
   * @param {Array} shapes  store.all() 的结果
   * @param {string} background
   */
  function renderAll(ctx, size, shapes, background) {
    ctx.clearRect(0, 0, size.width, size.height);
    if (background) {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, size.width, size.height);
    }

    if (!shapes.length) {
      ctx.fillStyle = "#c8ccd4";
      ctx.font = "16px 'PingFang SC', 'Microsoft YaHei', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        "空白画布 · 说「开始绘图」后试试「画一个圆」",
        size.width / 2,
        size.height / 2
      );
      return;
    }

    shapes.forEach((s) => {
      const fn = RENDERERS[s.type];
      if (fn) fn(ctx, s);
    });
    // 选中高亮画在最上层
    shapes.filter((s) => s.selected).forEach((s) => drawSelection(ctx, s));
  }

  window.Drawing = { renderAll, boundsOf };
})();
