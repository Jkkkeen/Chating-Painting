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

load("frontend/js/corrector.js");
tryLoad("frontend/js/sequence.js");
load("frontend/js/colors.js");
load("frontend/js/position.js");
load("frontend/js/parser.js");
load("frontend/js/reference.js");

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

test("sequence splits local compound commands on then-like connectors", () => {
  assert.deepStrictEqual(
    plain(sandbox.Sequence.split("画一个红色圆，然后画一个蓝色矩形，接着把它向右移动一点")),
    ["画一个红色圆", "画一个蓝色矩形", "把它向右移动一点"]
  );
});

test("sequence splits guarded zai connector but keeps copy phrase intact", () => {
  assert.deepStrictEqual(
    plain(sandbox.Sequence.split("画一个圆再画一个方块")),
    ["画一个圆", "画一个方块"]
  );
  assert.deepStrictEqual(
    plain(sandbox.Sequence.split("再来一个")),
    ["再来一个"]
  );
});

test("parser returns sequence commands for compound input", () => {
  const cmd = sandbox.Parser.parse("画一个红色圆，然后画一个蓝色矩形，接着把它向右移动一点");

  assert.strictEqual(cmd.action, "sequence");
  assert.deepStrictEqual(
    plain(cmd.commands.map((item) => item.action)),
    ["create", "create", "move"]
  );
  assert.strictEqual(cmd.commands[0].type, "circle");
  assert.strictEqual(cmd.commands[0].colorName, "red");
  assert.strictEqual(cmd.commands[1].type, "rect");
  assert.strictEqual(cmd.commands[1].colorName, "blue");
  assert.deepStrictEqual(plain(cmd.commands[2].delta), { dx: 20, dy: 0 });
});

test("parser does not split existing copy command that starts with zai", () => {
  const cmd = sandbox.Parser.parse("再来一个");
  assert.deepStrictEqual(plain(cmd), { action: "copy" });
});

test("parser returns null when any compound segment cannot be parsed", () => {
  assert.strictEqual(sandbox.Parser.parse("画一个圆然后随便说点什么"), null);
});
