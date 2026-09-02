import assert from "node:assert/strict";
import test from "node:test";
import { createOpenAiClient } from "../src/openai-client.js";

test("OpenAI client sends shared history and returns generated text", async () => {
  let request;
  const openai = createOpenAiClient({
    apiKey: "test-key",
    model: "test-model",
    fetchImpl: async (url, options) => {
      request = { url, options };
      return new Response(
        JSON.stringify({
          status: "completed",
          output: [
            {
              type: "message",
              content: [{ type: "output_text", text: "Shared response" }],
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    },
  });

  const content = await openai.generateResponse({
    entries: [
      {
        actor_type: "human",
        display_name: "Test Human",
        content: "Shared question",
      },
    ],
  });

  assert.equal(content, "Shared response");
  assert.equal(request.url, "https://api.openai.com/v1/responses");
  assert.equal(request.options.headers.Authorization, "Bearer test-key");
  const body = JSON.parse(request.options.body);
  assert.equal(body.model, "test-model");
  assert.equal(body.store, false);
  assert.match(body.input, /Test Human \(human\): Shared question/);
});

test("OpenAI client requires an API key without calling fetch", async () => {
  let called = false;
  const openai = createOpenAiClient({
    fetchImpl: async () => {
      called = true;
    },
  });

  await assert.rejects(
    openai.generateResponse({ entries: [] }),
    { code: "OPENAI_NOT_CONFIGURED" },
  );
  assert.equal(called, false);
});

test("OpenAI client rejects responses without output text", async () => {
  const openai = createOpenAiClient({
    apiKey: "test-key",
    fetchImpl: async () =>
      new Response(JSON.stringify({ status: "completed", output: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
  });

  await assert.rejects(
    openai.generateResponse({ entries: [] }),
    { code: "OPENAI_EMPTY_RESPONSE" },
  );
});
