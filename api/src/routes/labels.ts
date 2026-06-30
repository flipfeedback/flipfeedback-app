import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { asyncHandler, HttpError } from '../middleware/errors';

export const labelsRouter = Router();
labelsRouter.use(requireAuth);

labelsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const labels = await prisma.label.findMany({
      where: { organizationId: req.auth!.organizationId },
      orderBy: { name: 'asc' },
    });
    res.json(labels);
  }),
);

const createSchema = z.object({
  name: z.string().min(1).max(60),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

labelsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = createSchema.parse(req.body);
    const existing = await prisma.label.findUnique({
      where: { organizationId_name: { organizationId: req.auth!.organizationId, name: body.name } },
    });
    if (existing) throw new HttpError(409, 'A label with that name already exists');
    const label = await prisma.label.create({
      data: {
        name: body.name,
        color: body.color ?? '#6366f1',
        organizationId: req.auth!.organizationId,
      },
    });
    res.status(201).json(label);
  }),
);

labelsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const existing = await prisma.label.findFirst({
      where: { id: req.params.id, organizationId: req.auth!.organizationId },
    });
    if (!existing) throw new HttpError(404, 'Label not found');
    await prisma.label.delete({ where: { id: existing.id } });
    res.status(204).end();
  }),
);
