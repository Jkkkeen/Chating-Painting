const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");

function loadFrontend(fetchImpl, backendUrl) {
  const sandbox = {
    console,
    fetch: fetchImpl,
    URL,
  };
  sandbox.window = sandbox;
  sandbox.APP_CONFIG = { backendUrl: backendUrl || "" };
  vm.createContext(sandbox);
  const code = fs.readFileSync(path.join(root, "frontend/js/llm_fallback.js"), "utf8");
  vm.runInContext(code, sandbox, { filename: "frontend/js/llm_fallback.js" });
  return sandbox;
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

test("does nothing when backendUrl is empty", async () => {
  let called = false;
  const sandbox = loadFrontend(async () => {
    called = true;
  });

  assert.strictEqual(sandbox.LLMFallback.isEnabled(), false);
  assert.strictEqual(await sandbox.LLMFallback.parse("自由描述"), null);
  assert.strictEqual(called, false);
});

test("posts text to configured backend and returns command", async () => {
  const calls = [];
  const sandbox = loadFrontend(
    async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        json: async () => ({
          ok: true,
          command: { action: "create", type: "circle", colorName: "red", color: "#e23b3b" },
        }),
      };
    },
    "http://localhost:8787"
  );

  const command = await sandbox.LLMFallback.parse("随便画个红色圆形");

  assert.strictEqual(calls[0].url, "http://localhost:8787/api/parse");
  assert.strictEqual(JSON.parse(calls[0].options.body).text, "随便画个红色圆形");
  assert.deepStrictEqual(command, {
    action: "create",
    type: "circle",
    colorName: "red",
    color: "#e23b3b",
  });
});
