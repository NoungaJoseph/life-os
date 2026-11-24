import { Router } from 'express';
import { deviceSession } from '../middleware/deviceSession';
import { requireAuth } from '../middleware/auth';
import { securityRouter } from './security.routes';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { created, ok } from '../utils/response';
import { goalsRepository } from '../repositories/goals.repository';
import { profileRepository } from '../repositories/profile.repository';
import { taxonomyRepository } from '../repositories/taxonomy.repository';
import { visionRepository } from '../repositories/vision.repository';
import {
  createGoalSchema,
  listGoalsQuery,
  setUserAreaSchema,
  updateProfileSchema,
  upsertVisionSchema,
  uuidParam,
} from '../validators/schemas';

import { plannerRouter } from './planner.routes';
import { smartRouter } from './smart.routes';
import { modulesRouter } from './modules.routes';
import { walletRouter } from './wallet.routes';
import { groupsRouter } from './groups.routes';
import { savingsRouter } from './savings.routes';
import { familySavingsRouter } from './family-savings.routes';
import { transformationRouter } from './transformation.routes';
import { screenTimeRouter } from './screen-time.routes';

export const v1Router = Router();

v1Router.use(requireAuth);
v1Router.use(deviceSession);
v1Router.use(securityRouter);
v1Router.use(walletRouter);
v1Router.use(groupsRouter);
v1Router.use(savingsRouter);
v1Router.use(familySavingsRouter);
v1Router.use(transformationRouter);
v1Router.use(screenTimeRouter);

// Profile
v1Router.get('/profile', asyncHandler(async (req, res) => {
  ok(res, await profileRepository.get(req.db!, req.userId!));
}));
v1Router.patch('/profile', validate(updateProfileSchema), asyncHandler(async (req, res) => {
  ok(res, await profileRepository.update(req.db!, req.userId!, req.body));
}));

// Life vision
v1Router.get('/life-vision', asyncHandler(async (req, res) => {
  ok(res, await visionRepository.get(req.db!, req.userId!));
}));
v1Router.put('/life-vision', validate(upsertVisionSchema), asyncHandler(async (req, res) => {
  ok(res, await visionRepository.upsert(req.db!, req.userId!, req.body));
}));

// Pillars and life areas
v1Router.get('/pillars', asyncHandler(async (req, res) => {
  ok(res, await taxonomyRepository.listPillars(req.db!));
}));
v1Router.get('/life-areas', asyncHandler(async (req, res) => {
  ok(res, await taxonomyRepository.listAreas(req.db!));
}));
v1Router.get('/me/life-areas', asyncHandler(async (req, res) => {
  ok(res, await taxonomyRepository.listUserAreas(req.db!, req.userId!));
}));
v1Router.put(
  '/me/life-areas/:id',
  validate(uuidParam, 'params'),
  validate(setUserAreaSchema),
  asyncHandler(async (req, res) => {
    ok(res, await taxonomyRepository.setUserArea(req.db!, req.userId!, req.params.id, req.body.is_active));
  }),
);

// Goals
v1Router.get('/goals', validate(listGoalsQuery, 'query'), asyncHandler(async (req, res) => {
  const { page, pageSize, sortBy, order, ...filters } = req.query as any;
  const { items, total } = await goalsRepository.list(req.db!, req.userId!, filters, page, pageSize, sortBy, order);
  ok(res, items, { page, pageSize, total });
}));
v1Router.post('/goals', validate(createGoalSchema), asyncHandler(async (req, res) => {
  created(res, await goalsRepository.create(req.db!, req.userId!, req.body));
}));
v1Router.get('/goals/:id', validate(uuidParam, 'params'), asyncHandler(async (req, res) => {
  ok(res, await goalsRepository.get(req.db!, req.userId!, req.params.id));
}));

v1Router.use(plannerRouter);
v1Router.use(smartRouter);
v1Router.use(modulesRouter);
