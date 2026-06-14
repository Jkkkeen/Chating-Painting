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

tryLoad("frontend/js/corrector.js");
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

test("corrector normalizes common homophones before parsing", () => {
  assert.strictEqual(sandbox.Corrector.normalizeText("话一个篮色的园圈"), "画一个蓝色的圆圈");
  assert.strictEqual(sandbox.Corrector.normalizeText("划一个兰色方快"), "画一个蓝色方块");
});

test("corrector converts common Chinese numerals", () => {
  assert.strictEqual(sandbox.Corrector.chineseNumberToInt("一"), 1);
  assert.strictEqual(sandbox.Corrector.chineseNumberToInt("两"), 2);
  assert.strictEqual(sandbox.Corrector.chineseNumberToInt("十二"), 12);
  assert.strictEqual(sandbox.Corrector.chineseNumberToInt("二十三"), 23);
});

test("parser creates shapes from corrected homophones", () => {
  const cmd = sandbox.Parser.parse("话一个篮色的园");

  assert.strictEqual(cmd.action, "create");
  assert.strictEqual(cmd.type, "circle");
  assert.strictEqual(cmd.colorName, "blue");
});

test("parser detects requested count on create commands", () => {
  assert.deepStrictEqual(
    plain(sandbox.Parser.parse("画三个红色圆")),
    {
      action: "create",
      type: "circle",
      color: "#e23b3b",
      colorName: "red",
      count: 3,
    }
  );

  assert.strictEqual(sandbox.Parser.parse("画12个矩形").count, 12);
  assert.strictEqual(sandbox.Parser.parse("画两个蓝色圆").count, 2);
});

test("reference ordinal uses normalized numerals", () => {
  assert.deepStrictEqual(
    plain(sandbox.Reference.parseRef("选中第十二个篮色圆")),
    {
      type: "circle",
      color: "blue",
      ordinal: 12,
    }
  );
});
