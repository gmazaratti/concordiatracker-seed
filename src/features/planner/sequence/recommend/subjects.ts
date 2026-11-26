/**
 * Areas a student can say they are into, or not. Each is one Concordia subject
 * code, named the way a student would say it. A short, deliberate list: the
 * point is a quick "more of this, none of that", not the whole calendar.
 */
export const INTERESTS: { subject: string; label: string }[] = [
  { subject: 'FINA', label: 'Finance' },
  { subject: 'MARK', label: 'Marketing' },
  { subject: 'MANA', label: 'Management' },
  { subject: 'ACCO', label: 'Accounting' },
  { subject: 'ECON', label: 'Economics' },
  { subject: 'BTM', label: 'Business technology' },
  { subject: 'SCOM', label: 'Supply chain' },
  { subject: 'IBUS', label: 'International business' },
  { subject: 'COMP', label: 'Computer science' },
  { subject: 'SOEN', label: 'Software engineering' },
  { subject: 'MATH', label: 'Math' },
  { subject: 'STAT', label: 'Statistics' },
  { subject: 'PHYS', label: 'Physics' },
  { subject: 'CHEM', label: 'Chemistry' },
  { subject: 'BIOL', label: 'Biology' },
  { subject: 'EXCI', label: 'Health and exercise' },
  { subject: 'PSYC', label: 'Psychology' },
  { subject: 'SOCI', label: 'Sociology' },
  { subject: 'POLI', label: 'Politics' },
  { subject: 'HIST', label: 'History' },
  { subject: 'PHIL', label: 'Philosophy' },
  { subject: 'RELI', label: 'Religions' },
  { subject: 'ENGL', label: 'Literature and writing' },
  { subject: 'COMS', label: 'Communication' },
  { subject: 'JOUR', label: 'Journalism' },
  { subject: 'FMST', label: 'Film' },
  { subject: 'ARTH', label: 'Art history' },
  { subject: 'MUSI', label: 'Music' },
  { subject: 'GEOG', label: 'Geography and environment' },
  { subject: 'EDUC', label: 'Education' },
  { subject: 'FRAN', label: 'French' },
]

export const interestLabel = (subject: string) => INTERESTS.find((i) => i.subject === subject)?.label ?? subject
