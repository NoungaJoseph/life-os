-- Default five pillars and ten life areas (system rows: user_id is null)
insert into public.life_pillars (slug, name, purpose, sort_order) values
  ('financial-growth', 'Financial Growth', 'Develop financial stability, independence and responsible money management.', 1),
  ('professional-excellence', 'Professional Excellence', 'Grow professionally, improve skills and become more effective in your career.', 2),
  ('character-development', 'Character Development', 'Build discipline, honesty, emotional maturity, communication and personal responsibility.', 3),
  ('health-wellbeing', 'Health and Wellbeing', 'Support sustainable physical health, nutrition, fitness, sleep and recovery.', 4),
  ('peace-relationships', 'Peace and Relationships', 'Develop healthy relationships, meaningful connections, boundaries and a balanced personal life.', 5)
on conflict do nothing;

insert into public.life_areas (slug, name, description, sort_order) values
  ('work', 'Work and Professional Life', 'Responsibilities, priorities, deliverables and achievements.', 1),
  ('communication', 'Communication and Personal Development', 'Speaking, listening, vocabulary and presentation practice.', 2),
  ('social-media', 'Social Media and Social Life', 'Platforms, content calendar and screen-time goals.', 3),
  ('food-shopping', 'Food Shopping and Meal Preparation', 'Grocery lists, inventory and meal prep.', 4),
  ('nutrition', 'Nutrition and Healthy Eating', 'Meal planning, food diary and water tracking.', 5),
  ('fitness', 'Fitness and Physical Activity', 'Workouts, walking, recreation and recovery.', 6),
  ('reading-study', 'Meditation, Reading and Studying', 'Books, study sessions, reflection and key lessons.', 7),
  ('finance', 'Finance and Savings', 'Income, expenses, budgets, savings and debts.', 8),
  ('projects', 'Personal Businesses and Projects', 'Projects, customers, revenue, metrics and milestones.', 9),
  ('relationships', 'Relationships and Personal Life', 'Important dates, family, friendships and reflections.', 10)
on conflict do nothing;

-- Area -> pillar links (an area may belong to several pillars)
insert into public.life_area_pillars (life_area_id, pillar_id)
select a.id, p.id
from (values
  ('finance','financial-growth'), ('projects','financial-growth'),
  ('work','professional-excellence'), ('projects','professional-excellence'), ('reading-study','professional-excellence'),
  ('communication','character-development'), ('reading-study','character-development'),
  ('food-shopping','health-wellbeing'), ('nutrition','health-wellbeing'), ('fitness','health-wellbeing'),
  ('social-media','peace-relationships'), ('relationships','peace-relationships'), ('communication','peace-relationships')
) as m(area_slug, pillar_slug)
join public.life_areas a on a.slug = m.area_slug and a.user_id is null
join public.life_pillars p on p.slug = m.pillar_slug and p.user_id is null
on conflict do nothing;

-- Built-in beginner-friendly routines (user_id null = visible to everyone, read-only)
insert into public.workouts (name, kind, level, equipment, duration_min, instructions) values
  ('Gentle full-body starter', 'home', 'beginner', 'none', 20,
   E'Warm up 3 minutes: march in place and roll your shoulders.\nDo each move for 30 seconds, rest 30 seconds, and go around twice:\n1. Bodyweight squats: sit your hips back, keep your chest up and knees over your toes.\n2. Wall or knee push-ups: keep your body in a straight line.\n3. Glute bridges: lie on your back, press through your heels to lift your hips.\n4. Standing knee lifts: alternate sides, stay tall.\nCool down 3 minutes of slow breathing and stretching. Stop if anything hurts, and speak to a doctor before starting if you have a health condition.'),
  ('Brisk walk', 'walking', 'beginner', 'none', 30,
   E'Walk at a pace where you can talk but not sing. Keep your shoulders relaxed and arms swinging naturally.\nStart with 5 minutes easy, 20 minutes brisk, 5 minutes easy. Drink water before and after.'),
  ('Morning mobility', 'mobility', 'beginner', 'none', 10,
   E'Move slowly and breathe steadily. 5 slow reps each:\n1. Neck tilts side to side.\n2. Shoulder circles forward and back.\n3. Cat-cow on hands and knees.\n4. Hip circles standing.\n5. Hamstring stretch: hold 20 seconds each leg.\nNever force a stretch into pain.'),
  ('Easy run-walk intervals', 'running', 'beginner', 'none', 25,
   E'Warm up with 5 minutes of walking.\nRepeat 6 times: jog gently for 1 minute, walk for 2 minutes.\nCool down with 5 minutes of walking. Keep the jog slow enough to hold a conversation. Rest a day between sessions.')
on conflict do nothing;
