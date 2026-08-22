/**
 * Legal copy is rendered from this structured data so the page component stays
 * a thin renderer.
 *
 * Every bracketed placeholder that used to live here is now resolved, and the
 * decisions behind the three that were real judgement calls are recorded so a
 * future reader does not quietly change them back:
 *
 * - AGE 16. Quebec's Law 25 lets a minor of 14 or over consent for themselves
 *   and requires parental authority below that. We hold GRADES, which are
 *   sensitive information about a minor, and we have not built a parental
 *   consent flow — so 14 is the floor we must never sit on. 16 also matches
 *   the GDPR Article 8 default, which matters for exchange students, and sits
 *   below every realistic Concordia student, so it excludes nobody real.
 *
 * - REFUNDS: 14 days, no reason needed, INCLUDING on a renewal charge. The
 *   single most common subscription complaint is "I forgot it renewed", and a
 *   refund window that covers renewals removes that complaint and the card
 *   chargebacks that follow it — which cost more than the $15 ever did. Not 30
 *   days, because the Semester pass only runs four months.
 *
 * - RENEWAL NOTICE: 7 days. Long enough to act on for a pass that renews only
 *   three times a year, which is exactly the kind you forget. Delivered by us
 *   off Stripe's `invoice.upcoming` webhook, so it is branded and bilingual
 *   rather than depending on a dashboard toggle.
 *
 * Still not a lawyer's work. It is honest about what the system does, which is
 * the part software can get right.
 */
export type ListItem = string | { label: string; text: string }

export type Block =
  | { kind: 'p'; text: string }
  | { kind: 'list'; items: ListItem[] }
  | { kind: 'callout'; title?: string; text: string }
  | { kind: 'highlight'; text: string }
  | { kind: 'links'; items: { label: string; href: string; verify?: boolean }[] }

export interface LegalSection {
  n: number
  title: string
  blocks: Block[]
}

export interface LegalDoc {
  slug: 'terms' | 'privacy' | 'educator'
  title: string
  lastUpdated: string
  intro?: string
  sections: LegalSection[]
}

const LAST_UPDATED = 'August 22, 2026'
/** Privacy carries its own date. It last changed on 22 August 2026, when Resend
 * was added as a subprocessor — naming a new processor is exactly the kind of
 * change Law 25 expects to be dated. */
const PRIVACY_UPDATED = 'August 22, 2026'

