/**
 * Canonical Concordia undergraduate program registry — the single source of
 * truth for the program picker (onboarding + Settings). Validated against
 * Concordia's official faculty finders (June 2026); 162 programs.
 *
 * The profile stores the program's stable `id` (NOT a free-typed string) so the
 * data is structured + filterable later (e.g. program-relevant Community
 * content). `name`/`credential`/`category` are reference metadata. Lines that
 * carry multiple credentials (e.g. "Psychology (BA, BSc)") are ONE entry with
 * the credentials as a string — students think "Psychology," not "Psychology-BA".
 *
 * IDs are a deterministic slug of name + credential, so same-named programs in
 * different degrees stay distinct (economics-ba vs economics-bcomm). Treat the
 * slug function as frozen — changing it would orphan stored selections.
 */

export type ProgramCategory =
  | 'standard'
  | 'engineering-cs'
  | 'certificate-minor'
  | 'microprogram'
  | 'indigenous-bridging'

export interface Program {
  /** Stable canonical id (the value stored on the profile). */
  id: string
  /** Display name. */
  name: string
  /** Degree/credential(s), e.g. "BA", "BSc", "BA, BSc", "Cert", "Minor". */
  credential: string
  category: ProgramCategory
  /** Optional search aliases (abbreviations / alternate spellings). */
  keywords?: string[]
}

/** The escape hatch — always selectable so no one is ever blocked. */
export const OTHER_PROGRAM_ID = 'other'

function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritics (é -> e)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

type Row = [name: string, credential: string, keywords?: string[]]

function build(category: ProgramCategory, rows: Row[]): Program[] {
  return rows.map(([name, credential, keywords]) => ({
    id: `${slug(name)}-${slug(credential)}`,
    name,
    credential,
    category,
    keywords,
  }))
}

