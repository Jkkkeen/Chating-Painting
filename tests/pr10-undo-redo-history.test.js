const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const sandbox = { console };
sandbox.window = sandbox;
vm.createContext(sandbox);

function load(rel) {
  const code = fs.readFileSync(path.join(root, rel), "utf8");
  vm.runInContext(code, sandbox, { filename: rel });
}

function tryLoad(rel) {
  const target = path.join(root, rel);
  if (fs.existsSync(target)) load(rel);
}

load("frontend/js/colors.js");
load("frontend/js/parser.js");
load("frontend/js/store.js");
tryLoad("frontend/js/history.js");

function test(name, fn) {
  try {
    fn();
    console.log("✓ " + name);
  } catch (err) {
    console.error("✗ " + name);
    throw err;
  }
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test("parses undo and redo commands", () => {
  assert.deepStrictEqual(plain(sandbox.Parser.parse("撤销")), { action: "undo" });
  assert.deepStrictEqual(plain(sandbox.Parser.parse("撤销刚才")), { action: "undo" });
  assert.deepStrictEqual(plain(sandbox.Parser.parse("重做")), { action: "redo" });
  assert.deepStrictEqual(plain(sandbox.Parser.parse("恢复上一步")), { action: "redo" });
});

test("store can snapshot and restore shapes with ids and selection", () => {
  const store = sandbox.Store.createStore();
  const first = store.add({ type: "circle", x: 10, y: 20 });
  const second = store.add({ type: "rect", x: 30, y: 40 });
  store.select(second.id);

  const snapshot = store.snapshot();
  store.clear();
  assert.strictEqual(store.count(), 0);

  store.replaceAll(snapshot);

  assert.strictEqual(store.count(), 2);
  assert.deepStrictEqual(
    plain(store.all().map((s) => ({
      id: s.id,
      type: s.type,
      createdOrder: s.createdOrder,
      selected: s.selected,
    }))),
    [
      { id: first.id, type: "circle", createdOrder: 1, selected: false },
      { id: second.id, type: "rect", createdOrder: 2, selected: true },
    ]
  );

  const third = store.add({ type: "line" });
  assert.strictEqual(third.id, "s3");
  assert.strictEqual(third.createdOrder, 3);
});

test("history undo and redo move between committed snapshots", () => {
  const store = sandbox.Store.createStore();
  const history = sandbox.History.create(store);

  history.capture();
  const circle = store.add({ type: "circle", x: 10, y: 20 });
  history.commit("画圆");
  circle.x = 50;
  history.commit("移动");

  assert.strictEqual(store.last().x, 50);

  assert.deepStrictEqual(plain(history.undo()), {
    ok: true,
    label: "移动",
  });
  assert.strictEqual(store.last().x, 10);

  assert.deepStrictEqual(plain(history.undo()), {
    ok: true,
    label: "画圆",
  });
  assert.strictEqual(store.count(), 0);

  assert.deepStrictEqual(plain(history.redo()), {
    ok: true,
    label: "画圆",
  });
  assert.strictEqual(store.count(), 1);
  assert.strictEqual(store.last().id, "s1");
});

test("new commits clear redo history", () => {
  const store = sandbox.Store.createStore();
  const history = sandbox.History.create(store);

  history.capture();
  store.add({ type: "circle" });
  history.commit("画圆");
  store.add({ type: "rect" });
  history.commit("画矩形");

  history.undo();
  store.add({ type: "line" });
  history.commit("画线");

  assert.deepStrictEqual(plain(history.redo()), {
    ok: false,
    reason: "empty",
  });
});
