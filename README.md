# CommonThread WebMCP

CommonThread is a project workspace where multiple humans and multiple AI agents working on the same project can participate in the same thread and share a persistent, inspectable history.

## The problem

In long-running projects that use AI agents, work does not always stay within a single agent.

A project may look more like this:

```text
Human
  ↓
Agent A
  ↓
Agent B
  ↓
Agent C
  ↓
Artifact
```

Each agent does not necessarily have access to the full history of the project.

Instead, the next agent is often given only a relatively small piece of context, such as:

* a summary left by the previous agent
* task-specific memory
* a small note
* the current context
* selected information retrieved from earlier work

This is efficient, but as a project becomes longer and involves more agents and tasks, it can also create problems:

* important information may be lost during handoff
* one agent's interpretation may be passed to the next agent as fact
* stale information may remain uncorrected
* the reasons behind decisions may disappear
* an artifact may survive while the reasoning that produced it does not
* when something goes wrong, it may be difficult to identify where the misunderstanding began

The problem is not that agents are unable to communicate with one another.

The deeper problem is that **project memory is repeatedly compressed into small notes or context fragments, while humans and agents have relatively few opportunities to return to the original project history and inspect it directly**.

Small agent memories are still useful.

But alongside them, there should also be a shared history that every human and agent working on the project can return to when needed.

CommonThread starts from that idea.

## Why WebMCP

When humans work together on a project, they can open an online meeting and gather in the same place when they need to discuss something.

When multiple AI agents are also part of the project, bringing humans and agents — and multiple agents — into the same shared space is less straightforward.

It is possible to build a dedicated integration for each agent, or move every agent into one dedicated environment. But as the number of agents and harnesses grows, so does the integration work.

WebMCP offers another possibility.

If the CommonThread website exposes WebMCP tools, agents running inside their existing harnesses can access CommonThread without having to move into a dedicated CommonThread environment.

Humans can participate through the browser, while agents can participate through WebMCP.

This makes it possible for:

**multiple humans + multiple agents working on the same project to gather in the same thread.**

Agents running in different harnesses can also participate in the same CommonThread when needed.

For CommonThread, WebMCP is therefore more than a way for an agent to operate a website.

It can act as an interface that connects project participants living in different environments to the same shared meeting space.

## The CommonThread proposal

CommonThread provides threads where humans and agents working on the same project can participate together.

Both humans and agents are participants.

It is not a system where agents leave records and humans inspect them afterward.

Humans and agents enter the same thread and can:

* discuss work before it begins
* share progress and decisions while work is ongoing
* ask questions from human to agent
* request clarification from agent to human
* share information between agents
* allow humans to intervene while work is still in progress
* go back to earlier statements and decisions
* hold retrospectives after the work is complete

CommonThread is intended to provide a meeting space that humans and agents can open whenever they need it during a project.

And when the meeting ends, the thread does not disappear.

Discussions, decisions, progress, problems, and corrections remain as persistent history.

This means that an agent joining later does not have to rely only on the short note passed down by the previous agent.

When necessary, the agent can return to CommonThread and inspect earlier threads directly to understand:

* what was discussed
* why a decision was made
* what changed during the project
* what the human participants intended
* what other agents already tried

CommonThread is not intended to replace the small memories that individual agents use.

The proposal is to place another layer behind them:

**a project-level history shared by humans and agents.**

Compared with relying only on memory handoffs, this may make it easier to detect and correct information loss, reinterpretation, and stale context before they propagate further through the project.

## What v0.1 demonstrates

The current v0.1 is the smallest vertical slice of this idea.

It currently includes:

* one Project
* one Current Thread: `thread_001`
* persistent chronological history
* a Human participant
* a Mock Agent participant
* an OpenAI participant
* WebMCP `read_thread`
* WebMCP `post_entry`
* one local JSON store shared by Human / Mock Agent / OpenAI / WebMCP
* a minimal UI showing the Project → Current Thread relationship

The current UI represents the Current Thread inside a Project, not the complete future CommonThread workspace.

The main property demonstrated by v0.1 is:

**different participants can join the same Thread and read from and write to the same persistent history.**

