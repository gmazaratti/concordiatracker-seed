/**
 * Outline text → a structured assessment scheme.
 *
 * Same model and the same discipline as /api/parse-syllabus, with two
 * differences that matter for the scraper:
 *
 *   1. It is handed TEXT, not the PDF. We already extracted the text to decide
 *      whether the document was readable at all, and sending 500KB of PDF back
 *      over the wire to learn the same thing again is waste.
 *   2. It is told, in the prompt AND checked by the caller, that the weights
 *      must total 100. A scraped scheme goes out under a verified badge; one
 *      that does not add up is one we read wrong, and the caller drops it
 *      rather than publishing wrong numbers a student would trust.
 *
 * DATES ARE NEVER INFERRED. "Week 4" is not a date, and a term that started on
 * a day we are guessing at is how an outline ends up telling somebody their
 * midterm is on the wrong Tuesday. Only an explicit calendar date is taken.
 */
const MODEL = 'gemini-2.5-flash'

export interface ExtractedItem {
  title: string
  kind: 'assignment' | 'quiz' | 'midterm' | 'final' | 'lab' | 'reading' | 'project'
  weight: number | null
  /** ISO date or datetime, or null. Never a guess. */
  due: string | null
}

export interface Extracted {
  items: ExtractedItem[]
  professor?: string
  professorEmail?: string
  section?: string
  /** The term the DOCUMENT claims, which is the sanity check on the listing. */
  term?: string
}

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    professor: { type: 'STRING' },
    professorEmail: { type: 'STRING' },
    section: { type: 'STRING' },
    term: { type: 'STRING' },
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          kind: {
            type: 'STRING',
            enum: ['assignment', 'quiz', 'midterm', 'final', 'lab', 'reading', 'project'],
          },
          weight: { type: 'NUMBER', nullable: true },
          due: { type: 'STRING', nullable: true },
        },
        required: ['title', 'kind'],
      },
    },
  },
  required: ['items'],
}

function prompt(code: string, term: string, text: string): string {
  return `You are reading the text of a Concordia University course outline${
    code ? ` for ${code}` : ''
  }${term ? `, ${term}` : ''}. Extract its GRADED ASSESSMENT SCHEME.

Rules:
- One entry per graded item. If the outline gives a band for several items
  ("Online quizzes (4) 10%"), emit one entry PER ITEM, splitting the weight
  evenly and adjusting the last so the total is exact.
- weight: the percent of the final grade as a number. THE WEIGHTS MUST TOTAL
  EXACTLY 100. If the document contradicts itself, trust the evaluation TABLE
  over the surrounding prose, because the table is the one that adds up.
- due: ONLY an explicit calendar date from the document, as ISO (YYYY-MM-DD, or
  with a time when one is stated). "TBA", "see the exam schedule", "week 4" and
  anything you would have to calculate → null. Never guess a date.
- Times are Montreal local. Keep the outline's own time; do not convert.
- title: what the outline calls it. Where a rule changes what a student should
  do — a minimum mark required on the final, say — put it in the title, because
  a note nobody reads does not.
- professor / professorEmail / section / term: copy from the document if
  present, empty string if not. Never invent contact details.

Return ONLY the JSON object.

--- OUTLINE TEXT ---
${text}`
}

/** The outline text is long and the schedule table is usually in the first
 *  half; 60k characters is comfortably the whole document for every outline
 *  measured (largest was ~34k) while bounding a pathological one. */
const MAX_CHARS = 60_000

export async function extractOutline(
  text: string,
  code: string,
  term: string,
): Promise<Extracted> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set')

  const body = prompt(code, term, text.slice(0, MAX_CHARS))
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: body }] }],
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json',
          responseSchema: SCHEMA,
        },
      }),
    },
  )
  if (!r.ok) throw new Error(`model ${r.status}: ${(await r.text()).slice(0, 200)}`)

  const payload = (await r.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[]
  }
  const raw = payload.candidates?.[0]?.content?.parts?.[0]?.text
  if (!raw) throw new Error('model returned nothing')

  const parsed = JSON.parse(raw) as Extracted
  return {
    items: (parsed.items ?? []).map((i) => ({
      title: String(i.title ?? '').slice(0, 200),
      kind: i.kind ?? 'assignment',
      weight: typeof i.weight === 'number' ? i.weight : null,
      due: i.due ? String(i.due) : null,
    })),
    professor: parsed.professor || undefined,
    professorEmail: parsed.professorEmail || undefined,
    section: parsed.section || undefined,
    term: parsed.term || undefined,
  }
}
