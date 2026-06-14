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
tryLoad("frontend/js/clarifier.js");

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

test("parses confirmation replies", () => {
  assert.deepStrictEqual(plain(sandbox.Parser.parse("确认")), { action: "confirm" });
  assert.deepStrictEqual(plain(sandbox.Parser.parse("不用了取消")), { action: "cancel" });
});

test("parses clear canvas as a destructive command", () => {
  const cmd = sandbox.Parser.parse("清空画布");
  assert.deepStrictEqual(plain(cmd), {
    action: "clearCanvas",
    destructive: true,
  });
});

test("clarifier resolves an ambiguous candidate by ordinal reply", () => {
  const clarifier = sandbox.Clarifier.create({
    describeCandidate: (shape) => shape.label,
  });
  const command = { action: "delete", ref: { color: "red" } };
  const candidates = [
    { id: "s1", label: "红色圆形" },
    { id: "s2", label: "红色矩形" },
  ];

  const question = clarifier.askAmbiguous(command, candidates);
  assert.strictEqual(
    question,
    "找到2个候选：第一个是红色圆形，第二个是红色矩形。请说第几个，或说取消。"
  );

  const result = clarifier.handle("第二个");
  assert.strictEqual(result.type, "resolved");
  assert.strictEqual(result.command, command);
  assert.strictEqual(result.shape.id, "s2");
  assert.strictEqual(clarifier.hasPending(), false);
});

test("clarifier keeps waiting when reply is not a valid candidate", () => {
  const clarifier = sandbox.Clarifier.create({
    describeCandidate: (shape) => shape.label,
  });
  clarifier.askAmbiguous({ action: "select" }, [{ label: "圆" }, { label: "矩形" }]);

  const result = clarifier.handle("那个");

  assert.deepStrictEqual(plain(result), {
    type: "waiting",
    message: "请说第几个，或说取消。",
  });
  assert.strictEqual(clarifier.hasPending(), true);
});

test("clarifier can cancel a pending clarification", () => {
  const clarifier = sandbox.Clarifier.create({
    describeCandidate: (shape) => shape.label,
  });
  clarifier.askAmbiguous({ action: "move" }, [{ label: "圆" }, { label: "矩形" }]);

  const result = clarifier.handle("取消");

  assert.deepStrictEqual(plain(result), {
    type: "cancelled",
    message: "已取消",
  });
  assert.strictEqual(clarifier.hasPending(), false);
});

test("clarifier confirms or rejects a destructive command", () => {
  const clarifier = sandbox.Clarifier.create();
  const command = { action: "clearCanvas", destructive: true };
  const prompt = clarifier.askConfirm(command, "确定要清空画布吗？请说确认或取消。");

  assert.strictEqual(prompt, "确定要清空画布吗？请说确认或取消。");
  assert.deepStrictEqual(plain(clarifier.handle("确认")), {
    type: "confirmed",
    command: command,
  });

  clarifier.askConfirm(command, "确定要清空画布吗？请说确认或取消。");
  assert.deepStrictEqual(plain(clarifier.handle("取消")), {
    type: "cancelled",
    message: "已取消",
  });
});