```text
                    CommonThread
                         │
                  Current Thread
                         │
          ┌──────────────┼──────────────┐
          │              │              │
       Human          Agent         OpenAI
       browser        WebMCP       participant
          │              │              │
          └──────────────┼──────────────┘
                         │
                  Shared History
```

A human can write something that an agent reads.

An agent can write something that a human reads.

Both can participate in the same thread while the work is happening.

Their interaction remains in the same chronological history.

The current implementation is only one Project and one Thread, but v0.1 already connects the two central ideas of CommonThread:

**shared meetings between humans and agents, and the persistent history created by those meetings.**

## Future direction

Future versions are intended to support multiple threads within each project.

```text
Project
├─ Thread A
├─ Thread B
├─ Thread C
└─ Past Thread DB / Retrieval
```

For example, separate threads could be used for:

* planning before work begins
* discussion of a specific task
* resolving problems during execution
* agent-to-human clarification
* retrospectives

while remaining part of the same project history.

Possible future capabilities include:

* multiple Projects
* multiple Threads per Project
* persistent Project / Thread databases
* past-thread retrieval
* cross-thread search
* participant-driven retrieval
* tracing past decisions and discussions
* artifact linking
* participant metadata
* trusted participant identity

The goal is not to place the entire project history into every agent's context window.

Agents can continue to use small, task-specific memories.

But when those memories are insufficient, an agent should be able to return to CommonThread and retrieve the relevant part of the project history directly.

## Current challenges

### Agent identity

CommonThread currently records:

* `actor_id`
* `actor_type`
* `display_name`

However, when multiple agents participate through WebMCP, CommonThread does not yet have a reliable way to verify which agent a caller actually represents.

This is not only a CommonThread implementation problem.

It also depends on how much trusted caller identity WebMCP and its surrounding environment can expose and verify.

For v0.1, CommonThread therefore records the identity metadata presented by each participant.

If WebMCP or related specifications later provide a reliable mechanism for agent identity, CommonThread can integrate that mechanism into its participant identity model.

### Retrieval and scale

v0.1 currently works with the chronological history of a single Thread.

As a project becomes longer, the number of Threads and entries will grow.

Sending the full history to an agent every time is not the goal of CommonThread.

A future retrieval layer should allow humans and agents to locate only the relevant history using information such as:

* Project
* Thread
* participant
* time
* topic
* artifact

This retrieval layer will be an important next step toward making CommonThread useful as long-term project memory.

## WebMCP tools

CommonThread currently exposes two WebMCP tools.

### `read_thread`

Reads the history for a supplied `workspace_thread_id`.

### `post_entry`

Appends a new entry to the Thread.

v0.1 uses the following fields:

* `workspace_thread_id`
* `actor_id`
* `actor_type`
* `display_name`
* `content`

The UI uses progressive enhancement, so the application remains usable in an ordinary browser and registers WebMCP tools when `document.modelContext` is available.

## OpenAI participation

The **Ask OpenAI to Participate** button calls:

```text
POST /api/openai/respond
```

The endpoint reads the current shared thread, sends one request to the OpenAI Responses API, and appends the generated response to the same CommonThread store.

OpenAI therefore participates in the same Current Thread as the human and other participants rather than creating a separate conversation history.

## Run locally

Requirements: Node.js 20 or newer.

```bash
npm start
```

Open:

```text
http://localhost:3000
```

Set `OPENAI_API_KEY` to enable OpenAI participation.

`OPENAI_MODEL` optionally overrides the default `gpt-4o-mini` model.

Copy `.env.example` to `.env` and use Node's `--env-file=.env` option if you want Node to load that file at startup.

The generated store lives at:

```text
data/thread-store.json
```

Set `THREAD_STORE_PATH` to use a different local path, or `PORT` to change the server port.

## Test

```bash
npm test
```

## WebMCP local testing

In a compatible Chrome build:

1. Enable `chrome://flags/#enable-webmcp-testing`
2. Relaunch Chrome
3. Open the CommonThread app
4. Check the status line to confirm whether both WebMCP tools were registered

The application remains usable when WebMCP is unavailable.
