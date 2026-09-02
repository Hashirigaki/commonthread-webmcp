import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { JsonThreadStore } from "../src/thread-store.js";

test("initializes one persistent workspace thread", async () => {
  const directory = await mkdtemp(join(tmpdir(), "commonthread-store-"));
  const filePath = join(directory, "thread-store.json");
  const store = new JsonThreadStore(filePath);

  await store.initialize();
  const thread = await store.readThread("thread_001");

  assert.equal(thread.workspace_thread_id, "thread_001");
  assert.deepEqual(thread.entries, []);
  const persistedState = await readFile(filePath, "utf8");
  assert.doesNotThrow(() => JSON.parse(persistedState));
});

test("appends and returns chronological human and agent entries", async () => {
  const directory = await mkdtemp(join(tmpdir(), "commonthread-store-"));
  const store = new JsonThreadStore(join(directory, "thread-store.json"));
  await store.initialize();

  await store.appendEntry({
    workspace_thread_id: "thread_001",
    actor_id: "human_test",
    actor_type: "human",
    display_name: "Test Human",
    content: "Shared context",
  });
  await store.appendEntry({
    workspace_thread_id: "thread_001",
    actor_id: "agent_test",
    actor_type: "agent",
    display_name: "Test Agent",
    content: "Shared response",
  });

  const thread = await store.readThread("thread_001");
  assert.equal(thread.entries.length, 2);
  assert.equal(thread.entries[0].actor_type, "human");
  assert.equal(thread.entries[1].actor_type, "agent");
});
