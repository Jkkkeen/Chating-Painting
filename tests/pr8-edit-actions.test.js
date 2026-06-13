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
load("frontend/js/reference.js");
load("frontend/js/store.js");
tryLoad("frontend/js/editor.js");

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

test("parses move command with direction, distance, and reference", () => {
  const cmd = sandbox.Parser.parse("把第二个矩形往上移动一点");
  assert.strictEqual(cmd.action, "move");
  assert.deepStrictEqual(plain(cmd.delta), { dx: 0, dy: -20 });
  assert.deepStrictEqual(plain(cmd.ref), { type: "rect", ordinal: 2 });
});

test("parses delete command with pronoun reference", () => {
  const cmd = sandbox.Parser.parse("删除它");
  assert.strictEqual(cmd.action, "delete");
  assert.deepStrictEqual(plain(cmd.ref), { pronoun: true });
});

test("parses copy command with spatial reference", () => {
  const cmd = sandbox.Parser.parse("复制最右边的圆");
  assert.strictEqual(cmd.action, "copy");
  assert.deepStrictEqual(plain(cmd.ref), { type: "circle", spatial: "rightmost" });
});

test("moves a shape by delta", () => {
  const store = sandbox.Store.createStore();
  const shape = store.add({ type: "circle", x: 100, y: 120, w: 80, h: 80 });
  sandbox.Editor.move(shape, { dx: 40, dy: -20 });
  assert.strictEqual(shape.x, 140);
  assert.strictEqual(shape.y, 100);
});

test("copies a shape with offset and selects the copy", () => {
  const store = sandbox.Store.createStore();
  const original = store.add({
    type: "rect",
    color: "#ff4d4f",
    x: 50,
    y: 60,
    w: 100,
    h: 80,
    selected: true,
  });
  const copy = sandbox.Editor.copy(store, original);

  assert.notStrictEqual(copy.id, original.id);
  assert.strictEqual(copy.type, original.type);
  assert.strictEqual(copy.color, original.color);
  assert.strictEqual(copy.x, 82);
  assert.strictEqual(copy.y, 92);
  assert.strictEqual(copy.selected, true);
  assert.strictEqual(original.selected, false);
  assert.strictEqual(store.count(), 2);
});

test("deletes a shape from the store", () => {
  const store = sandbox.Store.createStore();
  const first = store.add({ type: "circle" });
  const second = store.add({ type: "rect" });

  const removed = sandbox.Editor.remove(store, first);

  assert.strictEqual(removed.id, first.id);
  assert.strictEqual(store.count(), 1);
  assert.strictEqual(store.all()[0].id, second.id);
});
