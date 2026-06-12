/**
 * store.js — 图形对象数据模型
 *
 * 维护画布上所有图形对象的集合，是后续「对象引用」（它 / 第二个 / 最右边的方块）
 * 与「编辑、撤销」能力的共同基础。本 PR 先建立模型与增删查，
 * 选择/指代解析在后续 PR 扩展。
 *
 * 图形对象统一结构：
 *   {
 *     id:           唯一标识
 *     type:         'circle' | 'rect' | 'line' | 'text'
 *     color:        填充/描边颜色（PR4 默认黑色，PR5 接入颜色指令）
 *     x, y:         参考坐标（circle: 圆心；rect: 左上角；line: 起点；text: 基线左端）
 *     w, h:         尺寸（circle: w=h=直径；rect: 宽高；line: 终点相对位移 dx,dy）
 *     text:         文字内容（仅 type==='text'）
 *     filled:       是否填充（PR5 接入；默认 true）
 *     lineWidth:    线宽（PR5 接入；默认值见下）
 *     createdOrder: 创建序号，从 1 开始，支持「第二个…」
 *     selected:     是否被选中
 *   }
 */
(function () {
  "use strict";

  const DEFAULTS = {
    color: "#222222",
    filled: true,
    lineWidth: 3,
    fontSize: 28,
  };

  function createStore() {
    let shapes = [];
    let seq = 0; // createdOrder 计数器
    let idCounter = 0;

    function nextId() {
      idCounter += 1;
      return "s" + idCounter;
    }

    /**
     * 新增一个图形对象。传入部分字段，其余用默认值补齐。
     * @returns {object} 新建的图形对象
     */
    function add(partial) {
      seq += 1;
      const shape = Object.assign(
        {
          id: nextId(),
          type: "rect",
          color: DEFAULTS.color,
          x: 0,
          y: 0,
          w: 0,
          h: 0,
          text: "",
          filled: DEFAULTS.filled,
          lineWidth: DEFAULTS.lineWidth,
          fontSize: DEFAULTS.fontSize,
          selected: false,
        },
        partial,
        { createdOrder: seq }
      );
      shapes.push(shape);
      return shape;
    }

    function all() {
      return shapes.slice();
    }

    function count() {
      return shapes.length;
    }

    function getById(id) {
      return shapes.find((s) => s.id === id) || null;
    }

    /** 最近创建的图形（供「它 / 刚才那个」指代） */
    function last() {
      return shapes.length ? shapes[shapes.length - 1] : null;
    }

    function remove(id) {
      const i = shapes.findIndex((s) => s.id === id);
      if (i >= 0) {
        const [removed] = shapes.splice(i, 1);
        return removed;
      }
      return null;
    }

    function clear() {
      shapes = [];
    }

    // ---- 选择状态（PR4 提供接口，指代解析在后续 PR） ----
    function clearSelection() {
      shapes.forEach((s) => (s.selected = false));
    }

    function select(id) {
      clearSelection();
      const s = getById(id);
      if (s) s.selected = true;
      return s;
    }

    function getSelected() {
      return shapes.filter((s) => s.selected);
    }

    return {
      DEFAULTS,
      add,
      all,
      count,
      getById,
      last,
      remove,
      clear,
      clearSelection,
      select,
      getSelected,
    };
  }

  window.Store = { createStore, DEFAULTS };
})();
