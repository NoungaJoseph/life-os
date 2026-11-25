import { MonthlyReportData } from './monthly-report';
import { PdfDocument } from './pdf-writer';

type Lang = 'en' | 'fr';

const COPY = {
  en: {
    eyebrow: 'MY LIFE OS · MONTHLY LIFE REPORT',
    title: 'Growth & Life Review',
    preparedFor: 'Prepared for',
    scorecard: 'Monthly Scorecard',
    tasks: 'Tasks Done',
    habits: 'Habit Rate',
    checkins: 'Check-In Days',
    netSaved: 'Net Saved',
    radarTitle: 'Life Balance Map (5 Pillars)',
    areasTitle: 'Areas Worked On vs Needs Focus',
    workedOn: 'Areas Worked On',
    needsFocus: 'Needs Focus Next Month',
    noActivity: 'No recorded activity yet',
    allBalanced: 'All active areas had steady effort',
    heatmapTitle: '30/31-Day Consistency Heatmap',
    heatmapLegend: 'Light = 0 actions · Teal = active · Deep Teal = 5+ actions/day',
    habitsTitle: 'Habits Consistency',
    goalsTitle: 'Goals Progress',
    noHabits: 'No habits tracked this month.',
    noGoals: 'No active or completed goals this month.',
    financeTitle: 'Financial Growth (This Month vs Last Month)',
    income: 'Income',
    spent: 'Spent',
    net: 'Net',
    catTitle: 'Spending by Category',
    noExpenses: 'No expenses recorded this month.',
    bodyMindTitle: 'Food Routine, Body & Mind',
    breakfast: 'Breakfast Days',
    lunch: 'Lunch Days',
    dinner: 'Dinner Days',
    workouts: 'Workouts',
    reading: 'Reading Min',
    water: 'Avg Water',
    ratingTitle: 'Daily Check-In Rating Trend (1-5)',
    transTitle: 'Transformation Weekly Score (1-10)',
    reflectionsTitle: 'Wins, Lessons & Next Month Plan',
    wins: 'Top Wins',
    lessons: 'Key Lessons',
    nextFocus: 'Recommended Focus for Next Month',
    pageOf: 'Page {{p}} of 4',
    focusLabels: {
      pillar: 'Boost neglected pillar: {{v}}',
      habit: 'Rebuild habit consistency: {{v}} ({{pct}}%)',
      budget: 'Trim spending in {{v}} (over monthly budget)',
      meals: 'Follow your planned breakfast routine more consistently',
      checkin: 'Complete more 10 PM daily check-ins for clearer tracking',
    },
  },
  fr: {
    eyebrow: 'MY LIFE OS · RAPPORT MENSUEL DE VIE',
    title: 'Bilan de Croissance & Progrès',
    preparedFor: 'Préparé pour',
    scorecard: 'Tableau de bord du mois',
    tasks: 'Tâches faites',
    habits: 'Régularité',
    checkins: 'Jours de bilan',
    netSaved: 'Épargne nette',
    radarTitle: 'Carte d’équilibre (5 Piliers)',
    areasTitle: 'Domaines travaillés vs À renforcer',
    workedOn: 'Domaines travaillés',
    needsFocus: 'À renforcer le mois prochain',
    noActivity: 'Aucune activité enregistrée',
    allBalanced: 'Tous vos domaines ont progressé',
    heatmapTitle: 'Calendrier de régularité du mois',
    heatmapLegend: 'Clair = 0 action · Turquoise = actif · Foncé = 5+ actions/jour',
    habitsTitle: 'Constance des habitudes',
    goalsTitle: 'Progression des objectifs',
    noHabits: 'Aucune habitude suivie ce mois-ci.',
    noGoals: 'Aucun objectif actif ou terminé ce mois-ci.',
    financeTitle: 'Santé financière (Ce mois vs Mois dernier)',
    income: 'Revenus',
    spent: 'Dépenses',
    net: 'Solde net',
    catTitle: 'Dépenses par catégorie',
    noExpenses: 'Aucune dépense enregistrée ce mois-ci.',
    bodyMindTitle: 'Routine alimentaire, Corps & Esprit',
    breakfast: 'Jours Petit-déj',
    lunch: 'Jours Déjeuner',
    dinner: 'Jours Dîner',
    workouts: 'Entraînements',
    reading: 'Min de lecture',
    water: 'Eau moy./jour',
    ratingTitle: 'Évolution de la note quotidienne (1-5)',
    transTitle: 'Score hebdomadaire de transformation (1-10)',
    reflectionsTitle: 'Victoires, Leçons & Plan du mois prochain',
    wins: 'Principales victoires',
    lessons: 'Leçons retenues',
    nextFocus: 'Priorités recommandées pour le mois prochain',
    pageOf: 'Page {{p}} sur 4',
    focusLabels: {
      pillar: 'Renforcer le pilier négligé : {{v}}',
      habit: 'Relancer l’habitude : {{v}} ({{pct}} %)',
      budget: 'Réduire les dépenses en {{v}} (budget dépassé)',
      meals: 'Suivre plus régulièrement votre routine de petit-déjeuner',
      checkin: 'Faire plus de bilans du soir à 22 h pour mieux suivre vos progrès',
    },
  },
} as const;

