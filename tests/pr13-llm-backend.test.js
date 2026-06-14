const assert = require("assert");

const {
  buildChatRequest,
  normalizeCommand,
  parseModelContent,
  parseWithDeepSeek,
} = require("../backend/llm");

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

test("builds a DeepSeek JSON-mode chat request", () => {
  const body = buildChatRequest("帮我在左边放一个蓝色方块");

  assert.strictEqual(body.model, "deepseek-v4-flash");
  assert.deepStrictEqual(body.response_format, { type: "json_object" });
  assert.strictEqual(body.stream, false);
  assert.ok(body.messages[0].content.includes("json"));
  assert.ok(body.messages[0].content.includes("create"));
  assert.ok(body.messages[1].content.includes("帮我在左边放一个蓝色方块"));
});

test("normalizes supported command JSON and rejects unsafe actions", () => {
  assert.deepStrictEqual(
    normalizeCommand({
      action: "create",
      type: "rect",
      colorName: "blue",
      color: "#2f6fe2",
      position: "left",
      count: 2,
    }),
    {
      action: "create",
      type: "rect",
      colorName: "blue",
      color: "#2f6fe2",
      position: "left",
      count: 2,
    }
  );

  assert.strictEqual(normalizeCommand({ action: "openUrl", url: "https://example.com" }), null);
});

test("normalizes export image command JSON", () => {
  assert.deepStrictEqual(normalizeCommand({ action: "exportImage" }), {
    action: "exportImage",
  });
});

test("normalizes help command JSON", () => {
  assert.deepStrictEqual(normalizeCommand({ action: "help" }), {
    action: "help",
  });
});

test("parses model JSON content into a normalized command", () => {
  const command = parseModelContent(
    JSON.stringify({
      action: "sequence",
      commands: [
        { action: "create", type: "circle", colorName: "red", color: "#e23b3b" },
        { action: "move", delta: { dx: 20, dy: 0 }, ref: { pronoun: true } },
      ],
    })
  );

  assert.strictEqual(command.action, "sequence");
  assert.strictEqual(command.commands.length, 2);
  assert.deepStrictEqual(command.commands[1].delta, { dx: 20, dy: 0 });
});

test("calls DeepSeek with bearer auth and parses the first message", async () => {
  const calls = [];
  const command = await parseWithDeepSeek("随便画点像标题一样的字", {
    apiKey: "test-key",
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  action: "create",
                  type: "text",
                  text: "标题",
                }),
              },
            },
          ],
        }),
      };
    },
  });

  assert.strictEqual(calls[0].url, "https://api.deepseek.com/chat/completions");
  assert.strictEqual(calls[0].options.headers.Authorization, "Bearer test-key");
  assert.deepStrictEqual(command, { action: "create", type: "text", text: "标题" });
});
