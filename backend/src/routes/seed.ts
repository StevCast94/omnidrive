import { Router, Request, Response } from 'express';
import { prisma } from '../../prisma/seed';
import { asyncHandler } from '../middleware/asyncHandler';

export const seedRouter = Router();

// GET /api/seed — ejecutar seed data
seedRouter.get('/', asyncHandler(async (_req: Request, res: Response) => {
  await prisma();
  return res.json({ data: { seeded: true }, error: null });
}));
