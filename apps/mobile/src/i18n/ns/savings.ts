export const savingsEn = {
  savings: {
    title: 'Savings', subtitle: 'One balance for your goals', total: 'Total saved', available: 'Ready to assign', walletBalance: 'Wallet balance: {{amount}} FCFA',
    addMoney: 'Move money into savings', returnWallet: 'Return unassigned money to wallet', amount: 'Amount in FCFA', invalidAmount: 'Enter a whole amount greater than zero.',
    topUpHint: 'Money moves from your wallet into savings. If the wallet is empty, add money there first.', openWallet: 'Open wallet', goals: 'Your savings goals', newGoal: 'New goal',
    goalName: 'What are you saving for?', target: 'Target amount in FCFA', installment: 'Amount you plan to save each time', targetDate: 'Date you hope to reach it (optional)',
    lockUntil: 'Keep money locked until (optional)', lockNote: 'Money allocated to this goal cannot be moved back before the lock date. Choose carefully.',
    createGoal: 'Create savings goal', invalidGoal: 'Enter a name, target, and planned amount greater than zero.', empty: 'No savings goals yet.',
    projection: 'At this pace: about {{count}} more deposits, around {{date}}', goalDetail: 'Savings goal', saved: 'Saved so far', ofTarget: 'Target: {{amount}} FCFA',
    plan: 'Plan: {{amount}} FCFA {{frequency}}', lockedUntil: 'Locked until {{date}}', manage: 'Move money', moveToGoal: 'Transfer savings into this goal',
    moveBack: 'Return goal money to savings balance', notFound: 'Savings goal not found.', groups: 'Save with others', regularGroups: 'Regular savings groups', familyGroups: 'Family emergency funds',
  },
  familySavings: {
    title: 'Family emergency funds', subtitle: 'Save together in one shared fund', create: 'Create family fund', join: 'Join with invite code',
    empty: 'No family fund yet.', name: 'Fund name', namePlaceholder: 'Family emergency fund', code: 'Invite code', invite: 'Invite family', share: 'Share invite link',
    adultConfirm: 'I confirm that I am an adult and understand that a different adult member must approve an emergency withdrawal.',
    createAction: 'Create fund', joinAction: 'Join fund', pooled: 'One shared family balance', pooledHint: 'All contributions go into one shared fund. A withdrawal needs a request and approval from another adult member.',
    balance: 'Family balance', members: 'Members', contribute: 'Contribute from wallet', amount: 'Amount in FCFA', requests: 'Emergency requests', request: 'Request emergency withdrawal',
    reason: 'What is the emergency?', submitRequest: 'Send request', pending: 'Awaiting a second adult', approved: 'Approved and paid to requester’s wallet',
    approve: 'Approve withdrawal', yourRequest: 'Your request needs another member’s approval', noRequests: 'No emergency requests.',
    contributed: 'Contributions', contributedBy: 'Member contribution: {{amount}} FCFA', received: 'Paid to requester’s wallet after approval.',
    invalid: 'Enter a valid amount and describe the emergency.', preview: 'Fund: {{name}}', inviteMessage: 'Join our family emergency fund in My Life OS: {{link}}',
  },
};

export const savingsFr: typeof savingsEn = {
  savings: {
    title: 'Épargne', subtitle: 'Un solde pour vos objectifs', total: 'Total épargné', available: 'À répartir', walletBalance: 'Solde du portefeuille : {{amount}} FCFA',
    addMoney: 'Transférer vers l’épargne', returnWallet: 'Renvoyer le solde libre au portefeuille', amount: 'Montant en FCFA', invalidAmount: 'Saisissez un montant entier supérieur à zéro.',
    topUpHint: 'L’argent passe du portefeuille à l’épargne. Si le portefeuille est vide, ajoutez-y d’abord de l’argent.', openWallet: 'Ouvrir le portefeuille', goals: 'Vos objectifs d’épargne', newGoal: 'Nouvel objectif',
    goalName: 'Pour quoi épargnez-vous ?', target: 'Montant cible en FCFA', installment: 'Montant prévu à chaque versement', targetDate: 'Date souhaitée (facultatif)',
    lockUntil: 'Bloquer l’argent jusqu’au (facultatif)', lockNote: 'L’argent attribué à cet objectif ne peut pas être retiré avant la date de déblocage. Choisissez avec soin.',
    createGoal: 'Créer l’objectif', invalidGoal: 'Saisissez un nom, une cible et un montant prévu supérieurs à zéro.', empty: 'Aucun objectif d’épargne pour le moment.',
    projection: 'À ce rythme : environ {{count}} versements, vers le {{date}}', goalDetail: 'Objectif d’épargne', saved: 'Déjà épargné', ofTarget: 'Cible : {{amount}} FCFA',
    plan: 'Prévision : {{amount}} FCFA {{frequency}}', lockedUntil: 'Bloqué jusqu’au {{date}}', manage: 'Déplacer l’argent', moveToGoal: 'Transférer l’épargne vers cet objectif',
    moveBack: 'Renvoyer l’argent de l’objectif au solde libre', notFound: 'Objectif introuvable.', groups: 'Épargner ensemble', regularGroups: 'Groupes d’épargne classiques', familyGroups: 'Fonds d’urgence familiaux',
  },
  familySavings: {
    title: 'Fonds d’urgence familiaux', subtitle: 'Épargnez ensemble dans un fonds commun', create: 'Créer un fonds familial', join: 'Rejoindre avec un code',
    empty: 'Aucun fonds familial pour le moment.', name: 'Nom du fonds', namePlaceholder: 'Fonds d’urgence de la famille', code: 'Code d’invitation', invite: 'Inviter la famille', share: 'Partager le lien',
    adultConfirm: 'Je confirme être adulte et comprendre qu’un autre membre adulte doit approuver un retrait d’urgence.',
    createAction: 'Créer le fonds', joinAction: 'Rejoindre le fonds', pooled: 'Un solde commun pour la famille', pooledHint: 'Toutes les contributions vont dans un fonds commun. Un retrait exige une demande et l’accord d’un autre membre adulte.',
    balance: 'Solde familial', members: 'Membres', contribute: 'Verser depuis le portefeuille', amount: 'Montant en FCFA', requests: 'Demandes d’urgence', request: 'Demander un retrait d’urgence',
    reason: 'Quelle est l’urgence ?', submitRequest: 'Envoyer la demande', pending: 'En attente d’un autre adulte', approved: 'Approuvé et versé au portefeuille du demandeur',
    approve: 'Approuver le retrait', yourRequest: 'Votre demande exige l’accord d’un autre membre', noRequests: 'Aucune demande d’urgence.',
    contributed: 'Contributions', contributedBy: 'Contribution d’un membre : {{amount}} FCFA', received: 'Versé au portefeuille du demandeur après approbation.',
    invalid: 'Saisissez un montant valide et décrivez l’urgence.', preview: 'Fonds : {{name}}', inviteMessage: 'Rejoignez notre fonds d’urgence familial dans My Life OS : {{link}}',
  },
};
