const DEFAULT_MODEL = "gpt-4o-mini";

function formatThreadHistory(thread) {
  if (thread.entries.length === 0) {
    return "The shared thread is currently empty.";
  }

  return thread.entries
    .map(
      (entry) =>
        `${entry.display_name} (${entry.actor_type}): ${entry.content}`,
    )
    .join("\n");
}

function requestError(message, code, cause) {
  const error = new Error(message, cause ? { cause } : undefined);
  error.code = code;
  return error;
}

export function createOpenAiClient({
  apiKey,
  model = DEFAULT_MODEL,
  fetchImpl = fetch,
} = {}) {
  return {
    model,
    async generateResponse(thread) {
      if (!apiKey) {
        throw requestError(
          "OPENAI_API_KEY is not configured.",
          "OPENAI_NOT_CONFIGURED",
        );
      }

      let response;
      try {
        response = await fetchImpl("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            instructions:
              "You are participating in a shared thread with humans and agents. Read the current conversation and return one concise response only.",
            input: formatThreadHistory(thread),
            store: false,
          }),
        });
      } catch (cause) {
        throw requestError(
          "OpenAI request failed before receiving a response.",
          "OPENAI_REQUEST_FAILED",
          cause,
        );
      }

      if (!response.ok) {
        throw requestError(
          `OpenAI request failed with status ${response.status}.`,
          "OPENAI_REQUEST_FAILED",
        );
      }

      let result;
      try {
        result = await response.json();
      } catch (cause) {
        throw requestError(
          "OpenAI returned an invalid JSON response.",
          "OPENAI_REQUEST_FAILED",
          cause,
        );
      }

      const content = result.output
        ?.flatMap((item) => item.content ?? [])
        .filter((item) => item.type === "output_text")
        .map((item) => item.text ?? "")
        .join("")
        .trim();

      if (!content) {
        throw requestError(
          "OpenAI returned no text response.",
          "OPENAI_EMPTY_RESPONSE",
        );
      }

      return content;
    },
  };
}