const STANDARD = build('standard', [
  ['Accountancy', 'BComm', ['accounting']],
  ['Acting for the Theatre', 'BFA', ['theatre', 'drama']],
  ['Actuarial Mathematics', 'BA, BSc'],
  ['Actuarial Mathematics/Finance', 'BA, BSc'],
  ['Anthropology', 'BA'],
  ['Anthropology and Sociology', 'BA'],
  ['Art Education – Visual Arts', 'BFA'],
  ['Art History', 'BFA'],
  ['Art History and Film Studies', 'BFA'],
  ['Art History and Studio Art', 'BFA'],
  ['Athletic Therapy', 'BSc'],
  ['Biochemistry', 'BSc'],
  ['Biology', 'BSc', ['bio']],
  ['Business Technology Management', 'BComm', ['btm']],
  ['Cell and Molecular Biology', 'BSc'],
  ['Ceramics', 'BFA'],
  ['Chemistry', 'BSc'],
  ['Child Studies', 'BA'],
  ['Classics', 'BA'],
  ['Communication and Cultural Studies', 'BA'],
  ['Communication Studies', 'BA', ['comm', 'comms']],
  ['Community, Public Affairs and Policy Studies', 'BA', ['cpaps']],
  ['Computation Arts', 'BFA'],
  ['Computation Arts - Computer Science', 'BFA'],
  ['Contemporary Dance', 'BFA', ['dance']],
  ['Creative Writing', 'BA'],
  ['Data Science', 'BA/BSc'],
  ['Design', 'BFA'],
  ['Early Childhood and Elementary Education', 'BA'],
  ['Ecology', 'BSc'],
  ['Economics', 'BA', ['econ']],
  ['Economics', 'BComm', ['econ']],
  ['Electroacoustic Studies', 'BFA'],
  ['English and Creative Writing', 'BA'],
  ['English and History', 'BA'],
  ['English Literature', 'BA', ['english']],
  ['Environmental and Sustainability Science', 'BSc'],
  ['Environmental Geography', 'BSc'],
  ['French Studies / Études françaises', 'BA, Cert', ['francais']],
  ['Exercise Science', 'BSc'],
  ['Fibres and Material Practices', 'BFA'],
  ['Film and Moving Image Studies', 'BFA'],
  ['Film Animation', 'BFA'],
  ['Film Production', 'BFA'],
  ['Finance', 'BComm'],
  ['First Peoples Studies', 'BA'],
  ['History', 'BA'],
  ['Human Environment', 'BA'],
  ['Human Relations', 'BA'],
  ['Human Resource Management', 'BComm', ['hr', 'hrm']],
  ['Interdisciplinary Studies in Sexuality', 'BA'],
  ['Intermedia (Video, Performance and Electronic Arts)', 'BFA'],
  ['International Business', 'BComm'],
  ['Irish Studies', 'BA, Cert'],
  ['Italian', 'BA'],
  ['Jazz Studies', 'BFA'],
  ['Journalism', 'BA'],
  ['Judaic Studies', 'BA'],
  ['Kinesiology and Clinical Exercise Physiology', 'BSc', ['kinesiology']],
  ['Liberal Arts', 'BA'],
  ['Linguistics', 'BA'],
  ['Management', 'BComm'],
  ['Marketing', 'BComm'],
  ['Mathematical and Computational Finance', 'BA, BSc'],
  ['Mathematics and Statistics', 'BA, BSc', ['math', 'maths']],
  ['Music', 'BFA'],
  ['Neuroscience', 'BSc'],
  ['Painting and Drawing', 'BFA'],
  ['Performance Creation', 'BFA'],
  ['Philosophy', 'BA', ['phil']],
  ['Photography', 'BFA'],
  ['Physics', 'BSc'],
  ['Political Science', 'BA', ['poli sci', 'polisci']],
  ['Print Media', 'BFA'],
  ['Psychology', 'BA, BSc', ['psych']],
  ['Pure and Applied Mathematics', 'BA, BSc', ['math']],
  ['Recreation and Leisure Studies', 'BA'],
  ['Religions and Cultures', 'BA'],
  ['Scenography', 'BFA'],
  ['Sculpture', 'BFA'],
  ['Sociology', 'BA', ['socio']],
  ['Southern Asia Studies', 'BA'],
  ['Spanish, Hispanic Cultures and Literatures', 'BA', ['spanish']],
  ['Statistics', 'BA, BSc', ['stats']],
  ['Studio Art', 'BFA'],
  ['Supply Chain Operations Management', 'BComm', ['scom', 'supply chain']],
  ['Systems and Information Biology', 'BSc'],
  ['Teaching English as a Second Language (TESL)', 'BEd', ['tesl', 'esl']],
  ['Theological Studies', 'BA'],
  ['Therapeutic Recreation', 'BA'],
  ['Traduction (Translation)', 'BA', ['translation']],
  ['Urban Planning and Urban Studies', 'BA'],
  ["Women's Studies", 'BA, Cert'],
])

const ENGINEERING_CS = build('engineering-cs', [
  ['Aerospace Engineering', 'BEng'],
  ['Building Engineering', 'BEng'],
  ['Chemical Engineering', 'BEng'],
  ['Civil Engineering', 'BEng'],
  ['Computer Engineering', 'BEng', ['ce', 'coen']],
  ['Computer Science', 'BCompSc', ['cs', 'compsci', 'comp sci']],
  ['Computer Science - Computation Arts', 'BCompSc'],
  ['Cybersecurity', 'BSc', ['cyber', 'security']],
  ['Cybersecurity Engineering', 'BEng', ['cyber']],
  ['Data Science', 'BCompSc'],
  ['Electrical Engineering', 'BEng', ['ee']],
  ['Health and Life Sciences', 'BCompSc'],
  ['Industrial Engineering', 'BEng'],
  ['Mechanical Engineering', 'BEng', ['mech']],
  ['Software Engineering', 'BEng', ['soen', 'swe']],
])

