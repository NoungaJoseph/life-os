import type { BaseCatalog } from './en';
import { formsFr } from './ns/forms';
import { moneyFr } from './ns/money';
import { tabsFr } from './ns/tabs';

type Deep<T> = { [K in keyof T]: T[K] extends string ? string : Deep<T[K]> };
const base: Deep<BaseCatalog> = {
  common: {
    appName: 'MY LIFE OS', tagline: 'Concevez votre vie. Atteignez vos objectifs. Devenez meilleur.',
    continue: 'Continuer', back: 'Retour', cancel: 'Annuler', save: 'Enregistrer', delete: 'Supprimer', retry: 'Réessayer', next: 'Suivant', skip: 'Passer', done: 'Terminé', gotIt: 'Compris',
    loading: 'Chargement…', offline: 'Vous êtes hors ligne. Affichage de vos dernières données ; les modifications nécessitent une connexion.', or: 'ou', yes: 'Oui', no: 'Non', optional: 'facultatif', edit: 'Modifier', close: 'Fermer',
    errors: { network: 'Impossible de joindre le serveur. Vérifiez votre connexion.', generic: 'Une erreur est survenue. Veuillez réessayer.', required: 'Ce champ est obligatoire.',
      notFound: 'Élément introuvable.', validation: 'Certaines valeurs ne sont pas valides.', conflict: 'Cet élément existe déjà.', rateLimited: 'Trop de requêtes. Patientez un instant.', unauthorized: 'Veuillez vous reconnecter.', aiOff: "Le coach IA n'est pas encore activé." },
  },
  language: {
    title: 'Choisissez votre langue', subtitle: 'Vous pourrez la changer à tout moment dans les Paramètres.', french: 'Français', english: 'English', frenchHint: 'French', englishHint: 'Anglais',
    continue: 'Continuer', settingsTitle: 'Langue',
  },
  auth: {
    welcomeTitle: 'Bienvenue', welcomeBody: 'Planifiez votre vie, atteignez vos objectifs et faites grandir votre épargne au même endroit.',
    welcome: { f1Title: 'Planifiez votre vie', f1Body: 'Fixez des objectifs pour chaque domaine et suivez vos progrès.', f2Title: 'Épargnez avec un but', f2Body: "Mettez de l'argent de côté pour ce qui compte, objectif par objectif.", f3Title: 'Restez en sécurité', f3Body: 'Votre code PIN protège votre compte sur ce téléphone.' },
    createAccount: 'Créer un compte', signIn: 'Se connecter', haveAccount: 'Vous avez déjà un compte ?', noAccount: 'Nouveau ici ?',
    register: {
      title: 'Créez votre compte', subtitle: 'Cela prend environ une minute.', firstName: 'Prénom', lastName: 'Nom', email: 'Adresse e-mail', phone: 'Numéro de téléphone',
      phoneHint: 'Exemple : 6 71 06 31 70', password: 'Mot de passe', repeatPassword: 'Répétez le mot de passe', passwordHint: 'Au moins 8 caractères, avec une lettre et un chiffre.',
      submit: 'Créer mon compte', terms: "En continuant, vous acceptez nos conditions d'utilisation et notre politique de confidentialité.",
    },
    login: { title: 'Bon retour', subtitle: 'Connectez-vous avec votre adresse e-mail.', identifier: 'Adresse e-mail', password: 'Mot de passe', submit: 'Se connecter', forgot: 'Mot de passe oublié ?', show: 'Afficher', hide: 'Masquer' },
    otp: { title: 'Vérifiez votre e-mail', subtitle: 'Nous avons envoyé un code à 6 chiffres à {{email}}. Saisissez-le ci-dessous.', code: 'Code de vérification', verify: 'Vérifier', resend: 'Envoyer un nouveau code', resendIn: 'Nouveau code dans {{s}} s', sent: 'Un nouveau code a été envoyé.', wrongEmail: "Mauvais e-mail ? Retour" },
    forgot: { title: 'Réinitialiser le mot de passe', subtitle: 'Saisissez votre e-mail et nous vous enverrons un code.', send: 'Envoyer le code', newPassword: 'Nouveau mot de passe', reset: 'Changer le mot de passe', done: 'Mot de passe modifié. Vous pouvez vous connecter.' },
    pin: {
      currentTitle: 'Saisissez votre code PIN actuel', createTitle: 'Créez votre code PIN', createBody: "Choisissez 4 chiffres. Vous l'utiliserez pour ouvrir l'application à chaque fois.", confirmTitle: 'Confirmez votre code PIN', confirmBody: 'Saisissez à nouveau les mêmes 4 chiffres.',
      mismatch: 'Les codes ne correspondent pas. Réessayez.', weak: 'Choisissez un code plus difficile à deviner, pas 1234 ni 0000.',
      unlockTitle: 'Bonjour {{name}}', unlockBody: 'Saisissez votre code PIN pour continuer.', wrong: 'Code incorrect. Il reste {{n}} essais.', locked: 'Trop d\'essais incorrects. Reconnectez-vous avec votre mot de passe.',
      forgot: 'Code PIN oublié ?', forgotBody: 'Vous allez vous déconnecter puis vous reconnecter avec votre mot de passe. Vous pourrez ensuite créer un nouveau code.', signOutAndReset: 'Se déconnecter et réinitialiser',
    },
    errors: {
      invalidCredentials: 'E-mail, numéro de téléphone ou mot de passe incorrect.', emailInUse: 'Impossible de créer ce compte. Essayez de vous connecter.', phoneInUse: 'Ce numéro de téléphone est déjà utilisé.',
      badOtp: 'Ce code est incorrect ou a expiré.', tooMany: 'Trop d\'essais. Patientez un instant.', sessionRevoked: 'Cet appareil a été déconnecté. Veuillez vous reconnecter.',
      email: 'Saisissez une adresse e-mail valide.', phone: 'Saisissez un numéro de téléphone valide.', name: 'Saisissez votre nom.', passwordShort: 'Utilisez au moins 8 caractères.', passwordWeak: 'Ajoutez au moins une lettre et un chiffre.',
      passwordMatch: 'Les mots de passe ne correspondent pas.',
    },
  },
  tutorial: {
    skip: 'Passer la visite', next: 'Suivant', finish: 'Commencer mon parcours', replay: 'Revoir le tutoriel', replayHint: 'Afficher à nouveau la visite de bienvenue et les conseils de première visite.', progress: '{{current}} sur {{total}}',
    cards: {
      oneTitle: 'Un espace calme pour votre vie', oneBody: 'Réunissez vos objectifs, vos projets, vos habitudes et vos choix financiers sans vous disperser.',
      twoTitle: "Passez de l'intention à l'action", twoBody: "Transformez vos objectifs importants en tâches et habitudes du jour, puis suivez clairement vos progrès.",
      threeTitle: 'Avancez avec régularité', threeBody: 'Appuyez-vous sur les rappels, les bilans et des conseils utiles, sans culpabilité ni jugement.',
      fourTitle: 'Donnez un rôle à chaque franc', fourBody: 'Suivez vos finances et préparez une épargne alignée sur vos vraies priorités.',
      fiveTitle: 'Votre vie reste privée', fiveBody: 'Votre compte, le code PIN et la gestion des appareils protègent vos informations personnelles.',
    },
    tipTitle: 'Conseil rapide', dismiss: 'Compris',
    tips: {
      home: "L'accueil rassemble les priorités, les habitudes et les progrès du jour.", goals: 'Ouvrez un objectif pour actualiser sa progression, ses étapes et la prochaine action.', planner: 'Utilisez les dates pour vous concentrer sur une journée et garder un programme réaliste.', habits: 'De petites actions répétées comptent plus qu’une série parfaite.', finance: 'Regardez ensemble les revenus, les dépenses et l’épargne avant votre prochaine décision.', settings: 'Vous pouvez relancer ce tutoriel ici à tout moment.', wallet: 'Le solde et chaque mouvement seront enregistrés dans le registre sécurisé.', vault: "L'argent du Coffre est réparti selon vos priorités et reste bloqué jusqu'à l'objectif.", groups: 'Chaque membre épargne son propre argent et le récupère à la date de fin.', transformation: 'Comparez votre situation actuelle et votre cible lors d’un bilan privé et bienveillant.', screenTime: 'Le blocage fonctionne seulement tant que les autorisations du téléphone restent actives.',
    },
    checklist: { title: 'Terminez la configuration', body: '{{done}} sur {{total}} prêts', profile: 'Compléter votre profil', goal: 'Créer votre premier objectif', habit: 'Ajouter votre première habitude', money: 'Ajouter de l’argent', pin: "Protéger l'application avec un code PIN" },
  },
  wallet: {
    profileButton: 'Portefeuille', title: 'Portefeuille', subtitle: 'Votre argent, enregistré clairement', balance: 'Solde du portefeuille', hideBalance: 'Masquer le solde', showBalance: 'Afficher le solde',
    add: 'Ajouter de l’argent', withdraw: 'Retirer', vault: 'Vers le Coffre', groups: 'Groupes', recent: 'Transactions récentes', all: 'Toutes', empty: 'Aucune transaction pour le moment.',
    amount: 'Montant en FCFA', phone: 'Numéro Mobile Money', provider: 'Opérateur', sandbox: 'Bac à sable', mtn: 'MTN MoMo', orange: 'Orange Money', suggested: '{{provider}} semble correspondre à ce numéro. Vous pouvez le changer.',
    submitDeposit: 'Demander le versement', submitWithdrawal: 'Demander le retrait', invalidAmount: 'Saisissez un montant entier supérieur à zéro.', success: 'Demande créée.',
    status: { pending: 'En attente', processing: 'En cours', succeeded: 'Réussie', failed: 'Échouée', reversed: 'Annulée' },
    kind: { deposit: 'Versement', withdrawal: 'Retrait', vault_transfer: 'Versement au Coffre', vault_release: 'Déblocage du Coffre', group_contribution: 'Contribution au groupe', group_release: 'Déblocage du groupe', reversal: 'Annulation', adjustment: 'Ajustement' },
  },
  vault: {
    title: 'Coffre à objectifs', subtitle: 'Une épargne bloquée pour ce qui compte', howTitle: 'Comment fonctionne le Coffre', howBody: "L'argent envoyé au Coffre est réparti entre vos objectifs et reste bloqué. Vous ne pouvez pas le retirer plus tôt. Chaque objectif est reversé automatiquement dans votre portefeuille uniquement lorsque sa cible est atteinte.", acknowledge: "Je comprends que cet argent reste bloqué jusqu'à ce que l'objectif soit atteint.", accept: 'Je comprends, continuer', locked: 'Total bloqué', nextUnlock: 'Prochain déblocage : il manque {{amount}} à {{title}}', goals: 'Objectifs du Coffre', addGoal: 'Ajouter un objectif au Coffre', target: 'Montant cible', priority: 'Priorité de 1 à 5', emergency: "Fonds d'urgence", sampleRent: 'Réserve de loyer', enable: 'Utiliser cet objectif', deposit: 'Verser dans le Coffre', amount: 'Montant en FCFA', preview: 'Voir la répartition', confirm: 'Confirmer le versement bloqué', split: '{{amount}} pour {{title}}', noGoals: "Créez d'abord un objectif classique, puis revenez ici.", loadError: 'Impossible de charger votre Coffre.', exact: 'La totalité des {{amount}} FCFA sera répartie exactement.',
  },
  groups: {
    title: 'Épargne en groupe', subtitle: 'Épargnez ensemble, gardez ce qui vous appartient', create: 'Créer un groupe', join: 'Rejoindre avec un code', empty: "Vous n'avez encore rejoint aucun groupe d'épargne.",
    name: 'Nom du groupe', amount: 'Contribution en FCFA', frequency: 'Fréquence', daily: 'Chaque jour', weekly: 'Chaque semaine', monthly: 'Chaque mois', start: 'Date de début (AAAA-MM-JJ)', end: 'Date de fin (AAAA-MM-JJ)', hideAmounts: "Masquer le montant exact épargné par les autres membres",
    lockTitle: 'Votre épargne reste la vôtre', lockBody: "Ce groupe ne verse pas l'argent à tour de rôle. Chaque membre épargne dans sa part personnelle bloquée et récupère toute son épargne à la date de fin. Aucun retrait n'est possible avant cette date.", lockCheck: "Je comprends que mes contributions restent bloquées jusqu'à la date de fin.", createAction: "Créer le groupe d'épargne bloquée", code: "Code d'invitation", joinAction: 'Vérifier et rejoindre', invalid: 'Vérifiez les informations du groupe et les dates.',
    invite: 'Inviter des membres', copyCode: 'Partagez ce code : {{code}}', progress: 'Progression des membres', schedule: 'Mon calendrier de contributions', saved: '{{amount}} FCFA épargnés', hidden: 'Montant exact masqué', contribute: 'Payer cette contribution', catchUp: 'Rattraper', nudge: 'Envoyer un rappel', nudged: 'Rappel envoyé', due: 'À payer', paid: 'Payée', late: 'Payée en retard', missed: 'Manquée', endHint: 'Toute votre épargne sera débloquée le {{date}}.', details: 'Détails du groupe', noChat: 'Pas de discussion de groupe : seulement les progrès et des rappels bienveillants.',
  },
  transformation: {
    title: 'Transformation personnelle', subtitle: 'Observez vos progrès avec bienveillance et discrétion', add: 'Ajouter un domaine', empty: 'Commencez par un changement qui compte pour vous.', category: 'Domaine de vie', name: 'Sur quoi aimeriez-vous avancer ?', current: 'Qui je suis aujourd’hui', target: 'Qui je souhaite devenir', reason: 'Pourquoi cela compte pour moi', save: 'Enregistrer mon domaine', create: 'Créer le domaine', behavior: 'Un comportement concret', build: 'À développer', quit: 'À laisser derrière moi', addBehavior: 'Ajouter le comportement', behaviors: 'Mes comportements', checkin: 'Bilan de la semaine', currentScore: 'Où j’en suis aujourd’hui (1 à 10)', targetScore: 'Où je souhaite arriver (1 à 10)', note: 'Qu’est-ce qui a changé cette semaine ?', saveCheckin: 'Enregistrer le bilan', history: 'Mon évolution', days: '{{count}} jours', best: 'Meilleure série : {{count}} jours', urges: 'J’ai eu une envie', relapse: 'J’ai fait un écart', success: 'J’ai tenu bon', trigger: 'Qu’est-ce qui a déclenché cela ? (facultatif)', breathe: 'Respirez. Faites une pause de 60 secondes, puis rappelez-vous pourquoi cela compte pour vous.', noShame: 'Un écart n’efface pas vos progrès. Vous pouvez reprendre aujourd’hui.', record: 'Noter en privé', linked: 'Vous pourrez relier un objectif ou une habitude plus tard', linkGoal: 'Relier un objectif (facultatif)', linkHabit: 'Relier une habitude (facultatif)', none: 'Aucun',
    preview: { title: 'Faire une place au repos', current: 'Je travaille souvent trop tard', target: 'Je termine ma journée en prenant soin de moi', reason: 'Je veux garder de l’énergie pour mes proches et mon travail', behavior: 'Poser mon téléphone avant de dormir' },
    categories: { relationships: 'Relations', addictions: 'Habitudes à laisser derrière soi', health: 'Santé', finance: 'Finances', character: 'Caractère' },
    templates: {
      relationships: ['Écouter sans interrompre', 'Prendre du temps pour ma famille', 'Parler franchement avec mon partenaire', 'Reprendre contact avec un ami', 'Poser une limite avec douceur'],
      addictions: ['Rester loin du tabac', 'Choisir des journées sans alcool', 'M’éloigner de la pornographie', 'Faire une pause avant de jouer', 'Utiliser les réseaux sociaux avec intention'],
      health: ['Bouger un peu chaque jour', 'Me coucher à heure régulière', 'Prendre un repas nourrissant', 'Boire assez d’eau', 'Me laisser du temps pour me reposer'],
      finance: ['Suivre mes dépenses', 'Épargner une petite somme', 'Réfléchir avant d’acheter', 'Préparer mon budget de la semaine', 'Réduire une dette'],
      character: ['Tenir ma parole', 'Cultiver la patience', 'Parler avec gentillesse', 'Apprendre de mes erreurs', 'Finir ce que je commence'],
    },
  },
  screenTime: {
    title: 'Temps d’écran', subtitle: 'Faites de la place pour l’essentiel', unavailable: 'Le blocage des applications nécessite une version de développement installée.', permission: 'Le blocage fonctionne tant que les autorisations d’accès à l’utilisation et d’accessibilité restent actives. Vous pouvez les retirer dans les réglages du téléphone. L’accès à l’utilisation mesure le temps passé dans chaque application. Le service d’accessibilité détecte seulement l’application ouverte et affiche l’écran de pause ; il ne lit pas le contenu de l’écran.', ios: 'Sur iPhone, le blocage nécessite l’autorisation Family Controls d’Apple. Elle n’est pas activée dans cette version.', usageAccess: 'Autoriser l’accès à l’utilisation', accessibility: 'Autoriser le service d’accessibilité', apps: 'Choisir une application', identifier: 'Identifiant de l’application', name: 'Nom de l’application', limit: 'Limite quotidienne en minutes', duration: 'Bloquer pendant', hour: '1 heure', twoHours: '2 heures', commitment: 'Mode engagement', commitmentHint: 'Pendant un blocage actif, vous ne pouvez pas assouplir cette règle dans l’application. Les réglages du téléphone permettent toujours de retirer les autorisations.', add: 'Ajouter une limite', empty: 'Aucune limite pour le moment. Commencez par une application qui vous prend trop de temps.', today: 'Aujourd’hui', week: 'Cette semaine', minutes: '{{count}} min', startBlock: 'Démarrer le blocage', activeUntil: 'Bloquée jusqu’à {{time}}', enabled: 'Activée', disabled: 'En pause', pause: 'Mettre en pause', resume: 'Reprendre la limite', stats: 'Utilisation par application', save: 'Enregistrer la limite', remove: 'Supprimer la limite', select: 'Choisir une application installée', sync: 'Actualiser l’utilisation', unsupported: 'Les données d’utilisation sont disponibles sur Android après autorisation.', error: 'Impossible d’enregistrer vos réglages de temps d’écran.'
  },
  sessions: {
    title: 'Appareils et sessions', subtitle: 'Voyez où vous êtes connecté.', thisDevice: 'Cet appareil', lastActive: 'Dernière activité {{when}}', signOut: 'Déconnecter', signOutOthers: 'Déconnecter tous les autres appareils',
    confirmOthers: 'Déconnecter tous les appareils sauf celui-ci ?', lock: "Verrouiller l'application", lockAfter: 'Verrouiller après', lockNow: 'Immédiatement', lock1: '1 minute', lock5: '5 minutes', empty: 'Aucun autre appareil.',
    signedOut: 'Appareil déconnecté.', changePin: 'Changer le code PIN',
  },
};

export const fr = { ...base, ...tabsFr, ...formsFr, ...moneyFr };
