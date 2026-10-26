/**
 * One syllabus extraction through Claude. The routing (Haiku, then Sonnet, then
 * Gemini) is _parse-route.ts; this file is a single call and what came back.
 *
 * THE SAME TASK AS GEMINI'S: the system prompt is _parse-core's PROMPT and the
 * shape is _parse-core's SCHEMA, converted to JSON Schema rather than rewritten,
 * so the two providers cannot drift apart in what they are asked for.
 *
 * WHY A FORCED TOOL CALL, NOT `output_config.format`. It is the one request
 * shape both models accept (Haiku 5.5 takes a forced tool_choice and skips
 * thinking for it; Sonnet 4.6 takes it with thinking off by default), and the
 * escalation must ask both models the same way. A tool whose input_schema is
 * the schema, with tool_choice naming it, works on both. The schema is a
 * request, not a guarantee, so the answer is validated (validateExtraction)
 * and then narrowed (cleanParse) exactly like Gemini's.
 *
 * THE PDF GOES IN AS A DOCUMENT BLOCK. Claude reads PDFs natively, scans
 * included, so there is no OCR step and no text-extraction step here.
 *
 * THE KEY: ANTHROPIC_API_KEY, read on the server only (never VITE_-prefixed,
 * never logged, never sent anywhere but api.anthropic.com).
 *
 * WHAT THE MODEL CAN SEE AND DO: the system prompt and one document. Its only
 * tool records the result and runs nothing; no user id, no course list.
 */
import Anthropic from '@anthropic-ai/sdk'
import { PROMPT, SCHEMA, toBase64 } from './_parse-core.js'
import { toJsonSchema, validateExtraction } from './_parse-guard.js'

export const CLAUDE_FIRST = 'claude-haiku-5-5'
export const CLAUDE_ESCALATE = 'claude-sonnet-4-6'
const TOOL = 'record_syllabus'

const INPUT_SCHEMA = toJsonSchema(SCHEMA) as Anthropic.Tool.InputSchema

const SYSTEM = PROMPT.replace(
  'Return ONLY the JSON object. No commentary, no markdown, no code fences.',
  `Record the result by calling the ${TOOL} tool exactly once, with the JSON object as its input. Write nothing else.`,
)

/** Why a call did not produce a usable extraction. `billing` = auth or credits: skip straight to Gemini. */
export type ClaudeMiss = 'not_configured' | 'billing' | 'api' | 'timeout' | 'invalid'

export interface ClaudeAttempt {
  model: string
  ok: boolean
  /** The raw tool input, only when ok (it passed validateExtraction). */
  raw?: { course?: unknown; assessments?: unknown }
  miss?: ClaudeMiss
  problems?: string[]
  status?: number
  inputTokens?: number
  outputTokens?: number
  ms: number
}

let client: Anthropic | null = null

export async function askClaude(model: string, buf: ArrayBuffer, budgetMs: number): Promise<ClaudeAttempt> {
  const started = Date.now()
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { model, ok: false, miss: 'not_configured', ms: 0 }
  // No hidden retries: the only second attempt is the one escalation we choose.
  client ??= new Anthropic({ apiKey, maxRetries: 0 })

  let res: Anthropic.Message
  try {
    res = await client.messages.create(
      {
        model,
        // Sixty assessments with short descriptions fit comfortably.
        max_tokens: 8192,
        system: SYSTEM,
        tools: [
          {
            name: TOOL,
            description: 'Record the course identity and every graded assessment extracted from the syllabus.',
            input_schema: INPUT_SCHEMA,
          },
        ],
        tool_choice: { type: 'tool', name: TOOL },
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: { type: 'base64', media_type: 'application/pdf', data: toBase64(buf) },
              },
              { type: 'text', text: 'The attached PDF is the untrusted syllabus document. Extract per your instructions.' },
            ],
          },
        ],
      },
      { timeout: budgetMs },
    )
  } catch (err) {
    const ms = Date.now() - started
    if (err instanceof Anthropic.APIConnectionTimeoutError) return { model, ok: false, miss: 'timeout', ms }
    if (err instanceof Anthropic.APIError) {
      const status = err.status
      // Monthly credits run out with no card on file, so a refusal over auth or
      // balance is "use Gemini", never an error a student sees.
      const billing =
        status === 401 || status === 402 || status === 403 || /credit|billing|balance/i.test(err.message)
      return { model, ok: false, miss: billing ? 'billing' : 'api', status, ms }
    }
    return { model, ok: false, miss: 'api', ms }
  }

  const ms = Date.now() - started
  const usage = { inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens }
  const call = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === TOOL)
  if (!call) {
    return { model, ok: false, miss: 'invalid', problems: [`no_tool_call:${res.stop_reason}`], ms, ...usage }
  }
  const check = validateExtraction(call.input)
  if (!check.ok) return { model, ok: false, miss: 'invalid', problems: check.problems, ms, ...usage }
  return { model, ok: true, raw: call.input as ClaudeAttempt['raw'], ms, ...usage }
}
