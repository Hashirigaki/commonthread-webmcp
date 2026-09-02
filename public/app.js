const workspaceThreadId = "thread_001";

const threadElement = document.querySelector("#thread");
const formElement = document.querySelector("#entry-form");
const contentElement = document.querySelector("#entry-content");
const postButton = document.querySelector("#post-button");
const openaiButton = document.querySelector("#openai-button");
const mockAgentButton = document.querySelector("#mock-agent-button");
const errorElement = document.querySelector("#error-message");
const connectionStatus = document.querySelector("#connection-status");
const webMcpStatus = document.querySelector("#webmcp-status");
const emptyThreadTemplate = document.querySelector("#empty-thread-template");

async function requestJson(path, options) {
  const response = await fetch(path, options);
  const value = await response.json();
  if (!response.ok) {
    throw new Error(value.error ?? `Request failed with status ${response.status}.`);
  }
  return value;
}

function formatTimestamp(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function renderThread(thread) {
  threadElement.replaceChildren();

  if (thread.entries.length === 0) {
    threadElement.append(emptyThreadTemplate.content.cloneNode(true));
    return;
  }

  for (const entry of thread.entries) {
    const article = document.createElement("article");
    article.className = "entry";
    article.dataset.actorType = entry.actor_type;

    const meta = document.createElement("div");
    meta.className = "entry-meta";

    const actorType = document.createElement("span");
    actorType.className = "actor-type";
    actorType.textContent = entry.actor_type;

    const displayName = document.createElement("span");
    displayName.className = "display-name";
    displayName.textContent = entry.display_name;

    const timestamp = document.createElement("time");
    timestamp.className = "timestamp";
    timestamp.dateTime = entry.created_at;
    timestamp.textContent = formatTimestamp(entry.created_at);

    const content = document.createElement("p");
    content.className = "entry-content";
    content.textContent = entry.content;

    meta.append(actorType, displayName, timestamp);
    article.append(meta, content);
    threadElement.append(article);
  }

  threadElement.scrollTop = threadElement.scrollHeight;
}

async function readThread() {
  const thread = await requestJson(
    `/api/thread?workspace_thread_id=${encodeURIComponent(workspaceThreadId)}`,
  );
  renderThread(thread);
  connectionStatus.textContent = `${thread.entries.length} shared entries`;
  connectionStatus.classList.add("ready");
  return thread;
}

async function postEntry(input) {
  const result = await requestJson("/api/entries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  await readThread();
  return result;
}

async function runWithBusyState(button, operation) {
  errorElement.textContent = "";
  button.disabled = true;
  try {
    return await operation();
  } catch (error) {
    errorElement.textContent = error.message;
    throw error;
  } finally {
    button.disabled = false;
  }
}

formElement.addEventListener("submit", async (event) => {
  event.preventDefault();
  const content = contentElement.value.trim();
  if (!content) {
    return;
  }

  try {
    await runWithBusyState(postButton, () =>
      postEntry({
        workspace_thread_id: workspaceThreadId,
        actor_id: "human_browser_user",
        actor_type: "human",
        display_name: "Human",
        content,
      }),
    );
    contentElement.value = "";
    contentElement.focus();
  } catch {
    // The shared error surface already contains the actionable message.
  }
});

mockAgentButton.addEventListener("click", async () => {
  try {
    await runWithBusyState(mockAgentButton, async () => {
      await requestJson("/api/mock-agent/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_thread_id: workspaceThreadId }),
      });
      await readThread();
    });
  } catch {
    // The shared error surface already contains the actionable message.
  }
});

openaiButton.addEventListener("click", async () => {
  try {
    await runWithBusyState(openaiButton, async () => {
      await requestJson("/api/openai/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_thread_id: workspaceThreadId }),
      });
      await readThread();
    });
  } catch {
    // The shared error surface already contains the actionable message.
  }
});

async function registerWebMcpTools() {
  if (!document.modelContext?.registerTool) {
    webMcpStatus.textContent = "WebMCP unavailable in this browser";
    return;
  }

  await document.modelContext.registerTool({
    name: "read_thread",
    description:
      "Read the chronological entries in the current CommonThread shared workspace.",
    inputSchema: {
      type: "object",
      properties: {
        workspace_thread_id: {
          type: "string",
          description: "The shared workspace thread identifier.",
        },
      },
      required: ["workspace_thread_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    execute: async ({ workspace_thread_id }) => {
      const thread = await requestJson(
        `/api/thread?workspace_thread_id=${encodeURIComponent(workspace_thread_id)}`,
      );
      return JSON.stringify(thread);
    },
  });

  await document.modelContext.registerTool({
    name: "post_entry",
    description:
      "Append one human- or agent-labeled entry to a CommonThread shared workspace.",
    inputSchema: {
      type: "object",
      properties: {
        workspace_thread_id: { type: "string" },
        actor_id: { type: "string" },
        actor_type: { type: "string", enum: ["human", "agent"] },
        display_name: { type: "string" },
        content: { type: "string", minLength: 1, maxLength: 4000 },
      },
      required: [
        "workspace_thread_id",
        "actor_id",
        "actor_type",
        "display_name",
        "content",
      ],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false },
    execute: async (input) => JSON.stringify(await postEntry(input)),
  });

  webMcpStatus.textContent = "WebMCP: read_thread + post_entry registered";
}

try {
  await readThread();
  await registerWebMcpTools();
} catch (error) {
  connectionStatus.textContent = "Thread unavailable";
  errorElement.textContent = error.message;
}
