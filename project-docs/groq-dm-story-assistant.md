# Groq — DM story assistant

## Relation to the original TavernOS spec

`TAVERNOS_BUILD.md` §1 (Claude specification) lists core VTT features (map, initiative, chat, character sheets, etc.). It does **not** name a specific LLM vendor; **Groq + a Llama-class instruct model** was chosen as the implementation for an in-app **DM narrative assistant**, reusing **`loadSessionForAI`** / **`compiledNarrativeContext`** from Phase D.

## Model

- **`meta-llama/llama-4-scout-17b-16e-instruct`** (Groq model id; see [Groq model docs](https://console.groq.com/docs/model/meta-llama/llama-4-scout-17b-16e-instruct)).
- Defined in code as `GROQ_DM_STORY_MODEL` in `artifacts/api-server/src/services/groq-dm-story-assistant.ts`.

## Server

- **`POST /api/campaigns/:campaignId/sessions/:sessionId/ai-story-assistant`** — **DM only**.
- Body: **`{ "message": string, "includeSessionContext"?: boolean }`** (default `includeSessionContext: true`).
- Server reads **`GROQ_API_KEY`**, calls Groq **`POST https://api.groq.com/openai/v1/chat/completions`** (OpenAI-compatible).
- **503** if `GROQ_API_KEY` is missing; **502** on Groq errors.

## Env

- **`artifacts/api-server/.env.example`** — `GROQ_API_KEY=`
- Copy to **`artifacts/api-server/.env`** (gitignored) or set the same name in your host’s **Secrets** UI.

## Frontend

- **`artifacts/tavernos/src/pages/session.tsx`** — DM Command Center drawer: **Story assistant (Groq)** — prompt, optional context checkbox, reply area.

## OpenAPI / client

- Schemas **`DmStoryAssistantRequest`**, **`DmStoryAssistantResponse`**; operation **`postDmStoryAssistant`**.
- **`usePostDmStoryAssistant`** explicitly re-exported from `lib/api-client-react/src/index.ts`.

## Where to get the API key (Groq)

1. Open **[Groq Console](https://console.groq.com)** and sign in.
2. Go to **API Keys** (direct: **[console.groq.com/keys](https://console.groq.com/keys)**).
3. **Create API Key**, copy the secret once, and set **`GROQ_API_KEY`** on the API server.
4. Optional: confirm the model in the **[Playground](https://console.groq.com/playground)** with model **`meta-llama/llama-4-scout-17b-16e-instruct`**.
5. API reference: **[Groq OpenAI-compatible API](https://console.groq.com/docs/openai)** — we use **`/openai/v1/chat/completions`**.

## Regenerate client after spec changes

`pnpm --filter @workspace/api-spec run codegen`
