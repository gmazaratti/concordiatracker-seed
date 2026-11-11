import type { Resource } from './resources'

/**
 * The advisors each faculty names on its own public advising page, copied on
 * 2026-11-11. People change every term, so every list links the page it came
 * from and the page is the authority, not this file.
 *
 * Portraits are only set where the faculty publishes one next to the name
 * (John Molson does; the others do not). They load from concordia.ca and fall
 * back to initials if the picture moves. One John Molson portrait is left out
 * on purpose: the page labels it with a different person's name.
 */
export interface Advisor {
  name: string
  /** What they advise on, in the faculty's own words (shortened). */
  role: string
  email: string
  phone?: string
  photo?: string
  bookUrl?: string
  /** Matched against the student's program text to mark "your advisor". */
  match?: RegExp
}

export interface AdvisorList {
  /** The team's name as a heading. */
  team: string
  source: string
  /** One line on how this faculty's advising works. */
  note: string
  people: Advisor[]
}

const JM =
  'https://www.concordia.ca/content/concordia/en/jmsb/programs/undergraduate/bachelor/students/advising-policies/academic-advising/_jcr_content/content-main'
const MAIN = '514-848-2424'

export const ADVISORS: Record<NonNullable<Resource['faculty']>, AdvisorList> = {
  jmsb: {
    team: 'John Molson advising team',
    source:
      'https://www.concordia.ca/jmsb/programs/undergraduate/bachelor/students/advising-policies/academic-advising.html',
    note: 'One advisor per program. Write from your Concordia email, or drop in on Wednesdays at MB 4.201.',
    people: [
      {
        name: 'Soha Hawili',
        role: 'Marketing, Human Resource Management, Management, and the certificate and minor in Business Studies',
        email: 'soha.hawili@concordia.ca',
        bookUrl:
          'https://bookings.cloud.microsoft/book/SohaHawiliJMSBAdvisorStudentAcademicServices@resources.concordia.ca/',
        match: /marketing|human resource|management|business studies/i,
      },
      {
        name: 'Marwa Gouda',
        role: 'Accountancy and the certificate in Accountancy',
        email: 'marwa.gouda@concordia.ca',
        photo: `${JM}/accordion_panel_1068820578/parsys-accordion/textimage/image.img.jpg/1790197310373.jpg`,
        bookUrl: 'https://outlook.office365.com/book/MarwaGouda@liveconcordia.onmicrosoft.com/',
        match: /accountan/i,
      },
      {
        name: 'Manal Tarhini',
        role: 'Finance and the Bachelor of Administration',
        email: 'manal.tarhini@concordia.ca',
        photo: `${JM}/accordion_panel_924827608/parsys-accordion/textimage/image.img.jpg/1790197315940.jpg`,
        bookUrl: 'https://outlook.office365.com/owa/calendar/ManalTarhini@liveconcordia.onmicrosoft.com/bookings/',
        match: /financ|administration/i,
      },
      {
        name: 'Edda Fargnoli',
        role: 'Economics, Supply Chain Operations Management, Business Technology Management and International Business',
        email: 'edda.fargnoli@concordia.ca',
        photo: `${JM}/accordion_panel_628127441/parsys-accordion/textimage/image.img.jpg/1790197336733.jpg`,
        bookUrl:
          'https://bookings.cloud.microsoft/book/EddaFargnoliAdvisorStudentAcademicServices@liveconcordia.onmicrosoft.com/',
        match: /econom|supply chain|business technology|international business/i,
      },
      {
        name: 'Steve Clark',
        role: 'Certificate in Foundations for Business, internal degree transfers and independent students',
        email: 'steve.clark@concordia.ca',
        photo: `${JM}/accordion_panel_1653614435/parsys-accordion/textimage/image.img.jpg/1790197346284.jpg`,
        match: /foundations|independent|transfer/i,
      },
    ],
  },
  ginacody: {
    team: 'Gina Cody Student Academic Services',
    source: 'https://www.concordia.ca/ginacody/students/academic-services/sas-staff.html',
    note: 'Start at the front desk (EV 2.125) or a 10-minute virtual drop-in; these are the undergraduate advisors behind it.',
    people: [
      {
        name: 'Anna Schillgalies',
        role: 'Advisor, undergraduate programs',
        email: 'anna.schillgalies@concordia.ca',
        phone: `${MAIN} ext. 4484`,
      },
      {
        name: 'Sarah Loubiri',
        role: 'Facilitator, undergraduate advising',
        email: 'sarah.loubiri@concordia.ca',
        phone: `${MAIN} ext. 7127`,
      },
      {
        name: 'Sakib Shahid',
        role: 'Advisor, registration and scheduling',
        email: 'sakib.shahid@concordia.ca',
        phone: `${MAIN} ext. 3066`,
      },
      {
        name: 'Gabrielle Robinette',
        role: 'Advisor, retention and student success',
        email: 'gabrielle.robinette@concordia.ca',
        phone: `${MAIN} ext. 4938`,
      },
      {
        name: 'Ana Pena',
        role: 'Advisor, retention and student success',
        email: 'ana.pena@concordia.ca',
      },
    ],
  },
  artsci: {
    team: 'Arts and Science advisors',
    source: 'https://www.concordia.ca/artsci/students/sas/advisors.html',
    note: 'Advising is by appointment. Your department also has its own program advisor.',
    people: [
      { name: 'Shoshana Kalfon', role: 'Advisor, Student Academic Services', email: 'shoshana.kalfon@concordia.ca' },
      { name: 'Sandra Robinson', role: 'Advisor, Student Academic Services', email: 'sandra.robinson@concordia.ca' },
      {
        name: 'Amnah Abdul Razzak',
        role: 'Advisor, Student Academic Services',
        email: 'amnah.abdulrazzak@concordia.ca',
      },
    ],
  },
  finearts: {
    team: 'Fine Arts Student Academic Services',
    source: 'https://www.concordia.ca/finearts/about/staff.html#sas',
    note: 'Fine Arts lists its advisors on its staff page; write to the shared address and the right person answers.',
    people: [],
  },
}
