import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";

const moduleDirectory = fileURLToPath(new URL(".", import.meta.url));
const defaultPublicDirectory = join(moduleDirectory, "..", "public");

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

function sendJson(response, statusCode, value) {
  const body = JSON.stringify(value);
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  response.end(body);
}

async function readJson(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > 32_768) {
      throw new HttpError(413, "Request body is too large.");
    }
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "Request body must be valid JSON.");
  }
}

function requiredString(value, fieldName, maximumLength) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new HttpError(400, `${fieldName} is required.`);
  }

  const normalizedValue = value.trim();
  if (normalizedValue.length > maximumLength) {
    throw new HttpError(
      400,
      `${fieldName} must contain at most ${maximumLength} characters.`,
    );
  }
  return normalizedValue;
}

function validateEntryInput(body) {
  const actorType = requiredString(body.actor_type, "actor_type", 16);
  if (!new Set(["human", "agent"]).has(actorType)) {
    throw new HttpError(400, "actor_type must be human or agent.");
  }

  return {
    workspace_thread_id: requiredString(
      body.workspace_thread_id,
      "workspace_thread_id",
      128,
    ),
    actor_id: requiredString(body.actor_id, "actor_id", 128),
    actor_type: actorType,
    display_name: requiredString(body.display_name, "display_name", 80),
    content: requiredString(body.content, "content", 4_000),
  };
}

function buildMockAgentResponse(thread) {
  const latestHumanEntry = [...thread.entries]
    .reverse()
    .find((entry) => entry.actor_type === "human");

  if (!latestHumanEntry) {
    return `I read the shared thread. It currently contains ${thread.entries.length} entries and no human entry yet.`;
  }

  return [
    `I read ${thread.entries.length} shared thread ${thread.entries.length === 1 ? "entry" : "entries"}.`,
    `The latest human entry says: “${latestHumanEntry.content}”`,
    "This is a deterministic mock response; the next implementation step can replace only this generator with Gemini.",
  ].join(" ");
}

async function serveStatic(response, publicDirectory, pathname) {
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const safePath = normalize(requestedPath).replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = join(publicDirectory, safePath);

  try {
    const body = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": contentTypes[extname(filePath)] ?? "application/octet-stream",
      "Content-Length": body.length,
    });
    response.end(body);
  } catch (error) {
    if (error.code === "ENOENT") {
      sendJson(response, 404, { error: "Not found." });
      return;
    }
    throw error;
  }
}

export function createAppServer({ store, publicDirectory = defaultPublicDirectory }) {
  return http.createServer(async (request, response) => {
    response.setHeader("Origin-Agent-Cluster", "?1");
    response.setHeader("X-Content-Type-Options", "nosniff");

    try {
      const url = new URL(request.url, `http://${request.headers.host ?? "localhost"}`);

      if (request.method === "GET" && url.pathname === "/api/thread") {
        const workspaceThreadId = requiredString(
          url.searchParams.get("workspace_thread_id"),
          "workspace_thread_id",
          128,
        );
        const thread = await store.readThread(workspaceThreadId);
        if (!thread) {
          throw new HttpError(404, "Workspace thread not found.");
        }
        sendJson(response, 200, thread);
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/entries") {
        const input = validateEntryInput(await readJson(request));
        const entry = await store.appendEntry(input);
        sendJson(response, 201, { ok: true, entry_id: entry.entry_id, entry });
        return;
      }

      if (
        request.method === "POST" &&
        url.pathname === "/api/mock-agent/respond"
      ) {
        const body = await readJson(request);
        const workspaceThreadId = requiredString(
          body.workspace_thread_id,
          "workspace_thread_id",
          128,
        );
        const thread = await store.readThread(workspaceThreadId);
        if (!thread) {
          throw new HttpError(404, "Workspace thread not found.");
        }

        const entry = await store.appendEntry({
          workspace_thread_id: workspaceThreadId,
          actor_id: "agent_mock_gemini",
          actor_type: "agent",
          display_name: "Mock Gemini",
          content: buildMockAgentResponse(thread),
        });
        sendJson(response, 201, { ok: true, entry_id: entry.entry_id, entry });
        return;
      }

      if (request.method === "GET") {
        await serveStatic(response, publicDirectory, url.pathname);
        return;
      }

      throw new HttpError(404, "Not found.");
    } catch (error) {
      if (error.code === "THREAD_NOT_FOUND") {
        sendJson(response, 404, { error: error.message });
        return;
      }

      const statusCode = error.statusCode ?? 500;
      sendJson(response, statusCode, {
        error: statusCode === 500 ? "Internal server error." : error.message,
      });
    }
  });
}
