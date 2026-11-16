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
  sessions: {
    title: 'Appareils et sessions', subtitle: 'Voyez où vous êtes connecté.', thisDevice: 'Cet appareil', lastActive: 'Dernière activité {{when}}', signOut: 'Déconnecter', signOutOthers: 'Déconnecter tous les autres appareils',
    confirmOthers: 'Déconnecter tous les appareils sauf celui-ci ?', lock: "Verrouiller l'application", lockAfter: 'Verrouiller après', lockNow: 'Immédiatement', lock1: '1 minute', lock5: '5 minutes', empty: 'Aucun autre appareil.',
    signedOut: 'Appareil déconnecté.', changePin: 'Changer le code PIN',
  },
};

export const fr = { ...base, ...tabsFr, ...formsFr, ...moneyFr };
