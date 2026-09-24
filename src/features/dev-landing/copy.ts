import { useI18n, type Lang } from '@/i18n/i18n'

/**
 * Every string on the hidden /dev/landing draft, in one place and in both
 * languages. Kept out of the shared i18n dictionaries on purpose: this page is
 * a draft, and promoting it later means moving these keys, not untangling them
 * from the live landing's.
 *
 * HOUSE RULE FOR THIS FILE: no em dashes. Commas, periods and colons only.
 */
const EN = {
  navFeatures: 'Features',
  navClubs: 'For clubs',
  navTeachers: 'For teachers',
  navDocs: 'Docs',
  signIn: 'Sign in',
  openApp: 'Open the app',

  heroEyebrow: 'For Concordia students',
  heroTitleA: 'Every deadline this term,',
  heroTitleB: 'in one calm place.',
  heroBody:
    'Drop in your course outlines. ConcordiaTracker pulls out every date and weight, tells you what you need on the final, and keeps it all next to the university calendar.',
  heroCta: 'Start free',
  heroSecondary: 'See it work',
  platformsLabel: 'Runs on',
  platformWeb: 'Web',
  platformIphone: 'iPhone',
  platformAndroid: 'Android',
  platformNote: 'No download. Add it to your home screen.',

  backedBy: 'Used by students across Gina Cody, JMSB, Arts and Science and Fine Arts.',

  f1Eyebrow: 'Course outlines',
  f1Title: ['A syllabus in,', 'a dated plan out.'],
  f1Body:
    'Upload the PDF your professor posted. Every quiz, lab and exam lands in the course with its weight and a badge that says where the date came from: the official outline, confirmed by classmates, or not checked yet.',
  f2Eyebrow: 'Grades',
  f2Title: ['Know what you need', 'before the final.'],
  f2Body:
    'Enter marks as you get them and the grade-needed calculator does the arithmetic: the average you need on what is left to land the letter you are aiming for. Free, always.',
  f3Eyebrow: 'Calendar',
  f3Title: ['Your deadlines and', 'Concordia’s, together.'],
  f3Body:
    'Assignments, personal tasks and the registrar’s dates sit on one calendar as layers you can switch off. Connect Moodle once and new deadlines arrive on their own.',
  f4Eyebrow: 'Community',
  f4Title: ['What is happening', 'around campus.'],
  f4Body:
    'Events from verified clubs and faculties, in one feed. Add one to your calendar in a tap. No endless scrolling, no strangers in your messages.',

  parseKicker: 'Watch it read one',

  gradeTarget: 'Aiming for',
  gradeNeeded: 'You need',
  gradeOnRemaining: 'on the remaining {w}%',
  gradeSecured: 'Already secured',
  gradeUnreachable: 'Out of reach this term',
  gradeFree: 'Free',

  calLayerMine: 'My calendar',
  calLayerConcordia: 'Concordia',
  calLayerMoodle: 'Moodle',

  commAdd: 'Add to calendar',
  commAdded: 'Added',

  ctaTitleA: 'Your term,',
  ctaTitleB: 'finally legible.',
  ctaBody: 'Free for grade-needed, outlines and the calendar. The semester pass adds GPA projection and more.',
  notAffiliated: 'Not affiliated with Concordia University.',
  slot: 'Video slot',
}

const FR: typeof EN = {
  navFeatures: 'Fonctions',
  navClubs: 'Pour les clubs',
  navTeachers: 'Pour le personnel enseignant',
  navDocs: 'Docs',
  signIn: 'Se connecter',
  openApp: 'Ouvrir l’app',

  heroEyebrow: 'Pour la population étudiante de Concordia',
  heroTitleA: 'Toutes les échéances du trimestre,',
  heroTitleB: 'au même endroit.',
  heroBody:
    'Déposez vos plans de cours. ConcordiaTracker en tire chaque date et chaque pondération, vous dit la note qu’il vous faut à l’examen final et place le tout à côté du calendrier universitaire.',
  heroCta: 'Commencer gratuitement',
  heroSecondary: 'Voir comment',
  platformsLabel: 'Fonctionne sur',
  platformWeb: 'Web',
  platformIphone: 'iPhone',
  platformAndroid: 'Android',
  platformNote: 'Rien à télécharger. Ajoutez-le à votre écran d’accueil.',

  backedBy: 'Utilisé par des étudiantes et étudiants de Gina Cody, JMSB, Arts et sciences et Beaux-arts.',

  f1Eyebrow: 'Plans de cours',
  f1Title: ['Un plan de cours,', 'un calendrier daté.'],
  f1Body:
    'Téléversez le PDF publié par votre professeur. Chaque quiz, labo et examen arrive dans le cours avec sa pondération et un badge qui indique d’où vient la date : le plan officiel, confirmée par des camarades ou pas encore vérifiée.',
  f2Eyebrow: 'Notes',
  f2Title: ['Sachez ce qu’il vous faut', 'avant l’examen final.'],
  f2Body:
    'Entrez vos notes au fur et à mesure et le calculateur fait le calcul : la moyenne nécessaire sur ce qui reste pour obtenir la lettre visée. Gratuit, toujours.',
  f3Eyebrow: 'Calendrier',
  f3Title: ['Vos échéances et', 'celles de Concordia.'],
  f3Body:
    'Travaux, tâches personnelles et dates du registrariat sur un seul calendrier, en couches que vous pouvez masquer. Connectez Moodle une fois et les nouvelles échéances arrivent seules.',
  f4Eyebrow: 'Communauté',
  f4Title: ['Ce qui se passe', 'sur le campus.'],
  f4Body:
    'Les événements des clubs et facultés vérifiés, dans un seul fil. Ajoutez-en un à votre calendrier en un geste. Pas de défilement sans fin, pas d’inconnus dans vos messages.',

  parseKicker: 'Regardez-le en lire un',

  gradeTarget: 'Objectif',
  gradeNeeded: 'Il vous faut',
  gradeOnRemaining: 'sur les {w} % restants',
  gradeSecured: 'Déjà acquis',
  gradeUnreachable: 'Hors de portée ce trimestre',
  gradeFree: 'Gratuit',

  calLayerMine: 'Mon calendrier',
  calLayerConcordia: 'Concordia',
  calLayerMoodle: 'Moodle',

  commAdd: 'Ajouter au calendrier',
  commAdded: 'Ajouté',

  ctaTitleA: 'Votre trimestre,',
  ctaTitleB: 'enfin lisible.',
  ctaBody: 'Gratuit pour la note nécessaire, les plans de cours et le calendrier. Le laissez-passer de trimestre ajoute la projection de la MPC.',
  notAffiliated: 'Non affilié à l’Université Concordia.',
  slot: 'Emplacement vidéo',
}

export type DevCopy = typeof EN
const COPY: Record<Lang, DevCopy> = { en: EN, fr: FR }

export function useDevCopy(): DevCopy {
  const { lang } = useI18n()
  return COPY[lang] ?? EN
}