const privacy: LegalDoc = {
  slug: 'privacy',
  title: 'Privacy Policy',
  lastUpdated: PRIVACY_UPDATED,
  intro: 'How ConcordiaTracker collects, uses, and protects your information.',
  sections: [
    {
      n: 1,
      title: 'Data Collection (Law 25 Compliance)',
      blocks: [
        {
          kind: 'p',
          text: 'In compliance with Quebec’s Law 25 (Act respecting the protection of personal information in the private sector), we disclose that we collect:',
        },
        {
          kind: 'list',
          items: [
            { label: 'Identification', text: 'Email address, display name, and profile picture (via Google OAuth).' },
            { label: 'Academic Data', text: 'Course names, assignment titles, weights, due dates, and grades: all entered voluntarily by the user.' },
            { label: 'Technical Data', text: 'Our hosting and database providers process your IP address and browser information to keep the service secure and to mitigate abuse. We do not store your IP address ourselves, and it is never used for analytics or advertising.' },
            { label: 'Usage Statistics', text: 'Anonymous statistics about how the service is used: see Usage Analytics below for exactly what is and is not recorded.' },
          ],
        },
      ],
    },
    {
      n: 2,
      title: 'Google OAuth & API Data Usage',
      blocks: [
        {
          kind: 'p',
          text: 'We use Google OAuth 2.0 solely for secure authentication. When you sign in with Google, we only request and access your basic profile information: email address, display name, and profile picture. We do not access your Google Drive, Gmail, Calendar, Contacts, or any other Google service data.',
        },
        {
          kind: 'callout',
          title: 'Google API Services User Data Policy Compliance',
          text: 'ConcordiaTracker’s use and transfer to any other app of information received from Google APIs will adhere to the Google API Services User Data Policy, including the Limited Use requirements.',
        },
        {
          kind: 'callout',
          title: 'AI / ML Disclosure',
          text: 'We do not share, sell, or use information received from Google APIs to train third-party artificial intelligence or machine learning models.',
        },
      ],
    },
    {
      n: 3,
      title: 'How We Use Your Data',
      blocks: [
        {
          kind: 'list',
          items: [
            'Provide grade calculations, GPA projections, and dashboard features.',
            'Send essential service updates and deadline notifications (if opted-in).',
            'Improve application performance and user experience through anonymized analytics.',
          ],
        },
        {
          kind: 'highlight',
          text: 'We do not, and will never, sell your personal or academic data to third parties. Your data is never used for advertising, profiling, or any purpose beyond providing the ConcordiaTracker service.',
        },
      ],
    },
    {
      n: 4,
      title: 'Data Storage & Security',
      blocks: [
        {
          kind: 'list',
          items: [
            { label: 'Encryption', text: 'All data is encrypted in transit (TLS 1.3) and at rest via Supabase PostgreSQL infrastructure.' },
            { label: 'Row Level Security', text: 'Database access is enforced per-user via Supabase RLS policies. You can only read and modify your own data.' },
            { label: 'Payment Info', text: 'Financial data is handled exclusively by Stripe. We never store credit card numbers on our servers.' },
            { label: 'Authentication', text: 'Session tokens are managed by Supabase Auth and are never exposed to client-side JavaScript.' },
          ],
        },
      ],
    },
    {
      n: 5,
      title: 'Data Retention & Deletion',
      blocks: [
        { kind: 'p', text: 'Your data is retained for as long as your account is active. You may delete your account and all associated data at any time using:' },
        {
          kind: 'list',
          items: [
            { label: 'In-app', text: 'The “Delete Account” button in the Settings page of your dashboard. This immediately and permanently removes all your courses, assignments, grades, notifications, and profile data.' },
            { label: 'By email', text: 'Emailing concordiatracker@gmail.com to request manual deletion.' },
          ],
        },
        { kind: 'p', text: 'Upon receiving a deletion request via email or our in-app settings, ConcordiaTracker will permanently delete all associated user data from our active databases within 30 days. Backups are automatically rotated and do not retain deleted user data beyond this period.' },
        { kind: 'p', text: 'Primary Support & Data Privacy Contact: concordiatracker@gmail.com' },
      ],
    },
    {
      n: 6,
      title: 'Your Rights',
      blocks: [
        { kind: 'p', text: 'Under Quebec’s Law 25 and applicable Canadian privacy legislation, you have the right to:' },
        {
          kind: 'list',
          items: [
            'Access a copy of all personal data we store about you.',
            'Request correction of inaccurate data.',
            'Request complete deletion of your data and account.',
            'Withdraw consent for data processing at any time.',
          ],
        },
        { kind: 'p', text: 'To exercise these rights, contact us at concordiatracker@gmail.com.' },
      ],
    },
    {
      n: 7,
      title: 'Third-Party Services',
      blocks: [
        { kind: 'p', text: 'We integrate with the following third-party providers. Each has their own privacy policy:' },
        {
          kind: 'links',
          items: [
            { label: 'Google (Authentication)', href: 'https://policies.google.com/privacy' },
            { label: 'Supabase (Database & Auth)', href: 'https://supabase.com/privacy' },
            { label: 'Stripe (Payments)', href: 'https://stripe.com/privacy' },
            { label: 'Vercel (Hosting)', href: 'https://vercel.com/legal/privacy-policy' },
            { label: 'Resend (Transactional email)', href: 'https://resend.com/legal/privacy-policy' },
          ],
        },
      ],
    },
    {
      n: 8,
      title: 'Cookies & Local Storage',
      blocks: [
        { kind: 'p', text: 'We use essential cookies only for session management via Supabase Auth. These cookies are strictly necessary to keep you logged in and do not track your browsing activity. We do not use advertising cookies, and we do not allow any third party to track you across other websites.' },
        { kind: 'p', text: 'We also store a small amount of data in your browser’s local storage: your interface preferences, and the anonymous identifiers described in the Usage Analytics section below. This data stays in your browser, is never shared with third parties, and is cleared when you clear your browser data.' },
      ],
    },
    {
      n: 9,
      title: 'Usage Analytics',
      blocks: [
        { kind: 'p', text: 'To understand how the service is used and where to improve it, we collect anonymous usage statistics ourselves. We do not use Google Analytics or any other third-party analytics provider, and no advertising or tracking script runs on this site.' },
        { kind: 'p', text: 'What we record when you visit a page:' },
        {
          kind: 'list',
          items: [
            { label: 'Anonymous identifiers', text: 'two randomly generated ids stored in your browser: one per browser (to distinguish new from returning visitors) and one per tab session (to count how many people are using the site at a given moment). They are random values that identify a browser, not a person, and contain no personal information.' },
            { label: 'Page visited', text: 'the general route you viewed (for example, /app/courses). Addresses that contain private links: such as invitation links: are stripped of their unique code before anything is recorded, so those codes are never stored.' },
            { label: 'Referring website', text: 'the domain that linked you here (for example, instagram.com): never the full address, which can itself contain personal information.' },
            { label: 'Campaign tags', text: 'if you arrived through a tagged link we share (for example, a link posted by a student club), the tag on that link.' },
            { label: 'Device type', text: 'whether the screen is phone-sized or desktop-sized.' },
          ],
        },
        { kind: 'p', text: 'What we deliberately do not collect: your IP address, your browser or device fingerprint, your location, or any identifier that could link your browsing to you personally or follow you to other websites. If you are signed in, a visit may be associated with your account so we can measure how the product is used; it is never sold, shared, or used to build an advertising profile.' },
        { kind: 'highlight', text: 'This analytics data is anonymous and stays with us. We will never sell it, share it with advertisers, or use it to track you across the internet.' },
        { kind: 'p', text: 'Retention: activity signals used only to count who is currently online are deleted after 7 days, and page-visit records are deleted after 180 days.' },
        { kind: 'p', text: 'Because these statistics are anonymous, they generally cannot be traced back to you individually. If you have questions about this, or you would like us to stop associating your signed-in account with usage statistics, contact us at concordiatracker@gmail.com and we will action it.' },
      ],
    },
    {
      n: 10,
      title: 'Age Requirement',
      blocks: [
        { kind: 'p', text: 'This service is not intended for children under the age of 16. By creating an account, you confirm that you are at least 16 years of age. If we learn that we have collected personal information from a child under 16 without parental consent, we will delete that information immediately.' },
      ],
    },
    {
      n: 11,
      title: 'Changes to This Policy',
      blocks: [
        { kind: 'p', text: 'We will notify users of material changes to this Privacy Policy via email or in-app notification at least 14 days before they take effect. Continued use of the service after changes become effective constitutes acceptance of the revised policy.' },
      ],
    },
  ],
}

