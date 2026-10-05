/**
 * Concordia's 4.30 letter scale, in its own file with no imports.
 *
 * Shared by the GPA maths (gpa.ts) and the build script that writes the public
 * GPA calculator page as plain HTML (docs-src/agent-pages.mjs). Node runs that
 * script without a bundler and cannot follow gpa.ts's imports, so the table
 * lives here where both can read it, and the page can never show a scale the
 * calculator does not use.
 *
 * Letter to grade points is Concordia's. Percentage cutoffs follow the common
 * undergraduate mapping; each course outline sets its own, so they vary.
 */
export interface GradeBand {
  min: number
  letter: string
  points: number
}

export const GRADE_SCALE: GradeBand[] = [
  { min: 90, letter: 'A+', points: 4.3 },
  { min: 85, letter: 'A', points: 4.0 },
  { min: 80, letter: 'A-', points: 3.7 },
  { min: 77, letter: 'B+', points: 3.3 },
  { min: 73, letter: 'B', points: 3.0 },
  { min: 70, letter: 'B-', points: 2.7 },
  { min: 67, letter: 'C+', points: 2.3 },
  { min: 63, letter: 'C', points: 2.0 },
  { min: 60, letter: 'C-', points: 1.7 },
  { min: 57, letter: 'D+', points: 1.3 },
  { min: 53, letter: 'D', points: 1.0 },
  { min: 50, letter: 'D-', points: 0.7 },
  { min: 0, letter: 'F', points: 0.0 },
]
