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

load("frontend/js/corrector.js");
load("frontend/js/sequence.js");
load("frontend/js/colors.js");
load("frontend/js/position.js");
load("frontend/js/parser.js");
load("frontend/js/help.js");

test("parser recognizes voice help commands", () => {
  assert.deepStrictEqual(plain(sandbox.Parser.parse("帮助")), { action: "help" });
  assert.deepStrictEqual(plain(sandbox.Parser.parse("我能说什么")), { action: "help" });
  assert.deepStrictEqual(plain(sandbox.Parser.parse("有哪些指令")), { action: "help" });
});

test("help summary gives practical command examples", () => {
  const summary = sandbox.Help.summary();

  assert.ok(summary.includes("画一个红色的圆"));
  assert.ok(summary.includes("把它向右移动一点"));
  assert.ok(summary.includes("保存为图片"));
  assert.ok(summary.includes("暂停绘图"));
});

test("help examples are grouped for screen feedback", () => {
  const groups = sandbox.Help.groups();

  assert.ok(groups.length >= 4);
  assert.ok(groups.some((group) => group.title === "创建"));
  assert.ok(groups.some((group) => group.items.includes("撤销")));
  assert.ok(groups.some((group) => group.items.includes("我能说什么")));
});
