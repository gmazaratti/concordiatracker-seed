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
/** Privacy carries its own date. Rewritten on 26 September 2026 against a full
 * audit of what the product collects (INVENTORY.md in the repo): every item the
 * old text left out is now here, including the things we would rather had been
 * different (raw IPs in device history, page views kept past the stated period
 * because the deletion job was never scheduled). Changes now take effect when
 * posted and are announced in the app. */
const PRIVACY_UPDATED = 'September 26, 2026'

const privacy: LegalDoc = {
  slug: 'privacy',
  title: 'Privacy Policy',
  lastUpdated: PRIVACY_UPDATED,
  intro: 'How ConcordiaTracker collects, uses, and protects your information. This page describes what the product actually does.',
  sections: [
    {
      n: 1,
      title: 'What We Collect (Law 25)',
      blocks: [
        {
          kind: 'p',
          text: 'In compliance with Quebec’s Law 25 (Act respecting the protection of personal information in the private sector), this is everything ConcordiaTracker collects:',
        },
        {
          kind: 'list',
          items: [
            { label: 'Account', text: 'Your email address, display name and profile picture. You sign in with Google, with Apple, or with an email and password. A password is stored only as a secure hash by our authentication provider; we never see it. If you use Apple’s “Hide My Email”, we receive Apple’s relay address, and Apple shares your name only on your first sign-in.' },
            { label: 'Profile', text: 'What you choose to add: a handle, a bio, links, your program, school and year of study, and your privacy settings.' },
            { label: 'Academic data', text: 'Your courses, assessments, weights, due dates, grades, notes, tasks and schedules, your record of finished courses, and any instructor or TA contact details you enter.' },
            { label: 'Syllabus uploads', text: 'The files you upload and what we extract from them. See sections 5 and 7.' },
            { label: 'Messages and social activity', text: 'Direct messages you send and receive (their text, and anything you attach, such as a snapshot of your schedule or record), reactions, read receipts (as your settings allow), follows, blocks, short notes, club memberships, comments, likes, reposts, which stories you viewed, schedule-sharing permissions you grant, and your notifications.' },
            { label: 'Support and feedback', text: 'Support tickets (your email, name, and every message in the conversation; for requests sent from our help pages without signing in, also your browser’s user-agent string), bug reports (your email and what you wrote), feature requests and comments, survey answers, course-data corrections, access requests, and the reason you give if you cancel or delete your account.' },
            { label: 'Payments', text: 'Your Stripe customer and subscription identifiers, plan, subscription status, amounts and renewal dates. Card numbers are entered on Stripe and never reach us.' },
            { label: 'Connected services', text: 'If you connect Moodle: your Moodle calendar link, stored so that nobody, including you, can read it back, and the deadlines it contains (title, due date, course code and description). If you turn on calendar sync: your private feed link, and when a calendar app last fetched it, including that app’s user-agent string.' },
            { label: 'Devices and IP addresses', text: 'While you are signed in, our authentication provider keeps each session with its IP address and browser user-agent string. We keep a copy of your past sessions (IP address, user agent, first and last seen) for 90 days, so Settings → Devices can show where your account has been used. You can see this list, and so can ConcordiaTracker administrators.' },
            { label: 'Push notifications', text: 'If you allow them: your device’s push address and keys, and the browser’s user-agent string.' },
            { label: 'Usage analytics', text: 'See section 9 for exactly what is recorded, and how to turn it off.' },
          ],
        },
      ],
    },
    {
      n: 2,
      title: 'Google and Apple Sign-In',
      blocks: [
        {
          kind: 'p',
          text: 'We use Google OAuth 2.0 and Sign in with Apple solely for authentication. With Google we request only your email address, display name and profile picture; with Apple, your email address (or relay address) and name. We do not access your Google Drive, Gmail, Calendar, Contacts, or any other Google or Apple service data.',
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
            'Provide the service: grade calculations, GPA projections, deadlines, planning, messaging and clubs.',
            'Read the syllabi you upload, using Google’s Gemini AI service (section 7).',
            'Send the emails the service needs: renewal notices, replies to your support requests, and club invitations.',
            'Understand how the product is used and improve it (section 9).',
            'Answer support requests and keep the service safe.',
          ],
        },
        {
          kind: 'highlight',
          text: 'We do not, and will never, sell your personal or academic data. Your data is never used for advertising or shared with advertisers.',
        },
      ],
    },
    {
      n: 4,
      title: 'Security and Who Can See Your Data',
      blocks: [
        {
          kind: 'list',
          items: [
            { label: 'Encryption', text: 'All data is encrypted in transit (TLS) and at rest by our database provider, Supabase.' },
            { label: 'Access rules', text: 'Database rules limit your private data (courses, grades, tasks, settings) to you. Anything you share is visible to the people you share it with: messages to their recipients, a public profile to anyone, posts and comments to their audience, and your schedule to the people you grant it to.' },
            { label: 'Clubs', text: 'Messages you send to a club, and its replies, are visible to every active member of that club’s team.' },
            { label: 'Administrators', text: 'ConcordiaTracker administrators can access account data to provide support and keep the service safe. This includes your profile and plan, courses and grades, support tickets and bug reports, the device and IP history described above, failed syllabus uploads, and every message sent to or from any club. Administrators do not have an in-app view of direct messages between two people.' },
            { label: 'Automated support assistant', text: 'Our support assistant can read and answer support tickets and bug reports, and can open a failed syllabus upload only while it waits for review. What it sends is logged.' },
            { label: 'Sign-in session', text: 'Your sign-in session is kept in your browser’s storage by Supabase Auth and is readable by ConcordiaTracker’s own page code, as with most web sign-ins.' },
            { label: 'Payments', text: 'Payment details are handled by Stripe. We never store card numbers.' },
          ],
        },
      ],
    },
    {
      n: 5,
      title: 'Data Retention and Deletion',
      blocks: [
        { kind: 'p', text: 'Your data is kept while your account is active. You can delete your account at any time:' },
        {
          kind: 'list',
          items: [
            { label: 'In the app', text: 'Settings → Account → Delete account. Deletion is immediate and permanent. It cancels any subscription first, then removes your profile, courses, assessments, grades, tasks, messages, follows, notes, notifications that name you, support tickets and every message in them, bug reports, survey answers, course reviews and outlines you shared, device and IP history, analytics records, sign-up attribution, connected Moodle and calendar links, push subscriptions, API keys, and your uploaded files.' },
            { label: 'By email', text: 'Email concordiatracker@gmail.com from the address on your account. We carry out the same deletion within 30 days.' },
          ],
        },
        { kind: 'p', text: 'What remains after deletion identifies no one: a count of deleted accounts per day and plan; the reason you chose, if you gave one, kept as a category and plan only, without any text you typed or any link to you; and usage statistics with the link to your account removed. Posts and events you published on behalf of a club stay with that club without your name, and images the club still displays stay with it.' },
        { kind: 'p', text: 'What we do not control: Stripe keeps its own records of past payments, as financial law requires. Our email provider, Resend, keeps logs of emails it sent under its own retention. Our database provider’s backups are replaced on a rolling basis, so deleted data can remain in a backup for up to 30 days before it is overwritten; backups are not used to restore individual accounts.' },
        { kind: 'p', text: 'Syllabus files you upload are read to extract your course schedule, then stored privately for up to 30 days so that, if the result was wrong or the file could not be read, we can read it again and fix your course for you. The files are not public and are not shown to other users. Administrators may open a stored file to review it by hand, and the support assistant may open one only while it is a failed upload waiting for that review. Stored files are deleted automatically 30 days after upload. A record that the upload happened (the file name, the date, and whether it could be read) stays with your account until you delete it.' },
        {
          kind: 'list',
          items: [
            { label: 'Page-visit records', text: '180 days. Short “who is online now” signals: 7 days.' },
            { label: 'Product analytics events', text: '13 months.' },
            { label: 'Email delivery records', text: '180 days.' },
            { label: 'Cancellation and deletion reasons', text: '2 years, without any link to you once your account is deleted.' },
            { label: 'Device and IP history', text: '90 days.' },
            { label: 'Uploaded syllabus files', text: '30 days.' },
          ],
        },
        { kind: 'p', text: 'These periods are enforced by an automatic job that runs daily. Until September 26, 2026 the automatic deletion of page-visit records had never run, so page views recorded before that date were kept longer than stated. The job now runs every day, and records past these periods are deleted.' },
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
            'Access a copy of the personal data we hold about you.',
            'Request correction of inaccurate data.',
            'Delete your account and data (section 5).',
            'Withdraw consent to optional processing: turn off usage analytics in Settings → Privacy at any time (section 9).',
          ],
        },
        { kind: 'p', text: 'To exercise these rights, contact us at concordiatracker@gmail.com.' },
      ],
    },
    {
      n: 7,
      title: 'Third-Party Services',
      blocks: [
        { kind: 'p', text: 'We rely on these providers. Each has its own privacy policy:' },
        {
          kind: 'links',
          items: [
            { label: 'Supabase (Database, authentication, file storage)', href: 'https://supabase.com/privacy' },
            { label: 'Vercel (Hosting, Web Analytics, Speed Insights)', href: 'https://vercel.com/legal/privacy-policy' },
            { label: 'Google (Sign-in, and Gemini AI for reading syllabi)', href: 'https://policies.google.com/privacy' },
            { label: 'Apple (Sign in with Apple)', href: 'https://www.apple.com/legal/privacy/' },
            { label: 'Stripe (Payments)', href: 'https://stripe.com/privacy' },
            { label: 'Resend (Transactional email)', href: 'https://resend.com/legal/privacy-policy' },
          ],
        },
        {
          kind: 'list',
          items: [
            { label: 'Google Gemini', text: 'When you upload a syllabus, its text (or, if the text cannot be read, the file itself) is sent to Google’s Gemini API to extract your assessments and dates.' },
            { label: 'Moodle', text: 'If you connect Moodle, our server fetches your Moodle calendar link from Concordia’s Moodle once a day to import your deadlines.' },
            { label: 'Loaded by your browser', text: 'Pages load fonts from Google Fonts, profile pictures from Google, some club images from image hosts such as ImgBB, and the weather widget from Open-Meteo. These providers receive your IP address as part of the request. Push notifications are delivered through your browser’s push service (for example Google, Apple or Mozilla).' },
          ],
        },
      ],
    },
    {
      n: 8,
      title: 'Cookies and Browser Storage',
      blocks: [
        {
          kind: 'list',
          items: [
            { label: 'ct_ref (cookie, 30 days)', text: 'Set when you arrive through one of our short links (such as /r, /ig, /li or /qr). It holds only the name of that link, so we can tell which one brought a visit or a sign-up.' },
            { label: '__stripe_mid, __stripe_sid (cookies, 1 year and 30 minutes)', text: 'Set by Stripe when the checkout loads, for fraud prevention.' },
            { label: 'Sign-in session (browser storage)', text: 'Kept by Supabase Auth so you stay signed in.' },
            { label: 'Other browser storage', text: 'Your interface preferences, the analytics identifiers and first-visit record described in section 9, and conveniences such as recent searches. This stays in your browser and is cleared when you clear your browser data.' },
          ],
        },
        { kind: 'p', text: 'We do not use advertising cookies, and we do not let any third party track you across other websites.' },
      ],
    },
    {
      n: 9,
      title: 'Usage Analytics',
      blocks: [
        { kind: 'p', text: 'We measure how the service is used in three ways.' },
        { kind: 'p', text: '1. Page visits (our own). When you open a page we record: two random identifiers kept in your browser (one per browser, one per tab session); the general route you viewed, with invitation codes and other private links stripped out; the website that linked you (its domain only); campaign tags on the link; whether the screen is phone- or desktop-sized; and the short-link name from the ct_ref cookie. If you are signed in, the visit is linked to your account unless you turn analytics off.' },
        { kind: 'p', text: '2. Vercel Web Analytics and Speed Insights. Our hosting provider records page views and page-loading performance. Before anything is sent we remove query strings and private codes from page addresses, and referring addresses are limited to the site’s domain. Vercel derives an approximate country from your IP address; it does not give us your IP address.' },
        { kind: 'p', text: '3. Product analytics (signed-in accounts). We record:' },
        {
          kind: 'list',
          items: [
            { label: 'How you found us', text: 'from your first visit: campaign tags, the referring domain, the page you landed on, and the channel we derive from them, saved to your account when you sign up.' },
            { label: 'Getting started', text: 'when you finish setup, add your first course, and complete your first assessment.' },
            { label: 'Features you use', text: 'quick links, outline previews and imports, syllabus uploads, club follows, the notifications panel, calendar sync and Moodle, at most once per feature per day.' },
            { label: 'Club invitations', text: 'whether an invitation was sent, opened, claimed, and led to an active club.' },
            { label: 'Email', text: 'whether each email we send was delivered, and, where our email provider’s tracking is enabled, opened or clicked, by type of email. We do not store the address, subject, or links.' },
            { label: 'Syllabus reading', text: 'whether each upload was read successfully, and a category for any failure.' },
            { label: 'Weekly activity', text: 'whether you used the service in a given week, grouped by the week you signed up.' },
            { label: 'Leaving', text: 'when a subscription is cancelled or an account is deleted, and the reason you give, if any.' },
          ],
        },
        { kind: 'p', text: 'Product analytics never include your grades, the text of your messages, file contents, passwords, or codes from private links. They are used only to improve the service and are never sold or shared with advertisers.' },
        { kind: 'callout', title: 'Turning analytics off', text: 'Settings → Privacy → “Share how I use ConcordiaTracker”. When you turn it off we stop recording product analytics for your account, delete what we had already recorded and your sign-up attribution, and stop linking your page visits to your account. Pages you open are still counted anonymously, as a signed-out visitor’s are.' },
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
        { kind: 'p', text: 'Material changes to this policy are announced in the app and take effect when posted. The date at the top of this page shows when it last changed.' },
      ],
    },
  ],
}