const terms: LegalDoc = {
  slug: 'terms',
  title: 'Terms of Service',
  lastUpdated: LAST_UPDATED,
  intro: 'The agreement between you and ConcordiaTracker.',
  sections: [
    { n: 1, title: 'Acceptance of Terms', blocks: [{ kind: 'p', text: 'By accessing ConcordiaTracker.com (“the Site”), you agree to be bound by these Terms of Service and all applicable laws and regulations. If you do not agree with any of these terms, you are prohibited from using or accessing this site.' }] },
    { n: 2, title: 'Nature of Service', blocks: [{ kind: 'p', text: 'ConcordiaTracker is an independent academic productivity tool built by students for students. We are not officially affiliated with, endorsed by, or partnered with Concordia University or any educational institution. The service provides grade tracking, assignment management, and GPA projection tools.' }] },
    {
      n: 3,
      title: 'User Accounts & Authentication',
      blocks: [
        {
          kind: 'list',
          items: [
            'Accounts are created via Google OAuth 2.0. We only access your email, name, and profile picture for authentication purposes.',
            'You are responsible for maintaining the security of your Google account, which provides access to this service.',
            'You must be at least 16 years of age to create an account.',
          ],
        },
      ],
    },
    {
      n: 4,
      title: 'Accuracy of Data & Academic Responsibility',
      blocks: [
        {
          kind: 'list',
          items: [
            { label: '“Running Grade” Disclaimer', text: 'All grade calculations, GPA predictions, and “Final Exam Safety Net” results are estimates only. Users are solely responsible for verifying their official grades via their institution’s systems (e.g., Moodle, my.concordia.ca).' },
            { label: 'Academic Integrity', text: 'This tool is intended for personal organization and time management. Use of this tool must comply with your institution’s Academic Code of Conduct.' },
            { label: 'Data Accuracy', text: 'We do not verify the accuracy of user-entered data. Incorrect inputs will produce incorrect calculations.' },
          ],
        },
      ],
    },
    {
      n: 5,
      title: 'Subscriptions & Payments',
      blocks: [
        {
          kind: 'list',
          items: [
            { label: 'Free Tier', text: 'Core features are available at no cost with no time limit.' },
            { label: 'Pro Accounts', text: 'Premium features require a paid subscription. Payments are processed securely via Stripe. We do not store credit card information on our servers.' },
            { label: 'Auto-Renewal', text: 'Paid subscriptions renew automatically at the end of each billing period (the Semester pass at term end; monthly plans each month). We email you at least 7 days before each renewal, to the address on your account, telling you the amount and the date. If that email does not reach you, the 14-day refund window on the renewal charge is your backstop. You can cancel anytime before the renewal date via Settings → Billing; access continues until the end of the paid period.' },
            { label: 'Refunds', text: 'You may request a full refund within 14 days of any charge, including a renewal charge, for any reason or none. Email concordiatracker@gmail.com from the address on your account and we will process it — there is no form and no argument. After 14 days the current period is not refundable, but you can cancel at any time to stop future billing, and access continues to the end of the period you have paid for. Duplicate or accidental charges are refunded whenever we find them, without a time limit.' },
            { label: 'Price Changes', text: 'We reserve the right to modify subscription pricing with 30 days’ notice to existing subscribers.' },
          ],
        },
      ],
    },
    {
      n: 6,
      title: 'Acceptable Use',
      blocks: [
        { kind: 'p', text: 'You agree not to:' },
        {
          kind: 'list',
          items: [
            'Use the service for any unlawful purpose or in violation of any applicable regulations.',
            'Attempt to reverse-engineer, decompile, or disassemble any part of the service.',
            'Upload malicious content, spam, or attempt to breach security measures.',
            'Share your account credentials or allow unauthorized access.',
          ],
        },
      ],
    },
    { n: 7, title: 'Intellectual Property', blocks: [{ kind: 'p', text: 'The ConcordiaTracker name, logo, user interface, and underlying code are the property of ConcordiaTracker and are protected by applicable intellectual property laws. User-entered data (courses, grades, assignments) remains the property of the user.' }] },
    { n: 8, title: 'Limitation of Liability', blocks: [{ kind: 'p', text: 'To the maximum extent permitted by law, ConcordiaTracker and its creators shall not be liable for any academic penalties, financial loss, missed deadlines, incorrect grade calculations, or data inaccuracies resulting from the use of this service. This service is provided “as is” and “as available” without warranties of any kind.' }] },
    { n: 9, title: 'Termination', blocks: [{ kind: 'p', text: 'We reserve the right to suspend or terminate your account at our sole discretion if you violate these Terms. You may delete your account at any time via the Settings page or by contacting concordiatracker@gmail.com.' }] },
    { n: 10, title: 'Governing Law', blocks: [{ kind: 'p', text: 'These Terms shall be governed by and construed in accordance with the laws of the Province of Quebec and the federal laws of Canada applicable therein, without regard to conflict of law principles.' }] },
  ],
}

