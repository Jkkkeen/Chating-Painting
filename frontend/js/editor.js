/**
 * editor.js — 图形编辑原子操作
 *
 * 仅负责对 store / shape 做最小变更：移动、删除、复制。
 * 语音解析、目标指代、反馈文案由 parser / reference / main 负责。
 */
(function () {
  "use strict";

  const COPY_OFFSET = { dx: 32, dy: 32 };

  function move(shape, delta) {
    if (!shape || !delta) return null;
    const dx = typeof delta.dx === "number" ? delta.dx : 0;
    const dy = typeof delta.dy === "number" ? delta.dy : 0;
    shape.x += dx;
    shape.y += dy;
    return shape;
  }

  function copy(store, shape, offset) {
    if (!store || !shape) return null;
    const off = offset || COPY_OFFSET;
    const clone = {};
    [
      "type",
      "color",
      "x",
      "y",
      "w",
      "h",
      "text",
      "filled",
      "lineWidth",
      "fontSize",
    ].forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(shape, key)) {
        clone[key] = shape[key];
      }
    });

    clone.x = (typeof shape.x === "number" ? shape.x : 0) + off.dx;
    clone.y = (typeof shape.y === "number" ? shape.y : 0) + off.dy;
    clone.selected = false;

    const created = store.add(clone);
    if (store.select) store.select(created.id);
    return created;
  }

  function remove(store, shape) {
    if (!store || !shape) return null;
    return store.remove(shape.id);
  }

  function describeMove(delta) {
    if (!delta) return "移动";
    if (delta.dx > 0) return "向右移动";
    if (delta.dx < 0) return "向左移动";
    if (delta.dy > 0) return "向下移动";
    if (delta.dy < 0) return "向上移动";
    return "移动";
  }

  window.Editor = {
    COPY_OFFSET,
    move,
    copy,
    remove,
    describeMove,
  };
})();
