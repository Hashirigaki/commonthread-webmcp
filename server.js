import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createAppServer } from "./src/app-server.js";
import { createOpenAiClient } from "./src/openai-client.js";
import { JsonThreadStore } from "./src/thread-store.js";

const rootDirectory = fileURLToPath(new URL(".", import.meta.url));
const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const storePath =
  process.env.THREAD_STORE_PATH ?? join(rootDirectory, "data", "thread-store.json");

const store = new JsonThreadStore(storePath);
await store.initialize();
const openai = createOpenAiClient({
  apiKey: process.env.OPENAI_API_KEY,
  model: process.env.OPENAI_MODEL,
});

const server = createAppServer({ store, openai });
server.listen(port, "0.0.0.0", () => {
  console.log(`CommonThread mock listening on http://localhost:${port}`);
});