const educator: LegalDoc = {
  slug: 'educator',
  title: 'Educator Agreement',
  lastUpdated: LAST_UPDATED,
  intro:
    'Governs use of ConcordiaTracker by instructors, teaching staff, and student organizations.',
  sections: [
    {
      n: 1,
      title: 'Purpose & Scope',
      blocks: [
        {
          kind: 'p',
          text: 'This Agreement applies to anyone using a ConcordiaTracker teacher or organizer account. It is in addition to the Terms of Service, which continue to apply. Where the two differ on a point about portal accounts, this Agreement governs.',
        },
        {
          kind: 'p',
          text: 'A portal account exists so that you can publish: a course outline, an announcement, or a campus event. It is a one-way channel by design.',
        },
        {
          kind: 'highlight',
          text: 'A portal account gives you no access to any student\u2019s grades, standing, or personal data. There is no version of the teacher portal that shows you how a student is doing, and there will not be one. Organizer accounts see event totals only \u2014 never who viewed, followed, or saved anything.',
        },
        {
          kind: 'p',
          text: 'ConcordiaTracker is independent and is not affiliated with, endorsed by, or operated by Concordia University. Publishing here does not replace anything the University requires of you. Moodle, the outline you file with your department, and any official communication remain the record; this is a convenience layer on top of them.',
        },
      ],
    },
    {
      n: 2,
      title: 'Eligibility & Verification',
      blocks: [
        {
          kind: 'p',
          text: 'Portal accounts are created by invitation. An invitation is single-use, expires, and is bound to the email address it was sent to. You may not transfer, share, or forward one.',
        },
        {
          kind: 'list',
          items: [
            {
              label: 'Who may hold one',
              text: 'Instructors, teaching assistants with the instructor\u2019s authorization, departmental staff acting for a course, and authorized representatives of a recognized student organization.',
            },
            {
              label: 'What verification means',
              text: 'We confirm that we issued the invitation and that you control the address it was sent to, and we review the account before publishing is enabled. That is the whole of it. It is not an endorsement, and it is not a check against University records.',
            },
            {
              label: 'The verified badge',
              text: 'A teacher-verified outline, or a verified organization badge, means we confirmed the account and nothing more. Students are told exactly that, in those words.',
            },
            {
              label: 'Accuracy is yours',
              text: 'You are responsible for what you publish. Dates, weights, and announcements appear to students as coming from you, so they must be correct and must match what you have told your class elsewhere.',
            },
          ],
        },
        {
          kind: 'p',
          text: 'We may suspend or revoke a portal account at any time if we cannot verify it, if it is shared, or if it is used outside the terms of this Agreement.',
        },
      ],
    },
    {
      n: 3,
      title: 'Student Data & Privacy Responsibilities',
      blocks: [
        {
          kind: 'p',
          text: 'This section aligns with our Privacy Policy and with Quebec\u2019s Law 25.',
        },
        {
          kind: 'list',
          items: [
            {
              label: 'What you can see',
              text: 'Nothing about an individual student. Not their grades, not their standing, not whether they imported your outline, not whether they opened your announcement. Organizer metrics are aggregate counts, and the queries behind them cannot return a person.',
            },
            {
              label: 'What you must not publish',
              text: 'Do not put student names, ID numbers, grades, accommodation details, or anything else identifying a student into an outline, an announcement, or an event. Those are visible to the whole class and are not an appropriate place for personal information.',
            },
            {
              label: 'Adopting a community outline',
              text: 'You may review a student-submitted outline and adopt it as your published version. Doing so takes ownership of its contents. The student\u2019s upload is withdrawn from the community pool, and their identity is not disclosed to you beyond the handle they chose to publish under.',
            },
            {
              label: 'This is not a channel for academic decisions',
              text: 'Grade appeals, accommodation requests, and anything else with a formal process belong on your University email and in your department\u2019s process, not here.',
            },
          ],
        },
        {
          kind: 'callout',
          title: 'If you think something has gone wrong',
          text: 'Email concordiatracker@gmail.com. If personal information may have been exposed, say so in the subject line. We treat that as a confidentiality incident under Law 25, which obliges us to assess it and, where the risk of serious injury is real, to notify the Commission d\u2019acc\u00e8s \u00e0 l\u2019information and the people affected.',
        },
      ],
    },
    {
      n: 4,
      title: 'Acceptable Use',
      blocks: [
        {
          kind: 'p',
          text: 'Publish only for courses you teach or organizations you represent, and only material you have the right to publish.',
        },
        {
          kind: 'list',
          items: [
            'Do not publish an outline for a course or a section that is not yours.',
            'Do not upload copyrighted material you do not hold or license the rights to. A schedule of dates and weights is fine; a publisher\u2019s content is not.',
            'Do not use announcements or events for advertising, for recruitment into paid services, or for anything unrelated to the course or organization.',
            'Do not attempt to identify individual students from aggregate figures, or to combine those figures with information from elsewhere in order to do so.',
            'Do not automate access to the portal, scrape it, or attempt to reach data the interface does not offer you.',
          ],
        },
        {
          kind: 'p',
          text: 'You keep ownership of what you publish. By publishing it here you grant ConcordiaTracker a non-exclusive licence to display it to students and to store it while the account is active, which is what allows us to show it to the class at all. We do not sell it and we do not license it onward.',
        },
      ],
    },
    {
      n: 5,
      title: 'Termination',
      blocks: [
        {
          kind: 'p',
          text: 'You may close a portal account at any time by emailing concordiatracker@gmail.com from the address on the account.',
        },
        {
          kind: 'list',
          items: [
            {
              label: 'What happens to what you published',
              text: 'Published outlines and announcements are removed from student-facing views within 30 days of closure. Students who already imported an outline keep their copy, because at that point it is their coursework rather than your document.',
            },
            {
              label: 'Suspension by us',
              text: 'We may suspend publishing immediately and without notice where an account appears compromised, is being used to publish information about identifiable students, or is being used for a course that is not the account holder\u2019s. We will tell you why.',
            },
            {
              label: 'End of a course',
              text: 'An outline for a finished term stays visible to the students who imported it and is marked as belonging to a past term for everyone else. You can remove it at any time.',
            },
          ],
        },
        {
          kind: 'p',
          text: 'Sections 3 and 4 survive the closure of an account, for as long as is necessary to give them effect.',
        },
      ],
    },
  ],
}

export const LEGAL_DOCS: Record<LegalDoc['slug'], LegalDoc> = {
  privacy,
  terms,
  educator,
}
