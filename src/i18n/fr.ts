import type { Key } from './en'

/**
 * French strings (Québec conventions — "courriel", not "e-mail").
 *
 * PARTIAL BY DESIGN: `Partial<Record<Key, string>>` means an untranslated key
 * falls back to English instead of rendering a raw key or an empty box. That's
 * what makes translating incrementally safe — a half-finished French UI is
 * always usable, never broken.
 *
 * Typography note: French uses a narrow no-break space before : ; ! ? — the
 * strings below use U+202F (narrow no-break space) where that applies, so the
 * punctuation can't wrap onto its own line.
 */
export const fr: Partial<Record<Key, string>> = {
  // ── Navigation ────────────────────────────────────────────────────────────
  'nav.today': 'Aujourd’hui',
  'nav.courses': 'Cours',
  'nav.calendar': 'Calendrier',
  'nav.community': 'Communauté',
  'nav.search': 'Rechercher',
  'nav.settings': 'Paramètres',
  'nav.feedback': 'Commentaires',
  'nav.whatsNew': 'Nouveautés',
  'nav.takeTour': 'Faire la visite',
  'nav.teacherPortal': 'Portail enseignant',
  'nav.organizerPortal': 'Portail organisateur',
  'nav.adminPanel': 'Panneau d’administration',
  'nav.landing': 'Page d’accueil',
  'nav.signOut': 'Se déconnecter',
  'nav.backToApp': 'Retour à l’application',

  // ── Common ────────────────────────────────────────────────────────────────
  'common.save': 'Enregistrer',
  'common.cancel': 'Annuler',
  'common.close': 'Fermer',
  'common.delete': 'Supprimer',
  'common.edit': 'Modifier',
  'common.done': 'Terminé',
  'common.loading': 'Chargement',
  'common.free': 'Gratuit',
  'common.continue': 'Continuer',
  'common.next': 'Suivant',
  'common.back': 'Retour',
  'common.tryAgain': 'Veuillez réessayer.',
  'common.somethingWrong': 'Une erreur est survenue.',

  // ── Landing ───────────────────────────────────────────────────────────────
  'landing.eyebrow': 'Pour les étudiants de Concordia',
  'landing.heroTitle': 'Ne devinez plus ce qui est',
  'landing.heroTitleAccent': 'à remettre',
  'landing.heroSub':
    'Téléversez un plan de cours et retrouvez chaque échéance, pondération et note au même endroit — conçu pour le fonctionnement réel de Concordia.',
  'landing.ctaPrimary': 'Ouvrir l’application',
  'landing.ctaSecondary': 'Voir comment ça marche',
  'landing.howItWorks': 'Comment ça marche',
  'landing.pricing': 'Tarifs',
  'landing.forTeachers': 'Pour les enseignants',
  'landing.notAffiliated': 'Non affilié à l’Université Concordia.',

  // ── Pricing ───────────────────────────────────────────────────────────────
  'pricing.free.name': 'Gratuit',
  'pricing.free.price': '0 $',
  'pricing.free.tagline': 'Fonctions essentielles, sans limite de temps.',
  'pricing.semester.name': 'Passe de session',
  'pricing.semester.badge': 'Meilleur choix',
  'pricing.semester.orMonthly': 'ou 5 $ / mois',
  'pricing.perSemester': '/ session',
  'pricing.perMonth': '/ mois',

  // ── Billing ───────────────────────────────────────────────────────────────
  'billing.title': 'Facturation',
  'billing.currentPlan': 'Actuel',
  'billing.active': 'Actif',
  'billing.trial': 'Essai',
  'billing.canceled': 'Annulé',
  'billing.paymentFailed': 'Paiement refusé',
  'billing.freePlan': 'Forfait gratuit',
  'billing.proPlan': 'ConcordiaTracker Pro',
  'billing.freeDesc':
    'Fonctions essentielles, sans limite de temps. Calculateur de note requise inclus.',
  'billing.proDesc':
    'Accès complet — prévision de la cote, numérisations illimitées, toutes les fonctions.',
  'billing.getSemester': 'Obtenir la passe de session — 15 $',
  'billing.goMonthly': 'Ou passer au mensuel — 5 $ / mois',
  'billing.switchToSemester': 'Passer à la passe de session — 15 $',
  'billing.carryOver': 'Le temps qu’il vous reste est reporté — aucun jour payé n’est perdu.',
  'billing.trialCarryOver': 'Les jours d’essai restants sont reportés — rien n’est perdu.',
  'billing.cancel': 'Annuler l’abonnement',
  'billing.resume': 'Reprendre l’abonnement',
  'billing.working': 'En cours…',
  'billing.trialCharge': 'Essai gratuit — votre carte sera débitée le {date}.',
  'billing.cancelsOn': 'Prend fin le {date} — vous gardez l’accès jusque-là.',
  'billing.paymentFailedMsg':
    'Votre dernier paiement a échoué. Mettez votre carte à jour pour conserver Pro.',
  'billing.notConfigured': 'Les paiements ne sont pas configurés dans cet environnement.',
  'billing.autoRenewal': 'Renouvellement automatique',
  'billing.renewsOn': 'Renouvellement automatique le {date}.',
  'billing.renewsGeneric':
    'Les forfaits payants se renouvellent automatiquement à la fin de chaque période de facturation (la passe de session à la fin du trimestre ; les forfaits mensuels chaque mois).',
  'billing.cancelAnytime':
    'Annulez à tout moment ici — l’accès se poursuit jusqu’à la fin de la période payée.',
  'billing.payment': 'Paiement',
  'billing.paymentMethod': 'Mode de paiement',
  'billing.paymentMethodDesc':
    'Géré par Stripe — nous ne voyons ni ne conservons jamais les numéros de carte.',
  'billing.updateCard': 'Mettre la carte à jour',
  'billing.updateCardTitle': 'Mettre à jour le mode de paiement',
  'billing.invoices': 'Factures',
  'billing.noInvoices': 'Aucune facture pour l’instant',
  'billing.firstInvoice': 'Votre première facture apparaîtra ici.',
  'billing.onFreePlan': 'Vous êtes sur le forfait gratuit.',
  'billing.checkout': 'Paiement',
  'billing.closeCheckout': 'Fermer le paiement',
  'billing.paid': 'Payée',
  'billing.due': 'À payer',

  // ── Settings ──────────────────────────────────────────────────────────────
  'settings.general': 'Général',
  'settings.account': 'Compte',
  'settings.privacy': 'Confidentialité',
  'settings.billing': 'Facturation',
  'settings.usage': 'Utilisation',
  'settings.appearance': 'Apparence',
  'settings.theme': 'Thème',
  'settings.language': 'Langue',
  'settings.languageDesc':
    'Langue de l’interface. Le contenu des cours reste tel que votre professeur l’a écrit.',

  'settings.preferences': 'Préférences',
  'settings.email': 'Courriel',
  'settings.updates': 'Mises à jour',
  'settings.keyboard': 'Clavier',
  'settings.reduceMotion': 'Réduire les animations',
  'settings.weekStartMon': 'Commencer la semaine le lundi',

  // ── Today ─────────────────────────────────────────────────────────────────
  'today.goodMorning': 'Bonjour',
  'today.goodAfternoon': 'Bon après-midi',
  'today.goodEvening': 'Bonsoir',
  'today.overdue': 'En retard',
  'today.thisWeek': 'Cette semaine',
  'today.allCaughtUp': 'Tout est à jour',
  'today.nothingDue': 'Rien à remettre pour l’instant.',
  'today.completedToday': 'Terminé aujourd’hui',
  'today.undo': 'Annuler',
  'today.debrief': 'Résumé du jour',
  'today.planMyWeek': 'Planifier ma semaine',
  'today.prioritise': 'Prioriser :',
  'today.termByWeek': 'Votre session, semaine par semaine',
  'today.workloadByWeight': 'Charge par pondération',

  // -- Courses --
  'courses.title': 'Cours',
  'courses.subtitle': 'Vos cours de cette session.',
  'courses.thisTerm': 'Cette session',
  'courses.pastSemesters': 'Sessions passées',
  'courses.importSyllabus': 'Importer un plan de cours',
  'courses.addCourse': 'Ajouter un cours',
  'courses.newCourse': 'Nouveau cours',
  'courses.noCourses': 'Aucun cours pour l’instant',
  'courses.addFirst': 'Ajoutez votre premier cours pour commencer.',
  'courses.findBlueprint': 'Trouver un plan partagé',
  'courses.uploadSyllabus': 'Téléverser un plan de cours',
  'courses.createManually': 'Créer manuellement',
  'courses.addAssessments': 'Ajouter des évaluations',
  'courses.grades': 'Notes',
  'courses.notes': 'Notes personnelles',
  'courses.classDetails': 'Détails du cours',
  'courses.gradeBreakdown': 'Répartition des notes',
  'courses.gradeNeeded': 'Note requise',
  'courses.weight': 'Pondération',
  'courses.grade': 'Note',
  'courses.due': 'Échéance',
  'courses.status': 'Statut',
  'courses.instructor': 'Enseignant',
  'courses.section': 'Section',
  'courses.credits': 'Credits',
  'courses.announcements': 'Annonces',

  // -- Calendar --
  'calendar.title': 'Calendrier',
  'calendar.month': 'Mois',
  'calendar.week': 'Semaine',
  'calendar.agenda': 'Agenda',
  'calendar.today': 'Aujourd’hui',
  'calendar.myCalendar': 'Mon calendrier',
  'calendar.concordia': 'Concordia',
  'calendar.universityDates': 'Dates universitaires',
  'calendar.addTask': 'Ajouter une tâche',
  'calendar.taskTitle': 'Titre de la tâche',
  'calendar.nothingScheduled': 'Rien de prévu',
  'calendar.syncCalendar': 'Synchroniser mon calendrier',

  // -- Onboarding --
  'onboarding.skipTour': 'Passer la visite',
  'onboarding.enterApp': 'Entrer dans ConcordiaTracker',
  'onboarding.addLater': 'J’ajouterai mes cours plus tard',
  'onboarding.progress': 'Progression de la configuration',

  // -- Status --
  'status.notStarted': 'À faire',
  'status.inProgress': 'En cours',
  'status.done': 'Terminé',
  'status.late': 'En retard',
  'status.missed': 'Manqué',
  'status.extension': 'Prolongation',
  'status.awaitingGrade': 'En attente de note',

  // ── Auth ──────────────────────────────────────────────────────────────────
  'auth.signIn': 'Se connecter',
  'auth.signInGoogle': 'Continuer avec Google',
  'auth.signUpFree': 'S’inscrire gratuitement',
  'auth.welcomeBack': 'Bon retour sur ConcordiaTracker.',
  'auth.email': 'Courriel',
  'auth.password': 'Mot de passe',
  'auth.or': 'OU',
}
