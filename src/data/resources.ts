/**
 * Concordia student resources: who to contact for what. Every entry was copied
 * from the official concordia.ca (or csu.qc.ca) page linked on it, checked
 * 2026-11-10. Contact details change, so each card links its source page; edit
 * here, nowhere else.
 *
 * Individual advisors are NOT copied in: names change every term. Where a
 * faculty publishes its own list, `listUrl` links straight to it.
 */
export interface Resource {
  name: string
  what: string
  url: string
  email?: string
  phone?: string
  where?: string
  hours?: string
  /** A page that lists the individual advisors with their emails. */
  listUrl?: string
  bookUrl?: string
  /** For advising: which faculty this is for, matched against the student's. */
  faculty?: 'ginacody' | 'jmsb' | 'artsci' | 'finearts'
}

export interface ResourceGroup {
  id: string
  title: string
  items: Resource[]
}

const MAIN = '514-848-2424'

export const RESOURCE_GROUPS: ResourceGroup[] = [
  {
    id: 'advising',
    title: 'Academic advising',
    items: [
      {
        faculty: 'ginacody',
        name: 'Gina Cody School: Student Academic Services',
        what: 'Engineering and Computer Science advising: course sequences, GPA, registration, overloads, transfer credits and standing. 10-minute virtual drop-ins.',
        url: 'https://www.concordia.ca/ginacody/students/academic-services.html',
        listUrl: 'https://www.concordia.ca/ginacody/students/academic-services/sas-staff.html',
        email: 'sas-front-desk@encs.concordia.ca',
        phone: `${MAIN} ext. 3055`,
        where: 'EV 2.125, 1515 St. Catherine St. W.',
        hours: 'Mon to Fri 9:00 to 12:00 and 1:00 to 4:30',
      },
      {
        faculty: 'jmsb',
        name: 'John Molson: Undergraduate Academic Advising',
        what: 'Business advising. Each program has its own advisor; write to yours from your Concordia email.',
        url: 'https://www.concordia.ca/jmsb/programs/undergraduate/bachelor/students/advising-policies/academic-advising.html',
        listUrl: 'https://www.concordia.ca/jmsb/programs/undergraduate/bachelor/students/advising-policies/academic-advising.html',
        phone: `${MAIN} ext. 2721`,
        where: 'MB 4.201, 1450 Guy St.',
        hours: 'Drop-ins Wednesdays: 10:30 to 12:30 (certificates, independent) and 1:30 to 3:00 (BComm, certificate, minor)',
      },
      {
        faculty: 'artsci',
        name: 'Arts and Science: Student Academic Services',
        what: 'Advising for Arts and Science students. First-years meet an advisor before registering.',
        url: 'https://www.concordia.ca/artsci/students/sas/advisors.html',
        email: 'sas.fas@concordia.ca',
        phone: `${MAIN} ext. 2104`,
      },
      {
        faculty: 'finearts',
        name: 'Fine Arts: Student Academic Services',
        what: 'Program requirements, requests and advising for Fine Arts students.',
        url: 'https://www.concordia.ca/finearts/academics/advising.html',
        listUrl: 'https://www.concordia.ca/finearts/about/staff.html#sas',
        email: 'finearts.sas@concordia.ca',
        phone: `${MAIN} ext. 4612`,
        where: 'EV 2.705, 1515 Ste. Catherine St. W.',
      },
      {
        name: 'Which advising office is mine?',
        what: 'Concordia’s overview that points every student to the right office.',
        url: 'https://www.concordia.ca/students/registration/advising.html',
      },
    ],
  },
  {
    id: 'records',
    title: 'Registration, fees and records',
    items: [
      {
        name: 'Birks Student Service Centre',
        what: 'The first stop for account blocks, fees, policies, and which office handles what.',
        url: 'https://www.concordia.ca/students/birks.html',
        email: 'students@concordia.ca',
        phone: `${MAIN} ext. 2668`,
        where: 'LB-185, 1400 De Maisonneuve W. (Loyola: Vanier Library, by appointment)',
        hours: 'In person Mon to Fri 10 to 4',
        bookUrl: 'https://outlook.office365.com/owa/calendar/BirksStudentServiceCentre@liveconcordia.onmicrosoft.com/bookings/',
      },
      {
        name: 'Student Hub',
        what: 'Your class schedule, registration, Moodle and My CU Account (fees).',
        url: 'https://www.concordia.ca/students.html',
      },
      {
        name: 'Term dates and deadlines',
        what: 'DNE (drop with a full refund) and DISC (withdraw, fees owed) dates for every term.',
        url: 'https://www.concordia.ca/students/registration/term-dates-deadlines.html',
      },
      {
        name: 'Exam dates',
        what: 'Exam periods and important exam dates.',
        url: 'https://www.concordia.ca/students/exams/important-dates.html',
      },
    ],
  },
  {
    id: 'learning',
    title: 'Learning, writing and careers',
    items: [
      {
        name: 'Student Success Centre',
        what: 'Learning support: workshops, help in math, economics and science, learning specialists, and help if you are in failed standing.',
        url: 'https://www.concordia.ca/students/success.html',
        phone: `${MAIN} ext. 3921`,
        where: 'H-745 (SGW)',
        hours: 'Mon to Fri 9 to 5',
      },
      {
        name: 'Writing Centre',
        what: 'Free help with any assignment, in English or French: 50-minute appointments, written feedback and drop-ins.',
        url: 'https://www.concordia.ca/students/success/learning-support/writing-assistance.html',
        email: 'learning@concordia.ca',
        phone: `${MAIN} ext. 3921`,
        where: 'H-763 (SGW), AD-103 (Loyola)',
        bookUrl: 'https://concordia-ssc.libcal.com/appointments/writingcentre',
      },
      {
        name: 'Career Planning',
        what: 'Career counselling, résumés and interviews, the job bank and job fairs.',
        url: 'https://www.concordia.ca/students/success/career-planning.html',
        email: 'careerservices@concordia.ca',
        phone: `${MAIN} ext. 7345`,
        where: 'H-745 (SGW)',
      },
      {
        name: 'Co-op and Experiential Learning',
        what: 'Paid co-op work terms built into your program.',
        url: 'https://www.concordia.ca/academics/co-op.html',
        email: 'communication.coop@concordia.ca',
        phone: `${MAIN} ext. 3950`,
        where: 'GM-430, 1550 De Maisonneuve W.',
      },
      {
        name: 'Library: Ask a Librarian',
        what: 'Research help by chat, email, phone or at the desk.',
        url: 'https://library.concordia.ca/help/questions/',
        email: 'lib-AskALibrarian@concordia.ca',
        phone: `${MAIN} ext. 7777`,
      },
    ],
  },
  {
    id: 'health',
    title: 'Health, wellbeing and accessibility',
    items: [
      {
        name: 'Access Centre for Students with Disabilities',
        what: 'Academic and exam accommodations.',
        url: 'https://www.concordia.ca/students/accessibility.html',
        email: 'acsdinfo@concordia.ca',
        phone: `${MAIN} ext. 3525`,
        where: 'GM-300',
        hours: 'Mon to Fri 9 to 5',
      },
      {
        name: 'Mental health and counselling',
        what: 'Mental health intake, counselling and single-session appointments. Campus emergency: 514-848-3717.',
        url: 'https://www.concordia.ca/health/mental-health/services.html',
        email: 'mhe.info@concordia.ca',
        phone: `${MAIN} ext. 6630`,
      },
      {
        name: 'Health Services clinic',
        what: 'Medical appointments and walk-ins.',
        url: 'https://www.concordia.ca/health/medical/clinic.html',
        phone: `${MAIN} ext. 3565 (SGW), 3575 (Loyola)`,
        where: 'GM-200 (SGW)',
      },
    ],
  },
  {
    id: 'money',
    title: 'Money and international students',
    items: [
      {
        name: 'Financial Aid and Awards',
        what: 'Government aid, bursaries, scholarships and awards.',
        url: 'https://www.concordia.ca/students/financial.html',
        email: 'fundingyoureducation@concordia.ca',
        phone: `${MAIN} ext. 3507`,
        where: 'GM-230',
      },
      {
        name: 'International Students Office',
        what: 'Immigration documents, health insurance and advising.',
        url: 'https://www.concordia.ca/students/international.html',
        email: 'iso@concordia.ca',
        phone: `${MAIN} ext. 3515`,
        where: 'GM-330',
        hours: 'Mon to Fri 9 to 5',
      },
    ],
  },
  {
    id: 'help',
    title: 'Getting help with a problem',
    items: [
      {
        name: 'Ombuds Office',
        what: 'Confidential, impartial help with a university problem or complaint.',
        url: 'https://www.concordia.ca/offices/ombuds.html',
        email: 'ombuds@concordia.ca',
        phone: `${MAIN} ext. 8658`,
      },
      {
        name: 'CSU Advocacy Centre',
        what: 'Independent, confidential support with misconduct charges, disputes with instructors and formal complaints.',
        url: 'https://www.csu.qc.ca/services/advocacy-4',
        phone: '514-848-7474 ext. 7313',
        where: 'H-222 (SGW)',
      },
      {
        name: 'Rights and Responsibilities',
        what: 'Advice on concerns about someone’s behaviour under the Code of Rights and Responsibilities.',
        url: 'https://www.concordia.ca/conduct/behavioural-integrity/rights-responsibilities.html',
        email: 'rights@concordia.ca',
        phone: `${MAIN} ext. 8659`,
      },
      {
        name: 'IT Service Desk',
        what: 'Accounts, Wi-Fi, email and software.',
        url: 'https://www.concordia.ca/it/support.html',
        email: 'help@concordia.ca',
        phone: `${MAIN} ext. 7613`,
      },
    ],
  },
  {
    id: 'new',
    title: 'New to Concordia',
    items: [
      {
        name: 'Welcome Crew and orientation',
        what: 'Upper-year students who answer new students’ questions, and orientation information.',
        url: 'https://www.concordia.ca/students/new.html',
        email: 'new@concordia.ca',
        phone: `${MAIN} ext. 7369`,
        where: 'H-757 (SGW)',
      },
      {
        name: 'Student Life and Engagement',
        what: 'Clubs, student groups and life outside class.',
        url: 'https://www.concordia.ca/students/life/dean-of-students.html',
        email: 'studentlife@concordia.ca',
        phone: `${MAIN} ext. 3517`,
      },
      {
        name: 'Shuttle bus',
        what: 'Free shuttle between SGW and Loyola; show your student ID.',
        url: 'https://www.concordia.ca/maps/shuttle-bus.html',
        email: 'shuttle@concordia.ca',
      },
    ],
  },
]

/** Which advising card is the student's, from their faculty or program text. */
export function facultyKey(text: string | null | undefined): Resource['faculty'] | null {
  const t = (text ?? '').toLowerCase()
  if (/gina cody|engineering|computer science|software|bcompsc|beng/.test(t)) return 'ginacody'
  if (/john molson|jmsb|commerce|bcomm|business|finance|accountancy|marketing/.test(t)) return 'jmsb'
  if (/fine arts|design|music|film|theatre|studio art|art history|computation arts/.test(t)) return 'finearts'
  if (/arts and science|arts & science|science|psychology|economics|political|history|english|sociology|biology|chemistry|physics|math/.test(t)) return 'artsci'
  return null
}
