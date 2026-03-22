/** Groq OpenAI-compatible chat completions (server-side only). */
export const GROQ_CHAT_COMPLETIONS_URL = "https://api.groq.com/openai/v1/chat/completions";

/** Default model for DM story assistance (see Groq model list in console). */
export const GROQ_DM_STORY_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

const DM_STORY_SYSTEM = `You are a tabletop RPG assistant for a Dungeon Master using TavernOS (D&D 5e style).
Help with scene narration, NPC dialogue and mannerisms, consequences of player actions, pacing, and brainstorming.
When campaign/session context is provided, stay consistent with it and do not contradict established facts.
Do not dump raw JSON; write clear prose the DM can read aloud or adapt at the table.
Keep answers concise unless the DM asks for more detail.`;

const VARIANT_MODE_SUFFIX = `

VARIANT MODE: Your reply MUST contain exactly three complete alternatives for table narration, in this exact structure:
**Variant A**
(first full passage)
**Variant B**
(second full passage)
**Variant C**
(third full passage)
Do not add text before **Variant A** or after the third passage.`;

export type GroqChatMessage = { role: "system" | "user" | "assistant"; content: string };

type GroqCompletionResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
};

export async function runDmStoryAssistant(params: {
  apiKey: string;
  userMessage: string;
  /** Optional session narrative from loadSessionForAI (already formatted text). */
  sessionContextText?: string;
  /** Prior turns (planning / Ask mode). */
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
  responseStyle?: "single" | "variants";
}): Promise<{ reply: string; model: string }> {
  const systemContent =
    params.responseStyle === "variants" ? DM_STORY_SYSTEM + VARIANT_MODE_SUFFIX : DM_STORY_SYSTEM;
  const messages: GroqChatMessage[] = [{ role: "system", content: systemContent }];

  if (params.sessionContextText) {
    messages.push({
      role: "user",
      content: `--- Session & campaign context (reference only) ---\n${params.sessionContextText}\n--- End context ---`,
    });
  }

  const history = params.conversationHistory ?? [];
  for (const turn of history) {
    if (turn.role !== "user" && turn.role !== "assistant") continue;
    const c = typeof turn.content === "string" ? turn.content.trim() : "";
    if (!c) continue;
    messages.push({ role: turn.role, content: c });
  }

  messages.push({ role: "user", content: params.userMessage });

  const maxTokens = params.responseStyle === "variants" ? 4096 : 2048;

  const res = await fetch(GROQ_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_DM_STORY_MODEL,
      messages,
      max_tokens: maxTokens,
      temperature: 0.75,
    }),
  });

  const rawText = await res.text();
  let data: GroqCompletionResponse;
  try {
    data = JSON.parse(rawText) as GroqCompletionResponse;
  } catch {
    throw new Error(`Groq returned non-JSON (HTTP ${res.status})`);
  }

  if (!res.ok) {
    const hint = data.error?.message || rawText.slice(0, 400);
    throw new Error(`Groq API HTTP ${res.status}: ${hint}`);
  }

  const reply = data.choices?.[0]?.message?.content?.trim();
  if (!reply) {
    throw new Error("Groq returned an empty reply");
  }

  return { reply, model: GROQ_DM_STORY_MODEL };
}
