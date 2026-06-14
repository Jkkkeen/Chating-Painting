const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const sandbox = {
  console,
  setTimeout,
  Blob,
};
sandbox.window = sandbox;
vm.createContext(sandbox);

function load(rel) {
  const code = fs.readFileSync(path.join(root, rel), "utf8");
  vm.runInContext(code, sandbox, { filename: rel });
}

function test(name, fn) {
  Promise.resolve()
    .then(fn)
    .then(() => {
      console.log("✓ " + name);
    })
    .catch((err) => {
      console.error("✗ " + name);
      throw err;
    });
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

load("frontend/js/corrector.js");
load("frontend/js/sequence.js");
load("frontend/js/colors.js");
load("frontend/js/position.js");
load("frontend/js/parser.js");
load("frontend/js/exporter.js");

test("parser recognizes image export commands", () => {
  assert.deepStrictEqual(plain(sandbox.Parser.parse("保存为图片")), {
    action: "exportImage",
  });
  assert.deepStrictEqual(plain(sandbox.Parser.parse("导出图片")), {
    action: "exportImage",
  });
  assert.deepStrictEqual(plain(sandbox.Parser.parse("下载画布")), {
    action: "exportImage",
  });
});

test("exporter downloads canvas as a dated png file", async () => {
  const calls = [];
  const link = {
    href: "",
    download: "",
    click: () => calls.push(["click"]),
  };
  const deps = {
    document: {
      createElement: (tag) => {
        calls.push(["createElement", tag]);
        return link;
      },
      body: {
        appendChild: (node) => calls.push(["appendChild", node === link]),
        removeChild: (node) => calls.push(["removeChild", node === link]),
      },
    },
    URL: {
      createObjectURL: (blob) => {
        calls.push(["createObjectURL", blob.type]);
        return "blob:test-url";
      },
      revokeObjectURL: (url) => calls.push(["revokeObjectURL", url]),
    },
  };
  const canvas = {
    toBlob: (callback, type) => {
      calls.push(["toBlob", type]);
      callback(new Blob(["png"], { type: "image/png" }));
    },
  };

  const result = await sandbox.Exporter.downloadCanvas(canvas, {
    now: new Date("2026-06-14T08:09:10Z"),
    deps,
  });

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.filename, "chating-painting-20260614-080910.png");
  assert.strictEqual(link.href, "blob:test-url");
  assert.strictEqual(link.download, result.filename);
  assert.deepStrictEqual(calls, [
    ["toBlob", "image/png"],
    ["createObjectURL", "image/png"],
    ["createElement", "a"],
    ["appendChild", true],
    ["click"],
    ["removeChild", true],
    ["revokeObjectURL", "blob:test-url"],
  ]);
});
