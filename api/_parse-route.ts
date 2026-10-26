/**
 * The syllabus extraction entry point: Claude first, Gemini as the safety net.
 *
 *   1. claude-haiku-5-5 reads the PDF.
 *   2. If its answer fails validation, claude-sonnet-4-6 once.
 *   (2026-10-25: claude-sonnet-4-5 answered 404 for this key; claude-haiku-4-5
 *   cost $0.026 on a 24k-token outline. The [parse] log line carries the real
 *   token counts per extraction.)
 *   3. If that fails too, or Claude cannot be called at all (no key, auth,
 *      credits exhausted, outage, timeout), the existing Gemini path,
 *      unchanged (_parse-core.ts extractWithGemini).
 *   4. If Gemini fails, its failure is what the caller sees: the existing
 *      failure state. A Claude answer that failed validation is never returned,
 *      so a partial or guessed extraction cannot reach a student.
 *
 * An API error from Haiku goes straight to Gemini, not to Sonnet: Sonnet is for
 * an answer that was WRONG, and the same account cannot pay for Sonnet when it
 * could not pay for Haiku.
 *
 * COST LOG: one server-side line per extraction naming each model tried, its
 * token counts and time. Never the key, never the document.
 *
 * Same signature and result as before, so every caller and every error state
 * is unchanged.
 */
import { askClaude, CLAUDE_ESCALATE, CLAUDE_FIRST, type ClaudeAttempt } from './_parse-claude.js'
import { extractWithGemini, MODEL_TIMEOUT_MS, type ParseResult } from './_parse-core.js'
import { cleanParse } from './_parse-guard.js'

/** Time Gemini always keeps for itself, so falling back can still finish. */
const GEMINI_RESERVE_MS = 15_000
const SHORT_NAME: Record<string, string> = { [CLAUDE_FIRST]: 'haiku', [CLAUDE_ESCALATE]: 'sonnet' }

function logAttempts(attempts: ClaudeAttempt[], final: string): void {
  console.log(
    '[parse] ' +
      JSON.stringify({
        final,
        attempts: attempts.map((a) => ({
          model: a.model,
          ok: a.ok,
          miss: a.miss,
          status: a.status,
          problems: a.problems?.slice(0, 6),
          input_tokens: a.inputTokens,
          output_tokens: a.outputTokens,
          ms: a.ms,
        })),
      }),
  )
}

export async function extractOutline(
  buf: ArrayBuffer,
  mimeType: string,
  budgetMs: number = MODEL_TIMEOUT_MS,
): Promise<ParseResult> {
  const started = Date.now()
  const left = () => budgetMs - (Date.now() - started)
  const attempts: ClaudeAttempt[] = []

  // Claude reads PDFs only; anything else (never expected here) goes to Gemini.
  if (mimeType === 'application/pdf') {
    for (const model of [CLAUDE_FIRST, CLAUDE_ESCALATE]) {
      const room = Math.min(model === CLAUDE_FIRST ? 22_000 : 28_000, left() - GEMINI_RESERVE_MS)
      if (room < 6_000) break
      const a = await askClaude(model, buf, room)
      attempts.push(a)
      if (a.ok && a.raw) {
        const clean = cleanParse(a.raw)
        logAttempts(attempts, model)
        return {
          ok: true,
          course: clean.course,
          assessments: clean.assessments,
          how: `${SHORT_NAME[model]}:pdf:${buf.byteLength}b`,
          retried: attempts.length > 1,
          warnings: clean.warnings,
        }
      }
      if (a.miss === 'not_configured') {
        console.warn('[parse] ANTHROPIC_API_KEY is not set; using Gemini for syllabus extraction')
        break
      }
      // Only a wrong answer earns the escalation. Credits, auth, outages and
      // timeouts go to Gemini.
      if (a.miss !== 'invalid') break
    }
  }

  const gemini = await extractWithGemini(buf, mimeType, Math.max(4_000, left()))
  logAttempts(attempts, gemini.ok ? 'gemini' : `gemini-failed:${gemini.failure}`)
  if (attempts.length === 0) return gemini
  return {
    ...gemini,
    how: `gemini:${gemini.how}`.slice(0, 60),
    retried: true,
    detail: gemini.detail
      ? `${gemini.detail} (after Claude: ${attempts.map((a) => `${SHORT_NAME[a.model]} ${a.miss}`).join(', ')})`
      : undefined,
  }
}