const CERTIFICATE_MINOR = build('certificate-minor', [
  ['Accountancy', 'Cert'],
  ['Adult Education', 'Minor, Cert'],
  ['Arts and Science', 'Cert'],
  ['Assurance, Fraud Prevention and Investigative Services', 'Minor'],
  ['Biophysics', 'Minor'],
  ['Black and African Diaspora Studies in the Canadian Context', 'Minor, Cert'],
  ['Business Studies', 'Minor, Cert'],
  ['Community and Organizational Leadership', 'Cert'],
  ['Computer Science', 'Minor'],
  ['Data Intelligence', 'Minor'],
  ['Diversity and the Contemporary World', 'Minor'],
  ['Education', 'Minor'],
  ['Entrepreneurship', 'Minor'],
  ['Ethics and Values', 'Minor'],
  ['Family Life Education', 'Cert'],
  ['Financial Reporting', 'Minor'],
  ['Foundations for Business', 'Cert'],
  ['Game Design', 'Minor'],
  ['Geospatial Technologies', 'Minor, Cert'],
  ['German Studies', 'Minor'],
  ['Human Rights Studies', 'Minor'],
  ['Immigration Studies', 'Minor, Cert'],
  ['Information Systems Audit and Risk Management', 'Minor'],
  ['Israel Studies', 'Minor'],
  ['Law and Society', 'Minor'],
  ['Modern Arabic Language and Culture', 'Minor, Cert', ['arabic']],
  ['Modern Chinese Language and Culture', 'Minor, Cert', ['chinese', 'mandarin']],
  ['Multidisciplinary Studies in Science', 'Minor'],
  ['Pastoral Care', 'Cert'],
  ['Professional Writing', 'Minor'],
  ['Quantitative Finance and Insurance', 'Minor'],
  ['Real Estate', 'Minor'],
  ['Science and Technology', 'Cert'],
  ['Science Foundations', 'Cert'],
  ['Science Journalism', 'Minor'],
  ['Sustainability Studies', 'Minor'],
  ['Teaching English as a Second Language', 'Cert', ['tesl', 'esl']],
  ['Theatre', 'Minor'],
])

const MICROPROGRAM = build('microprogram', [
  ['Computational Physics', 'Microprogram'],
  ['Economic Policy', 'Microprogram'],
  ['Fundamentals of Digital Filmmaking', 'Microprogram'],
  ['Indigenous Land-Based Education', 'Microprogram'],
  ['Innovation Mindset', 'Microprogram'],
  ['Jewish Studies', 'Microprogram'],
  ['Religious, Cultural and Ethnic Literacy', 'Microprogram'],
  ['Screenwriting and Film Producing', 'Microprogram'],
  ['Songwriting and Music Production', 'Microprogram'],
  ['Sustainability Principles', 'Microprogram'],
  ['Web Design and User Interface', 'Microprogram', ['ui', 'web design']],
])

const INDIGENOUS_BRIDGING = build('indigenous-bridging', [
  ['Indigenous Bridging Program', 'BComm'],
  ['Indigenous Bridging Program', 'BEng'],
  ['Indigenous Bridging Program', 'BSc'],
  ['Indigenous Bridging Program', 'Journalism BA'],
  ['Indigenous Bridging Program', 'Psychology BA'],
])

export const PROGRAMS: Program[] = [
  ...STANDARD,
  ...ENGINEERING_CS,
  ...CERTIFICATE_MINOR,
  ...MICROPROGRAM,
  ...INDIGENOUS_BRIDGING,
]

const BY_ID = new Map(PROGRAMS.map((p) => [p.id, p]))

export function programById(id: string | null | undefined): Program | undefined {
  return id ? BY_ID.get(id) : undefined
}

/** "Computer Science · BCompSc" — the display form used in lists + the field. */
export function programLabel(p: Program): string {
  return `${p.name} · ${p.credential}`
}

/**
 * Token-AND search over name + credential + keywords. Every whitespace token in
 * the query must match somewhere, so "comp sci" and "cs" both find Computer
 * Science. Ranked: name-prefix > word-boundary > anywhere. Capped by `limit`.
 */
export function searchPrograms(query: string, limit = 8): Program[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const tokens = q.split(/\s+/)
  const scored: { p: Program; score: number }[] = []
  for (const p of PROGRAMS) {
    const hay = `${p.name} ${p.credential} ${(p.keywords ?? []).join(' ')}`.toLowerCase()
    if (!tokens.every((t) => hay.includes(t))) continue
    const name = p.name.toLowerCase()
    const score = name.startsWith(q) ? 0 : new RegExp(`\\b${escapeRe(q)}`).test(name) ? 1 : 2
    scored.push({ p, score })
  }
  scored.sort((a, b) => a.score - b.score || a.p.name.localeCompare(b.p.name))
  return scored.slice(0, limit).map((s) => s.p)
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
