import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Header, Screen, Text } from '../src/components/ui';
import { useTheme } from '../src/theme/useTheme';

const guide = {
  en: {
    title: 'App guide', subtitle: 'A quick guide to each part of My Life OS',
    sections: [
      ['Getting started', 'Start by choosing a language, then follow the introduction. Create an account or sign in, complete your profile setup, and add your first goal and habit.'],
      ['Home', 'See today’s priorities, habits, goal progress, life balance and useful insights in one place. Use the + button to add a task, habit, goal or reflection.'],
      ['Goals', 'Create goals for a day, week, month, quarter, year or the long term. Connect them to a life area or pillar, then update progress and milestones from each goal’s detail page.'],
      ['Planner and habits', 'Choose a day in the planner to see its tasks. Add a task with a due date, mark it complete, or create a repeating habit and check it off each day.'],
      ['Life areas', 'Turn areas on or off to match your life. The tools and modules below them cover money, work, health, learning, and relationships. Tap a module to add or review its records.'],
      ['Money modules', 'Use Income and Expenses for transactions, Budgets for monthly limits, Savings Goals for targets, and External Savings to record money held outside the wallet.'],
      ['Work and projects', 'Track projects, responsibilities, calendar events, social content and platform limits. Open a project to see its tasks and financial metrics.'],
      ['Food and fitness', 'Plan shopping with Grocery, record what you have in Inventory, and log meals, water, workouts and exercise sessions.'],
      ['Reading and learning', 'Track books and pages in Reading, record study or meditation time in Sessions, and save lessons in Notes.'],
      ['Relationships and reminders', 'Keep important dates and private relationship notes. Set reminders for habits, tasks, exercise or other priorities, then manage notification preferences in Settings.'],
      ['Finance and debts', 'Record income and spending to see your monthly totals and budget progress. Track money you owe or are owed, due dates, and repayments on the Debts page.'],
      ['Wallet', 'See your wallet balance and transaction history. Add or withdraw money through the available Mobile Money options; check each transaction’s status before relying on its balance.'],
      ['Goal vault', 'Move wallet money into goal savings. Vault money stays locked until the goal’s target is reached, so read the terms on the Vault page before depositing.'],
      ['Group savings', 'Create a savings group or join with an invite code. Each member contributes to their own locked share, follows the payment schedule, and receives their savings at the end date.'],
      ['Journal and coach', 'Write private reflections in your journal. The AI coach can offer guidance from your app data when the server’s AI feature is enabled.'],
      ['Reviews and insights', 'Use weekly and monthly reviews to look at completed work and set priorities. Insights highlight patterns in your tasks, habits and goals as you use the app.'],
      ['Personal transformation', 'Describe a change you want to make, add behaviors to build or leave behind, and record weekly check-ins to see progress over time.'],
      ['Screen time', 'On supported Android builds, grant the required phone permissions, choose an app and a daily limit, then review usage or start a block. iPhone blocking is unavailable in this version.'],
      ['Profile, settings and security', 'Edit your setup, notifications and privacy preferences from Profile and Settings. Use a PIN to lock the app, inspect signed-in devices, or sign out other sessions.'],
    ],
  },
  fr: {
    title: "Guide de l’application", subtitle: 'Découvrez chaque partie de My Life OS',
    sections: [
      ['Premiers pas', 'Choisissez une langue, puis parcourez la présentation. Créez un compte ou connectez-vous, complétez votre profil et ajoutez un premier objectif et une habitude.'],
      ['Accueil', 'Retrouvez les priorités du jour, les habitudes, les objectifs, l’équilibre de vie et les conseils. Le bouton + permet d’ajouter une tâche, une habitude, un objectif ou une réflexion.'],
      ['Objectifs', 'Créez des objectifs quotidiens, hebdomadaires, mensuels, trimestriels, annuels ou à long terme. Reliez-les à un domaine ou un pilier, puis suivez leur progression et leurs étapes.'],
      ['Agenda et habitudes', 'Choisissez un jour pour voir ses tâches. Ajoutez une échéance, marquez les tâches terminées, ou créez une habitude régulière à cocher chaque jour.'],
      ['Domaines de vie', 'Activez les domaines qui vous concernent. Les outils et modules regroupent finances, travail, santé, apprentissage et relations. Ouvrez un module pour ajouter ou consulter ses données.'],
      ['Modules financiers', 'Saisissez les transactions dans Revenus et Dépenses, fixez des limites mensuelles dans Budgets, définissez des cibles dans Objectifs d’épargne et notez les fonds conservés ailleurs dans Épargne externe.'],
      ['Travail et projets', 'Suivez projets, responsabilités, événements, contenus sociaux et limites de plateformes. Ouvrez un projet pour voir ses tâches et ses indicateurs financiers.'],
      ['Alimentation et activité', 'Préparez les courses, suivez vos stocks, puis notez repas, eau, entraînements et séances d’exercice.'],
      ['Lecture et apprentissage', 'Suivez vos livres et pages dans Lecture, enregistrez vos temps d’étude ou de méditation dans Séances et gardez vos leçons dans Notes.'],
      ['Relations et rappels', 'Notez les dates importantes et vos réflexions privées. Programmez des rappels pour habitudes, tâches, sport ou autres priorités, puis gérez les notifications dans Réglages.'],
      ['Finances et dettes', 'Enregistrez revenus et dépenses pour suivre le mois et vos budgets. Dans Dettes, suivez ce que vous devez ou ce qu’on vous doit, les échéances et les remboursements.'],
      ['Portefeuille', 'Consultez le solde et l’historique des transactions. Ajoutez ou retirez de l’argent avec les options Mobile Money disponibles et vérifiez le statut de chaque transaction.'],
      ['Coffre à objectifs', 'Transférez de l’argent du portefeuille vers un objectif d’épargne. Cet argent reste bloqué jusqu’à ce que la cible soit atteinte ; lisez les conditions du Coffre avant de verser.'],
      ['Épargne en groupe', 'Créez un groupe ou rejoignez-en un avec un code. Chaque membre épargne dans sa propre part bloquée, suit le calendrier et récupère son épargne à la date de fin.'],
      ['Journal et coach', 'Écrivez vos réflexions privées dans le journal. Le coach IA peut vous guider à partir des données de l’application lorsque cette fonction est activée sur le serveur.'],
      ['Bilans et conseils', 'Faites un bilan hebdomadaire ou mensuel pour voir le travail accompli et définir vos priorités. Les conseils révèlent les tendances de vos tâches, habitudes et objectifs.'],
      ['Transformation personnelle', 'Décrivez le changement souhaité, ajoutez des comportements à développer ou à laisser, et notez vos bilans hebdomadaires pour suivre votre évolution.'],
      ['Temps d’écran', 'Sur les versions Android compatibles, accordez les autorisations du téléphone, choisissez une application et une limite quotidienne, puis consultez l’usage ou lancez un blocage. Le blocage sur iPhone n’est pas disponible dans cette version.'],
      ['Profil, réglages et sécurité', 'Modifiez votre profil, les notifications et la confidentialité. Protégez l’application avec un code PIN, vérifiez les appareils connectés ou déconnectez les autres sessions.'],
    ],
  },
} as const;

const icons = ['sparkles-outline', 'home-outline', 'flag-outline', 'calendar-outline', 'grid-outline', 'cash-outline', 'briefcase-outline', 'fitness-outline', 'book-outline', 'heart-outline', 'stats-chart-outline', 'card-outline', 'wallet-outline', 'lock-closed-outline', 'people-outline', 'journal-outline', 'analytics-outline', 'leaf-outline', 'hourglass-outline', 'settings-outline'] as const;

export default function Guide() {
  const { i18n } = useTranslation();
  const theme = useTheme();
  const content = guide[i18n.language === 'fr' ? 'fr' : 'en'];
  return <Screen bottomPad={40}>
    <Header title={content.title} subtitle={content.subtitle} back />
    {content.sections.map(([title, body], index) => <View key={title} className="gap-2 border-b border-line py-4">
      <View className="flex-row items-center gap-3">
        <Ionicons name={icons[index]} size={21} color={theme.primary} />
        <Text size="lg" serif>{title}</Text>
      </View>
      <Text size="sm" muted>{body}</Text>
    </View>)}
  </Screen>;
}