const terms: LegalDoc = {
  slug: 'terms',
  title: 'Terms of Service',
  // Its own date: the objectionable-content rules (App Store guideline 1.2)
  // changed the Terms without touching the other documents.
  lastUpdated: 'September 28, 2026',
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
            { label: 'Refunds', text: 'You may request a full refund within 14 days of any charge, including a renewal charge, for any reason or none. Email concordiatracker@gmail.com from the address on your account and we will process it. There is no form and no argument. After 14 days the current period is not refundable, but you can cancel at any time to stop future billing, and access continues to the end of the period you have paid for. Duplicate or accidental charges are refunded whenever we find them, without a time limit. We may decline a repeat request from an account that has already been refunded under this policy, which is the only limit on it.' },
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
            'Post, send or display objectionable content, including harassment, bullying, hate speech, threats, sexual content, spam or impersonation, in posts, stories, comments, messages or your profile.',
          ],
        },
        { kind: 'p', text: 'There is no tolerance for objectionable content or abusive users. You can report any post, message or account from the app, and block any account so it can no longer message you or see your profile. We review reports within 24 hours, remove content that breaks these Terms, and suspend or remove the accounts responsible.' },
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
          text: 'A portal account gives you no access to any student\u2019s grades, standing, or personal data. There is no version of the teacher portal that shows you how a student is doing, and there will not be one. Organizer accounts see event totals only, never who viewed, followed, or saved anything.',
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
