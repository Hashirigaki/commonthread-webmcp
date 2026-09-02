import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import test from "node:test";
import { createAppServer } from "../src/app-server.js";
import { JsonThreadStore } from "../src/thread-store.js";

async function withServer(run, { openai } = {}) {
  const directory = await mkdtemp(join(tmpdir(), "commonthread-server-"));
  const store = new JsonThreadStore(join(directory, "thread-store.json"));
  await store.initialize();
  const server = createAppServer({ store, openai });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();

  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    server.close();
    await once(server, "close");
  }
}

test("human entry persists and can be read from the shared thread", async () => {
  await withServer(async (baseUrl) => {
    const postResponse = await fetch(`${baseUrl}/api/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspace_thread_id: "thread_001",
        actor_id: "human_test",
        actor_type: "human",
        display_name: "Test Human",
        content: "Investigate this issue.",
      }),
    });
    assert.equal(postResponse.status, 201);

    const readResponse = await fetch(
      `${baseUrl}/api/thread?workspace_thread_id=thread_001`,
    );
    const thread = await readResponse.json();
    assert.equal(thread.entries.length, 1);
    assert.equal(thread.entries[0].content, "Investigate this issue.");
  });
});

test("mock agent reads the same thread and appends one agent entry", async () => {
  await withServer(async (baseUrl) => {
    await fetch(`${baseUrl}/api/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspace_thread_id: "thread_001",
        actor_id: "human_test",
        actor_type: "human",
        display_name: "Test Human",
        content: "Shared question",
      }),
    });

    const agentResponse = await fetch(`${baseUrl}/api/mock-agent/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace_thread_id: "thread_001" }),
    });
    assert.equal(agentResponse.status, 201);

    const readResponse = await fetch(
      `${baseUrl}/api/thread?workspace_thread_id=thread_001`,
    );
    const thread = await readResponse.json();
    assert.equal(thread.entries.length, 2);
    assert.equal(thread.entries[1].actor_type, "agent");
    assert.equal(thread.entries[1].display_name, "Mock Agent");
    assert.match(thread.entries[1].content, /Shared question/);
  });
});

test("OpenAI reads the same thread and appends one agent entry", async () => {
  let receivedThread;
  const openai = {
    async generateResponse(thread) {
      receivedThread = thread;
      return "I acknowledge the shared question.";
    },
  };

  await withServer(async (baseUrl) => {
    await fetch(`${baseUrl}/api/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspace_thread_id: "thread_001",
        actor_id: "human_test",
        actor_type: "human",
        display_name: "Test Human",
        content: "Shared question",
      }),
    });

    const agentResponse = await fetch(`${baseUrl}/api/openai/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace_thread_id: "thread_001" }),
    });
    assert.equal(agentResponse.status, 201);
    assert.equal(receivedThread.entries.length, 1);
    assert.equal(receivedThread.entries[0].content, "Shared question");

    const readResponse = await fetch(
      `${baseUrl}/api/thread?workspace_thread_id=thread_001`,
    );
    const thread = await readResponse.json();
    assert.equal(thread.entries.length, 2);
    assert.equal(thread.entries[1].actor_type, "agent");
    assert.equal(thread.entries[1].actor_id, "agent_openai");
    assert.equal(thread.entries[1].display_name, "OpenAI");
    assert.equal(thread.entries[1].content, "I acknowledge the shared question.");
  }, { openai });
});

test("rejects invalid actor types", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspace_thread_id: "thread_001",
        actor_id: "unknown",
        actor_type: "system",
        display_name: "Unknown",
        content: "Invalid",
      }),
    });
    assert.equal(response.status, 400);
  });
});
