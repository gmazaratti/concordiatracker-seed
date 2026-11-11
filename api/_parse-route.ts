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
import { askClaude, CLAUDE_ESCALATE, CLAUDE_FIRST, type ClaudeAttempt, type ClaudeInput } from './_parse-claude.js'
import { extractWithGemini, MODEL_TIMEOUT_MS, type ParseResult } from './_parse-core.js'
import { cleanParse } from './_parse-guard.js'
import { docText, docxText, sniffUpload } from './_upload-kind.js'

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
  /** `backup`: the student asked for the other AI, so Claude is skipped. */
  opts: { backup?: boolean } = {},
): Promise<ParseResult> {
  const started = Date.now()
  const left = () => budgetMs - (Date.now() - started)
  const attempts: ClaudeAttempt[] = []

  // WHAT IT IS comes from the bytes, not from `mimeType` (kept for the old
  // signature). A Word or text file is turned into text here, once, and both
  // models read that text; a PDF or a photo goes to them as the file itself.
  const sniffed = sniffUpload(new Uint8Array(buf))
  if (sniffed.kind === 'unsupported') {
    return { ok: false, course: {}, assessments: [], how: 'unsupported', failure: 'unreadable', detail: sniffed.why }
  }
  void mimeType
  let text: string | undefined
  if (sniffed.kind === 'docx') text = docxText(new Uint8Array(buf))
  if (sniffed.kind === 'doc') text = docText(new Uint8Array(buf))
  if (sniffed.kind === 'text') text = new TextDecoder().decode(buf)
  if (text !== undefined && text.trim().length < 40) {
    return { ok: false, course: {}, assessments: [], how: `${sniffed.kind}:empty`, failure: 'unreadable', detail: 'no readable text in the file' }
  }
  const input: ClaudeInput =
    text !== undefined
      ? { kind: 'text', text }
      : sniffed.kind === 'image'
        ? { kind: 'image', buf, mime: sniffed.mime }
        : { kind: 'pdf', buf }
  const tag = text !== undefined ? `${sniffed.kind}:${text.length}ch` : `${sniffed.kind}:${buf.byteLength}b`

  if (!opts.backup) {
    for (const model of [CLAUDE_FIRST, CLAUDE_ESCALATE]) {
      const room = Math.min(model === CLAUDE_FIRST ? 22_000 : 28_000, left() - GEMINI_RESERVE_MS)
      if (room < 6_000) break
      const a = await askClaude(model, input, room)
      attempts.push(a)
      if (a.ok && a.raw) {
        const clean = cleanParse(a.raw)
        logAttempts(attempts, model)
        return {
          ok: true,
          course: clean.course,
          assessments: clean.assessments,
          how: `${SHORT_NAME[model]}:${tag}`,
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
      // No course code AND no assessments: the file is very likely not a
      // syllabus (a link page, a cover sheet). Sonnet costs five times an
      // ordinary scan to say the same thing, so Gemini gets the last look.
      // With a course code present, Sonnet still runs.
      if (a.problems?.includes('missing_course_code') && a.problems.includes('no_assessments')) break
    }
  }

  const gemini = await extractWithGemini(buf, sniffed.mime, Math.max(4_000, left()), text)
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
