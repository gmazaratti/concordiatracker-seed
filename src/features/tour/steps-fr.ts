/**
 * The guided tour in French, keyed by step id (steps.ts holds the English and
 * the order). TourOverlay picks this when the app language is French; a step
 * with no entry here falls back to its English text rather than going blank.
 */
export const TOUR_FR: Record<string, { title: string; body: string }> = {
  welcome: {
    title: 'Bienvenue : la visite de 2 minutes',
    body: 'J’ai ajouté un cours temporaire « DEMO 101 » juste pour cette visite : vos vrais cours ne sont pas touchés, et il disparaît à la fin. Utilisez Suivant ou →, et Échap pour quitter à tout moment.',
  },
  'today-glance': {
    title: 'Aujourd’hui, votre point de départ',
    body: 'Ce panneau résume l’essentiel : votre moyenne, ce qui est dû cette semaine et ce qui s’en vient, pour que la première chose que vous voyez chaque jour soit ce qui compte vraiment.',
  },
  'today-done': {
    title: 'Cochez ce qui est fait',
    body: 'Chaque tâche a un cercle : touchez-le pour la marquer comme faite. Elle passe dans « Terminé aujourd’hui » avec une annulation, et votre progression se met à jour tout de suite.',
  },
  'today-customize': {
    title: 'Faites d’Aujourd’hui le vôtre',
    body: 'Groupez votre liste par date ou par cours, affichez ou masquez les pondérations, changez la densité : Aujourd’hui s’adapte à votre façon de travailler.',
  },
  'courses-import': {
    title: 'Ajouter un cours',
    body: 'Importez un plan de cours, choisissez le plan d’un camarade ou d’un professeur, ou entrez-le à la main. Toutes les échéances, pondérations et notes partent d’ici.',
  },
  'course-open': {
    title: 'À l’intérieur d’un cours',
    body: 'Ouvrez n’importe quel cours pour le gérer. Voici notre cours DÉMO : voyons ce que fait chaque partie.',
  },
  'course-assessments': {
    title: 'Vos travaux',
    body: 'Ouvrez l’éditeur pour ajouter des travaux ou changer un statut, une note ou une remarque. Chaque ligne a aussi un menu ⋮ pour les modifications rapides : même cercle à cocher qu’Aujourd’hui.',
  },
  'course-breakdown': {
    title: 'Comment votre note est calculée',
    body: 'Voyez chaque catégorie, sa pondération et votre moyenne, avec le détail « Comment est-ce calculé? » pour que le chiffre ne soit jamais un mystère.',
  },
  'course-grade-needed': {
    title: 'Calculateur de note : gratuit',
    body: 'Choisissez une note visée et voyez la moyenne exacte qu’il vous faut sur ce qui reste. De vrais calculs, sans deviner, et c’est gratuit pour toujours.',
  },
  'course-gpa': {
    title: 'Prédire votre moyenne : Pro',
    body: 'Glissez une note hypothétique et regardez votre résultat prévu et votre moyenne générale bouger en direct. Cette fonction fait partie du passe de session.',
  },
  'course-info': {
    title: 'Détails du cours',
    body: 'Professeur, section, heures de bureau, local : tout est ici et modifiable sur place, pour que l’essentiel soit à un toucher.',
  },
  calendar: {
    title: 'Tout sur un seul calendrier',
    body: 'Affichez vos échéances et les dates officielles de l’université comme des calques, et passez des vues Mois, Semaine et Agenda.',
  },
  'community-following': {
    title: 'Ce qui se passe sur le campus',
    body: 'Suivez des clubs et des associations pour recevoir leurs événements dans votre fil, et écrivez à vos camarades.',
  },
  'community-add': {
    title: 'Gardez les événements qui vous plaisent',
    body: 'Ajoutez n’importe quel événement à votre calendrier en un toucher, ou ouvrez le profil d’un organisateur pour voir tout ce qu’il propose.',
  },
  done: {
    title: 'C’est la fin de la visite',
    body: 'Le cours DÉMO est parti : retour à vos vrais cours. La carte « Premiers pas » suit vos premières étapes, et vous pouvez refaire cette visite à tout moment depuis le menu.',
  },
}

/** The App Store build's wording for the calculator (no free / paid mention). */
export const TOUR_FR_STORE_GRADE = {
  title: 'Calculateur de note',
  body: 'Choisissez une note visée et voyez la moyenne exacte qu’il vous faut sur ce qui reste. De vrais calculs, sans deviner.',
}

/** The overlay's own words. */
export const TOUR_CHROME = {
  en: { step: 'Step {n} of {total}', skip: 'Skip tour', back: 'Back', next: 'Next', finish: 'Finish', tryIt: 'Try it on the highlighted item, or hit Next to continue.' },
  fr: { step: 'Étape {n} sur {total}', skip: 'Passer la visite', back: 'Retour', next: 'Suivant', finish: 'Terminer', tryIt: 'Essayez-le sur l’élément en surbrillance, ou appuyez sur Suivant pour continuer.' },
} as const
