import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";

export const DEFAULT_THREAD_ID = "thread_001";

function initialState(workspaceThreadId = DEFAULT_THREAD_ID) {
  return {
    threads: [
      {
        workspace_thread_id: workspaceThreadId,
        created_at: new Date().toISOString(),
      },
    ],
    entries: [],
  };
}

export class JsonThreadStore {
  constructor(filePath, workspaceThreadId = DEFAULT_THREAD_ID) {
    this.filePath = filePath;
    this.workspaceThreadId = workspaceThreadId;
    this.writeQueue = Promise.resolve();
  }

  async initialize() {
    await mkdir(dirname(this.filePath), { recursive: true });

    try {
      await readFile(this.filePath, "utf8");
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
      await this.#writeState(initialState(this.workspaceThreadId));
    }
  }

  async readThread(workspaceThreadId) {
    const state = await this.#readState();
    const thread = state.threads.find(
      (candidate) => candidate.workspace_thread_id === workspaceThreadId,
    );

    if (!thread) {
      return null;
    }

    const entries = state.entries
      .filter((entry) => entry.workspace_thread_id === workspaceThreadId)
      .sort((left, right) => left.created_at.localeCompare(right.created_at));

    return { ...thread, entries };
  }

  async appendEntry(input) {
    const operation = this.writeQueue.then(async () => {
      const state = await this.#readState();
      const threadExists = state.threads.some(
        (thread) =>
          thread.workspace_thread_id === input.workspace_thread_id,
      );

      if (!threadExists) {
        const error = new Error("Workspace thread not found.");
        error.code = "THREAD_NOT_FOUND";
        throw error;
      }

      const entry = {
        entry_id: `entry_${randomUUID()}`,
        workspace_thread_id: input.workspace_thread_id,
        actor_id: input.actor_id,
        actor_type: input.actor_type,
        display_name: input.display_name,
        content: input.content,
        created_at: new Date().toISOString(),
      };

      state.entries.push(entry);
      await this.#writeState(state);
      return entry;
    });

    this.writeQueue = operation.catch(() => undefined);
    return operation;
  }

  async #readState() {
    const raw = await readFile(this.filePath, "utf8");
    return JSON.parse(raw);
  }

  async #writeState(state) {
    const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    await rename(temporaryPath, this.filePath);
  }
}
