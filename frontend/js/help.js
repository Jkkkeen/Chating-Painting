/**
 * help.js — 语音帮助文案
 *
 * 集中维护「我能说什么」的帮助内容，供语音播报和屏幕反馈复用。
 */
(function () {
  "use strict";

  const GROUPS = [
    {
      title: "创建",
      items: ["画一个红色的圆", "在左上角画一个蓝色矩形", "写字「你好」"],
    },
    {
      title: "编辑",
      items: ["选中红色的圆", "把它向右移动一点", "复制一份", "删掉它"],
    },
    {
      title: "画布",
      items: ["撤销", "重做", "清空画布", "保存为图片"],
    },
    {
      title: "模式",
      items: ["暂停绘图", "继续绘图", "我能说什么"],
    },
  ];

  function groups() {
    return GROUPS.map(function (group) {
      return {
        title: group.title,
        items: group.items.slice(),
      };
    });
  }

  function summary() {
    return GROUPS.map(function (group) {
      return group.title + "：" + group.items.join("、");
    }).join("。");
  }

  window.Help = {
    groups,
    summary,
  };
})();
