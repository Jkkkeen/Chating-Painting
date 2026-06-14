/**
 * history.js — 画布历史栈
 *
 * 以 store 快照为单位记录可撤销变更。调用流程：
 *   history.capture()  在修改前保存 before
 *   ...修改 store...
 *   history.commit(label)  保存 before/after，清空 redo 栈
 */
(function () {
  "use strict";

  function cloneSnapshot(snapshot) {
    return JSON.parse(JSON.stringify(snapshot || []));
  }

  function sameSnapshot(a, b) {
    return JSON.stringify(a || []) === JSON.stringify(b || []);
  }

  function create(store) {
    let pendingBefore = null;
    const past = [];
    const future = [];

    function current() {
      return store.snapshot();
    }

    function capture() {
      pendingBefore = current();
    }

    function commit(label) {
      if (!pendingBefore) return false;
      const after = current();
      if (sameSnapshot(pendingBefore, after)) {
        pendingBefore = null;
        return false;
      }
      past.push({
        label: label || "操作",
        before: cloneSnapshot(pendingBefore),
        after: cloneSnapshot(after),
      });
      future.length = 0;
      pendingBefore = cloneSnapshot(after);
      return true;
    }

    function rollbackPending() {
      pendingBefore = null;
    }

    function undo() {
      if (!past.length) return { ok: false, reason: "empty" };
      const entry = past.pop();
      future.push(entry);
      store.replaceAll(entry.before);
      pendingBefore = current();
      return { ok: true, label: entry.label };
    }

    function redo() {
      if (!future.length) return { ok: false, reason: "empty" };
      const entry = future.pop();
      past.push(entry);
      store.replaceAll(entry.after);
      pendingBefore = current();
      return { ok: true, label: entry.label };
    }

    function canUndo() {
      return past.length > 0;
    }

    function canRedo() {
      return future.length > 0;
    }

    return {
      capture,
      commit,
      rollbackPending,
      undo,
      redo,
      canUndo,
      canRedo,
    };
  }

  window.History = { create };
})();
