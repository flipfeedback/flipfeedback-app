import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { asyncHandler, HttpError } from '../middleware/errors';

export const sourcesRouter = Router();
sourcesRouter.use(requireAuth);

// GET /sources — connected sources, with a feedback count each.
sourcesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const sources = await prisma.source.findMany({
      where: { organizationId: req.auth!.organizationId },
      orderBy: { createdAt: 'asc' },
      include: { _count: { select: { feedback: true } } },
    });
    res.json(
      sources.map((s) => ({
        id: s.id,
        name: s.name,
        type: s.type,
        campaign: s.campaign,
        connected: s.connected,
        feedbackCount: s._count.feedback,
        createdAt: s.createdAt,
      })),
    );
  }),
);

const createSchema = z.object({
  name: z.string().min(1).max(120),
  type: z.enum(['CAMPAIGN', 'CHANNEL', 'CUSTOMER']),
  campaign: z.string().max(120).optional(),
});

sourcesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = createSchema.parse(req.body);
    const source = await prisma.source.create({
      data: { ...body, organizationId: req.auth!.organizationId },
    });
    res.status(201).json(source);
  }),
);

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  connected: z.boolean().optional(),
  campaign: z.string().max(120).nullable().optional(),
});

sourcesRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const body = updateSchema.parse(req.body);
    const existing = await prisma.source.findFirst({
      where: { id: req.params.id, organizationId: req.auth!.organizationId },
    });
    if (!existing) throw new HttpError(404, 'Source not found');
    const updated = await prisma.source.update({ where: { id: existing.id }, data: body });
    res.json(updated);
  }),
);
