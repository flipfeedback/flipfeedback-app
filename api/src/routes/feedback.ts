import { Router } from 'express';
import { z } from 'zod';
import { FeedbackStatus, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { asyncHandler, HttpError } from '../middleware/errors';
import { classifySentiment } from '../lib/sentiment';

export const feedbackRouter = Router();
feedbackRouter.use(requireAuth);

const STATUSES: FeedbackStatus[] = ['NEW', 'IN_REVIEW', 'RESOLVED'];

// Shape returned to the client, flattening the label join.
function serialize(f: Prisma.FeedbackGetPayload<{
  include: { source: true; assignedTo: true; labels: { include: { label: true } } };
}>) {
  return {
    id: f.id,
    message: f.message,
    author: f.author,
    status: f.status,
    sentiment: f.sentiment,
    createdAt: f.createdAt,
    updatedAt: f.updatedAt,
    source: f.source ? { id: f.source.id, name: f.source.name, type: f.source.type, campaign: f.source.campaign } : null,
    assignedTo: f.assignedTo ? { id: f.assignedTo.id, name: f.assignedTo.name } : null,
    labels: f.labels.map((fl) => ({ id: fl.label.id, name: fl.label.name, color: fl.label.color })),
  };
}

const includeAll = {
  source: true,
  assignedTo: true,
  labels: { include: { label: true } },
} as const;

const listQuery = z.object({
  status: z.enum(['NEW', 'IN_REVIEW', 'RESOLVED']).optional(),
  sourceId: z.string().optional(),
  sentiment: z.enum(['POSITIVE', 'NEUTRAL', 'NEGATIVE']).optional(),
  assignedToId: z.string().optional(),
  q: z.string().optional(),
  take: z.coerce.number().int().min(1).max(200).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

// GET /feedback — the inbox, with filters.
feedbackRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const query = listQuery.parse(req.query);
    const where: Prisma.FeedbackWhereInput = {
      organizationId: req.auth!.organizationId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.sourceId ? { sourceId: query.sourceId } : {}),
      ...(query.sentiment ? { sentiment: query.sentiment } : {}),
      ...(query.assignedToId ? { assignedToId: query.assignedToId } : {}),
      ...(query.q ? { message: { contains: query.q, mode: 'insensitive' } } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.feedback.findMany({
        where,
        include: includeAll,
        orderBy: { createdAt: 'desc' },
        take: query.take ?? 50,
        skip: query.skip ?? 0,
      }),
      prisma.feedback.count({ where }),
    ]);
    res.json({ items: items.map(serialize), total });
  }),
);

// GET /feedback/:id
feedbackRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const f = await prisma.feedback.findFirst({
      where: { id: req.params.id, organizationId: req.auth!.organizationId },
      include: includeAll,
    });
    if (!f) throw new HttpError(404, 'Feedback item not found');
    res.json(serialize(f));
  }),
);

const createSchema = z.object({
  message: z.string().min(1).max(5000),
  author: z.string().max(200).optional(),
  sourceId: z.string().min(1),
});

// POST /feedback — create an item (also used to simulate inbound feedback).
feedbackRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = createSchema.parse(req.body);
    const source = await prisma.source.findFirst({
      where: { id: body.sourceId, organizationId: req.auth!.organizationId },
    });
    if (!source) throw new HttpError(400, 'Unknown source for this organization');
    const created = await prisma.feedback.create({
      data: {
        message: body.message,
        author: body.author,
        sourceId: source.id,
        organizationId: req.auth!.organizationId,
        sentiment: classifySentiment(body.message),
      },
      include: includeAll,
    });
    res.status(201).json(serialize(created));
  }),
);

const updateSchema = z.object({
  status: z.enum(['NEW', 'IN_REVIEW', 'RESOLVED']).optional(),
  assignedToId: z.string().nullable().optional(),
});

// PATCH /feedback/:id — triage: change status / assignment.
feedbackRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const body = updateSchema.parse(req.body);
    const existing = await prisma.feedback.findFirst({
      where: { id: req.params.id, organizationId: req.auth!.organizationId },
    });
    if (!existing) throw new HttpError(404, 'Feedback item not found');

    if (body.assignedToId) {
      const assignee = await prisma.user.findFirst({
        where: { id: body.assignedToId, organizationId: req.auth!.organizationId },
      });
      if (!assignee) throw new HttpError(400, 'Assignee is not a member of this organization');
    }

    const updated = await prisma.feedback.update({
      where: { id: existing.id },
      data: {
        ...(body.status ? { status: body.status } : {}),
        ...(body.assignedToId !== undefined ? { assignedToId: body.assignedToId } : {}),
      },
      include: includeAll,
    });
    res.json(serialize(updated));
  }),
);

const labelSchema = z.object({ labelId: z.string().min(1) });

// POST /feedback/:id/labels — attach a label.
feedbackRouter.post(
  '/:id/labels',
  asyncHandler(async (req, res) => {
    const { labelId } = labelSchema.parse(req.body);
    const [f, label] = await Promise.all([
      prisma.feedback.findFirst({ where: { id: req.params.id, organizationId: req.auth!.organizationId } }),
      prisma.label.findFirst({ where: { id: labelId, organizationId: req.auth!.organizationId } }),
    ]);
    if (!f) throw new HttpError(404, 'Feedback item not found');
    if (!label) throw new HttpError(400, 'Unknown label for this organization');
    await prisma.feedbackLabel.upsert({
      where: { feedbackId_labelId: { feedbackId: f.id, labelId: label.id } },
      create: { feedbackId: f.id, labelId: label.id },
      update: {},
    });
    const updated = await prisma.feedback.findUniqueOrThrow({ where: { id: f.id }, include: includeAll });
    res.json(serialize(updated));
  }),
);

// DELETE /feedback/:id/labels/:labelId — detach a label.
feedbackRouter.delete(
  '/:id/labels/:labelId',
  asyncHandler(async (req, res) => {
    const f = await prisma.feedback.findFirst({
      where: { id: req.params.id, organizationId: req.auth!.organizationId },
    });
    if (!f) throw new HttpError(404, 'Feedback item not found');
    await prisma.feedbackLabel.deleteMany({ where: { feedbackId: f.id, labelId: req.params.labelId } });
    const updated = await prisma.feedback.findUniqueOrThrow({ where: { id: f.id }, include: includeAll });
    res.json(serialize(updated));
  }),
);

export { STATUSES };