const fmtNum = (n: number) => Math.round(n).toLocaleString('en-US');
const compactMoney = (n: number) => (Math.abs(n) >= 1000 ? `${Math.round(n / 1000)}k` : String(Math.round(n)));

function translateFocus(raw: string, lang: Lang): string {
  const f = COPY[lang].focusLabels;
  const [kind, val, pct] = raw.split(':');
  if (kind === 'pillar') return f.pillar.replace('{{v}}', val ?? '');
  if (kind === 'habit') return f.habit.replace('{{v}}', val ?? '').replace('{{pct}}', pct ?? '0');
  if (kind === 'budget') return f.budget.replace('{{v}}', val ?? '');
  if (kind === 'meals') return f.meals;
  return f.checkin;
}

function drawFooter(doc: PdfDocument, month: string, pageNum: number, lang: Lang) {
  doc.line(36, 804, 559, 804, '#E2E8F0', 0.8);
  doc.text(`MY LIFE OS · ${month}`, 36, 820, { size: 8.5, color: '#64748B' });
  doc.text(COPY[lang].pageOf.replace('{{p}}', String(pageNum)), 559, 820, { size: 8.5, color: '#64748B', align: 'right' });
}

export function renderMonthlyReportPdf(report: MonthlyReportData, lang: Lang = 'en'): Buffer {
  const c = COPY[lang];
  const doc = new PdfDocument();

  // ---- Page 1: Cover, Scorecard, 5-Pillar Radar Map & Worked/Needs Focus ----
  doc.rect(0, 0, 595, 118, { fill: '#14213D' });
  doc.rect(0, 114, 595, 4, { fill: '#C9A24B' });
  doc.text(c.eyebrow, 36, 36, { size: 9.5, font: 'bold', color: '#C9A24B' });
  doc.text(`${c.title} · ${report.month}`, 36, 66, { size: 22, font: 'serif', color: '#FFFFFF' });
  doc.text(`${c.preparedFor}: ${report.display_name || 'MY LIFE OS'} (${report.month_start} - ${report.month_end})`, 36, 92, { size: 10.5, color: '#CBD5E1' });

  doc.text(c.scorecard, 36, 146, { size: 13, font: 'bold', color: '#14213D' });
  const kpis = [
    { label: c.tasks, val: String(report.scorecard.tasks_completed), sub: `${report.scorecard.tasks_delta >= 0 ? '+' : ''}${report.scorecard.tasks_delta} MoM` },
    { label: c.habits, val: `${report.scorecard.habit_rate_pct}%`, sub: `${report.scorecard.habit_rate_delta >= 0 ? '+' : ''}${report.scorecard.habit_rate_delta}% MoM` },
    { label: c.checkins, val: `${report.scorecard.checkin_days}/${report.days_in_month}`, sub: report.scorecard.avg_rating ? `${report.scorecard.avg_rating}/5` : '-' },
    { label: c.netSaved, val: `${fmtNum(report.scorecard.net)}`, sub: report.currency },
  ];
  kpis.forEach((k, i) => {
    const x = 36 + i * 133;
    doc.rect(x, 158, 123, 66, { fill: '#F8FAFC', stroke: '#CBD5E1', lineWidth: 0.8 });
    doc.rect(x, 158, 123, 3, { fill: '#14B8A6' });
    doc.text(k.label, x + 10, 177, { size: 8.5, color: '#64748B' });
    doc.text(k.val, x + 10, 200, { size: 16, font: 'bold', color: '#0F172A' });
    doc.text(k.sub, x + 10, 215, { size: 8.5, color: '#0F766E' });
  });

  doc.text(c.radarTitle, 36, 252, { size: 13, font: 'bold', color: '#14213D' });
  const pillars = report.pillars.length ? report.pillars : [{ id: '1', name: 'Health', score: 0, events: 0, neglected: true }];
  doc.drawRadarChart(297, 392, 98, pillars.map((p) => p.name), pillars.map((p) => p.score));

  doc.text(c.areasTitle, 36, 540, { size: 13, font: 'bold', color: '#14213D' });
  doc.rect(36, 554, 252, 224, { fill: '#F0FDFA', stroke: '#99F6E4', lineWidth: 0.9 });
  doc.text(c.workedOn, 50, 576, { size: 11, font: 'bold', color: '#0F766E' });
  if (!report.areas.worked_on.length) {
    doc.text(c.noActivity, 50, 600, { size: 9.5, color: '#64748B' });
  } else {
    report.areas.worked_on.forEach((a, idx) => {
      doc.text(`• ${a.name} (${a.events})`, 50, 602 + idx * 24, { size: 9.5, color: '#0F172A' });
    });
  }

  doc.rect(307, 554, 252, 224, { fill: '#FFFBEB', stroke: '#FDE68A', lineWidth: 0.9 });
  doc.text(c.needsFocus, 321, 576, { size: 11, font: 'bold', color: '#B45309' });
  if (!report.areas.needs_work.length) {
    doc.text(c.allBalanced, 321, 600, { size: 9.5, color: '#0F766E' });
  } else {
    report.areas.needs_work.forEach((a, idx) => {
      doc.text(`• ${a.name} (${a.events})`, 321, 602 + idx * 24, { size: 9.5, color: '#0F172A' });
    });
  }
  drawFooter(doc, report.month, 1, lang);

  // ---- Page 2: Heatmap, Habits Consistency & Goals Progress ----
  doc.addPage();
  doc.text(c.heatmapTitle, 36, 48, { size: 14, font: 'bold', color: '#14213D' });
  doc.text(c.heatmapLegend, 36, 65, { size: 8.5, color: '#64748B' });
  doc.drawHeatmapGrid(36, 78, report.days_in_month, report.daily_heatmap.map((d) => d.activity_count));

  doc.text(c.habitsTitle, 36, 240, { size: 14, font: 'bold', color: '#14213D' });
  if (!report.habits.length) {
    doc.text(c.noHabits, 36, 265, { size: 10, color: '#64748B' });
  } else {
    doc.drawHorizontalBarChart(
      36,
      258,
      523,
      report.habits.slice(0, 10).map((h) => ({
        label: h.name,
        valuePct: h.rate_pct,
        display: `${h.rate_pct}% (${h.completed}/${h.due})`,
        color: h.rate_pct >= 70 ? '#0F766E' : h.rate_pct >= 40 ? '#14B8A6' : '#C9A24B',
      })),
    );
  }

  doc.text(c.goalsTitle, 36, 515, { size: 14, font: 'bold', color: '#14213D' });
  if (!report.goals.length) {
    doc.text(c.noGoals, 36, 540, { size: 10, color: '#64748B' });
  } else {
    doc.drawHorizontalBarChart(
      36,
      534,
      523,
      report.goals.slice(0, 10).map((g) => ({
        label: g.title,
        valuePct: g.progress_pct,
        display: `${g.progress_pct}%`,
        color: g.status === 'completed' ? '#0F766E' : '#223E66',
      })),
    );
  }
  drawFooter(doc, report.month, 2, lang);

  // ---- Page 3: Financial Grouped Chart, Categories & Body/Mind ----
  doc.addPage();
  doc.text(c.financeTitle, 36, 48, { size: 14, font: 'bold', color: '#14213D' });
  doc.drawGroupedBarChart(36, 68, 523, 180, [
    {
      label: c.income,
      current: report.finance.income,
      previous: report.finance.prev_income,
      currentLabel: compactMoney(report.finance.income),
      previousLabel: compactMoney(report.finance.prev_income),
    },
    {
      label: c.spent,
      current: report.finance.spent,
      previous: report.finance.prev_spent,
      currentLabel: compactMoney(report.finance.spent),
      previousLabel: compactMoney(report.finance.prev_spent),
    },
    {
      label: c.net,
      current: Math.max(0, report.finance.net),
      previous: Math.max(0, report.finance.prev_net),
      currentLabel: compactMoney(report.finance.net),
      previousLabel: compactMoney(report.finance.prev_net),
    },
  ]);

  doc.text(c.catTitle, 36, 282, { size: 14, font: 'bold', color: '#14213D' });
  if (!report.finance.categories.length) {
    doc.text(c.noExpenses, 36, 306, { size: 10, color: '#64748B' });
  } else {
    const maxCat = Math.max(1, ...report.finance.categories.map((cat) => cat.spent));
    doc.drawHorizontalBarChart(
      36,
      300,
      523,
      report.finance.categories.map((cat) => ({
        label: cat.category.toUpperCase(),
        valuePct: (cat.spent / maxCat) * 100,
        display: `${fmtNum(cat.spent)} ${report.currency}`,
        color: cat.over ? '#DC2626' : '#C9A24B',
      })),
    );
  }

  doc.text(c.bodyMindTitle, 36, 515, { size: 14, font: 'bold', color: '#14213D' });
  const bmTiles = [
    { label: c.breakfast, val: `${report.body_mind.breakfast_days}/${report.days_in_month}` },
    { label: c.lunch, val: `${report.body_mind.lunch_days}/${report.days_in_month}` },
    { label: c.dinner, val: `${report.body_mind.dinner_days}/${report.days_in_month}` },
    { label: c.workouts, val: String(report.body_mind.workouts) },
    { label: c.reading, val: String(report.body_mind.reading_minutes) },
    { label: c.water, val: `${report.body_mind.avg_water_ml} ml` },
  ];
  bmTiles.forEach((tile, idx) => {
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    const x = 36 + col * 178;
    const y = 532 + row * 78;
    doc.rect(x, y, 166, 64, { fill: '#F8FAFC', stroke: '#CBD5E1', lineWidth: 0.8 });
    doc.text(tile.label, x + 12, y + 22, { size: 9, color: '#64748B' });
    doc.text(tile.val, x + 12, y + 48, { size: 16, font: 'bold', color: '#14213D' });
  });
  drawFooter(doc, report.month, 3, lang);

  // ---- Page 4: Rating & Transformation Line Charts + Reflections & Focus Plan ----
  doc.addPage();
  doc.text(c.ratingTitle, 36, 48, { size: 14, font: 'bold', color: '#14213D' });
  const ratingPts = report.daily_heatmap
    .filter((d) => d.rating !== null)
    .map((d) => ({ label: String(d.day), value: d.rating! }));
  doc.drawLineChart(36, 68, 523, 130, ratingPts, 5, '#0F766E');

  doc.text(c.transTitle, 36, 232, { size: 14, font: 'bold', color: '#14213D' });
  const transPts = report.transformation.scores.map((s) => ({ label: s.week_start.slice(5), value: s.avg_score }));
  doc.drawLineChart(36, 252, 523, 130, transPts, 10, '#C9A24B');

  doc.text(c.reflectionsTitle, 36, 418, { size: 14, font: 'bold', color: '#14213D' });
  let curY = 442;
  doc.text(c.wins, 36, curY, { size: 11, font: 'bold', color: '#0F766E' });
  curY += 18;
  (report.reflections.wins.length ? report.reflections.wins : ['-']).forEach((w) => {
    curY = doc.wrappedText(`• ${w}`, 44, curY, 510, { size: 9.5, maxLines: 2 }) + 4;
  });

  curY += 8;
  doc.text(c.lessons, 36, curY, { size: 11, font: 'bold', color: '#14213D' });
  curY += 18;
  (report.reflections.lessons.length ? report.reflections.lessons : ['-']).forEach((l) => {
    curY = doc.wrappedText(`• ${l}`, 44, curY, 510, { size: 9.5, maxLines: 2 }) + 4;
  });

  curY += 12;
  doc.rect(36, curY, 523, 118, { fill: '#14213D' });
  doc.text(c.nextFocus, 50, curY + 22, { size: 11, font: 'bold', color: '#C9A24B' });
  let focusY = curY + 42;
  (report.reflections.next_month_focus.length ? report.reflections.next_month_focus.map((item) => translateFocus(item, lang)) : [c.allBalanced]).forEach((line) => {
    focusY = doc.wrappedText(`• ${line}`, 50, focusY, 495, { size: 9.5, color: '#FFFFFF', maxLines: 2 }) + 2;
  });
  drawFooter(doc, report.month, 4, lang);

  return doc.toBuffer();
}
