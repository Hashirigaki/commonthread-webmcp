# CommonThread WebMCP

CommonThread v0.1 is a minimal, human-visible shared workspace thread. Humans and AI agents read and append entries to the same chronological history.

This repository currently contains the first deterministic mock vertical slice:

- one persistent `thread_001`
- browser-based human posting and chronological history
- a one-shot Mock Gemini response that reads and writes the same thread
- WebMCP tools named `read_thread` and `post_entry`
- a local JSON store behind a replaceable store boundary

The mock deliberately excludes multi-agent orchestration, multiple rooms, authentication, artifacts, voice, topic graphs, trajectory/audit systems, and background execution.

## Run locally

Requirements: Node.js 20 or newer.

```bash
npm start
```

Open <http://localhost:3000>.

The generated store lives at `data/thread-store.json`. Set `THREAD_STORE_PATH` to use a different local path, or `PORT` to change the server port.

## Test

```bash
npm test
```

## WebMCP local testing

The UI uses progressive enhancement: it remains usable in ordinary browsers and registers WebMCP tools when `document.modelContext` is available.

In a compatible Chrome build, enable `chrome://flags/#enable-webmcp-testing`, relaunch Chrome, then open the app. The status line reports whether both tools were registered.

### `read_thread`

Reads the entries for a supplied `workspace_thread_id`.

### `post_entry`

Appends one entry with the v0.1 fields:

- `workspace_thread_id`
- `actor_id`
- `actor_type` (`human` or `agent`)
- `display_name`
- `content`

## Intended next replacement

The mock endpoint at `POST /api/mock-agent/respond` is the seam for the real one-shot Gemini path. The replacement should read the current thread, send its recent history to Gemini once, and append the response through the same store used by the browser and WebMCP tools.
