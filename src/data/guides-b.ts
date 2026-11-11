import type { Guide } from './guides'

/** The second half of the guides (see guides.ts for the rules they follow). */
export const GUIDES_B: Guide[] = [
  {
    slug: 'two-campuses',
    title: 'Two campuses and the shuttle between them',
    dek: 'Sir George Williams downtown, Loyola in NDG, and how to get from one to the other for free.',
    tag: 'Getting around',
    minutes: 3,
    photo: 'loyola',
    hex: '#2e9b6a',
    stages: ['first'],
    body: [
      {
        p: 'Concordia is two campuses about seven kilometres apart. Sir George Williams (SGW) is downtown, around Guy-Concordia metro. Loyola is in Notre-Dame-de-Grâce, with lawns, older buildings and several of the science departments. Plenty of students have classes on both.',
      },
      { h: 'The shuttle' },
      {
        list: [
          'It is free. Show your student ID when you board.',
          'It runs on weekdays during the term, not on weekends or holidays.',
          'The ride takes about thirty minutes, more in bad traffic.',
          'Each campus has its own departure times, and buses leave when full, so the timetable is approximate.',
        ],
      },
      {
        warn: 'Do not plan a ten-minute gap between a class at SGW and one at Loyola. Give yourself a full hour, door to door.',
      },
      { tip: 'Add the Shuttle widget on Today to see the next departures from each campus.' },
      { app: { label: 'Customize Today', to: '/app' } },
      { office: 'Shuttle bus' },
      { h: 'When the shuttle is not running' },
      {
        p: 'Public transit covers the same trip. The 105 bus runs along Sherbrooke to Loyola from Vendôme metro, and the Transit widget on Today shows the next buses and metro near each campus.',
      },
      { h: 'Building a timetable that works' },
      {
        p: 'When you pick sections, look at the campus as well as the time. Two classes back to back on different campuses is a schedule that only works on paper. The schedule builder shows the room for every section before you commit.',
      },
      { app: { label: 'Open the schedule builder', to: '/app/planner?tab=schedule' } },
    ],
    sources: [
      { label: 'Shuttle bus schedule', url: 'https://www.concordia.ca/maps/shuttle-bus.html' },
      { label: 'Campus maps', url: 'https://www.concordia.ca/maps.html' },
    ],
  },
  {
    slug: 'falling-behind',
    title: 'Falling behind? Who helps with what',
    dek: 'A bad midterm, a paper you cannot start, or a term that got away from you: the right office for each.',
    tag: 'Getting help',
    minutes: 5,
    photo: 'stacks',
    hex: '#8a5cd6',
    stages: ['first', 'middle'],
    body: [
      {
        p: 'Almost every kind of trouble a student gets into has an office whose whole job is that trouble. All of these are included in what you already pay.',
      },
      { h: 'A course is going badly' },
      {
        p: 'Start with the professor’s office hours; they are in the outline and they are usually empty. Then the Student Success Centre, which runs tutoring in math, economics and science and has learning specialists who help with how you study rather than what.',
      },
      { office: 'Student Success Centre' },
      { h: 'You cannot get a paper started, or finished' },
      {
        p: 'The Writing Centre works on any assignment at any stage, in English or French: a fifty-minute appointment, written feedback, or a drop-in. Bring the assignment sheet, not just the draft.',
      },
      { office: 'Writing Centre' },
      { h: 'It is not really about the course' },
      {
        p: 'If the problem is sleep, stress, money or something at home, tutoring will not fix it. Counselling has single-session appointments, and Health Services has a clinic on each campus.',
      },
      { office: 'Mental health and counselling' },
      { warn: 'If you or someone near you is in danger, call campus security at 514-848-3717, or 911.' },
      { h: 'You need more time or a different exam setup' },
      {
        p: 'The Access Centre arranges accommodations for students with disabilities, including temporary ones. It has to be set up in advance, so register as soon as you know you will need it.',
      },
      { office: 'Access Centre for Students with Disabilities' },
      { h: 'The term is past saving' },
      {
        p: 'Before the DISC deadline you can withdraw from a course and protect your GPA. After it, talk to your advisor about your options and your academic standing before grades come out, not after.',
      },
      { office: 'advising' },
      { h: 'You think you were treated unfairly' },
      {
        p: 'A grade you believe is wrong, a misconduct charge or a dispute with an instructor: the CSU Advocacy Centre is independent of the university and confidential. The Ombuds Office is the impartial route for a complaint about the university itself.',
      },
      { office: 'CSU Advocacy Centre' },
      { office: 'Ombuds Office' },
    ],
    sources: [
      { label: 'Student Success Centre', url: 'https://www.concordia.ca/students/success.html' },
      { label: 'Mental health services', url: 'https://www.concordia.ca/health/mental-health/services.html' },
      { label: 'CSU Advocacy Centre', url: 'https://www.csu.qc.ca/services/advocacy-4' },
    ],
  },
  {
    slug: 'work-and-money',
    title: 'Co-op, jobs and money you can apply for',
    dek: 'For the middle of your degree: getting paid work on your record and not leaving funding unclaimed.',
    tag: 'Middle years',
    minutes: 4,
    photo: 'molson',
    hex: '#c2569b',
    stages: ['middle'],
    body: [
      {
        p: 'Second and third year are when a degree stops being only courses. These are the things that are easier to start now than in your last term.',
      },
      { h: 'Co-op' },
      {
        p: 'Co-op builds paid work terms into your program. Each program has its own rules for who can join and when, so the question to ask is not "should I" but "is it still open to me". Ask the co-op office or your program’s co-op contact.',
      },
      { office: 'Co-op and Experiential Learning' },
      { h: 'Career Planning' },
      {
        list: [
          'Résumé and cover letter reviews.',
          'Mock interviews.',
          'A job bank and career fairs.',
          'Career counselling if you are not sure the program is leading where you want.',
        ],
      },
      { office: 'Career Planning' },
      { h: 'Money' },
      {
        p: 'Financial Aid and Awards handles government loans and bursaries, in-course bursaries and scholarships. Some are for need, some for grades, some for a specific program. You only find out which you qualify for by looking, and most have a deadline.',
      },
      { office: 'Financial Aid and Awards' },
      { tip: 'Costs, in the Planner, estimates your term bill line by line so you know what you are budgeting against.' },
      { app: { label: 'Open Costs', to: '/app/planner?tab=money' } },
      { h: 'Check the degree, not just the term' },
      {
        p: 'This is also the point to count what is left. A missing requirement found in second year is one course. Found in your last term, it is an extra term.',
      },
      { app: { label: 'Open My programme', to: '/app/planner?tab=program' } },
    ],
    sources: [
      { label: 'Co-op at Concordia', url: 'https://www.concordia.ca/academics/co-op.html' },
      { label: 'Career Planning', url: 'https://www.concordia.ca/students/success/career-planning.html' },
      { label: 'Financial Aid and Awards', url: 'https://www.concordia.ca/students/financial.html' },
    ],
  },
  {
    slug: 'final-year',
    title: 'Finishing: the last-year checklist',
    dek: 'Graduation does not happen automatically. What to confirm, apply for and use before you leave.',
    tag: 'Final year',
    minutes: 4,
    photo: 'tower',
    hex: '#1f9aa8',
    stages: ['final'],
    body: [
      {
        p: 'The most common last-year surprise is finding out, after your final exam, that you have not graduated. Two things cause it: a requirement that was never met, and an application that was never sent.',
      },
      { h: 'Do these first' },
      {
        steps: [
          {
            t: 'Have an advisor confirm what is left',
            d: 'Ask for it in writing. Credits are not the only rule: there are required courses, minimum grades in some of them and limits on what counts as an elective.',
          },
          {
            t: 'Apply to graduate',
            d: 'You have to apply, and each convocation has its own application window. The windows are on the graduation page. Miss one and you wait for the next ceremony.',
          },
          {
            t: 'Check your record',
            d: 'Make sure every course you finished shows a grade, and that a repeated course is counted the way you expect.',
          },
        ],
      },
      { office: 'advising' },
      { app: { label: 'Open My record', to: '/app/planner?tab=record' } },
      { h: 'Use what you are still paying for' },
      {
        list: [
          'Career Planning: counselling, the job bank and interview practice.',
          'The Writing Centre, for applications and personal statements as well as papers.',
          'Health Services and counselling.',
        ],
      },
      { office: 'Career Planning' },
      { h: 'If you are an international student' },
      {
        p: 'What you may do after your studies depends on your documents and their dates. Talk to the International Students Office before your last term, not after it.',
      },
      { office: 'International Students Office' },
    ],
    sources: [
      { label: 'Graduation and convocation', url: 'https://www.concordia.ca/students/graduation.html' },
      { label: 'Career Planning', url: 'https://www.concordia.ca/students/success/career-planning.html' },
    ],
  },
]
