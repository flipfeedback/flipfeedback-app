import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { asyncHandler, HttpError } from '../middleware/errors';
import { hashPassword } from '../lib/auth';

export const teamRouter = Router();
teamRouter.use(requireAuth);

// GET /team — members of the current organization (settings > team).
teamRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const members = await prisma.user.findMany({
      where: { organizationId: req.auth!.organizationId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });
    res.json(members);
  }),
);

const inviteSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(200),
  role: z.enum(['ADMIN', 'MEMBER']).optional(),
});

// POST /team — add a teammate. Only OWNER/ADMIN may invite.
teamRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const actor = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
    if (!actor || (actor.role !== 'OWNER' && actor.role !== 'ADMIN')) {
      throw new HttpError(403, 'Only owners and admins can add team members');
    }
    const body = inviteSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) throw new HttpError(409, 'A user with that email already exists');
    const member = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email,
        passwordHash: await hashPassword(body.password),
        role: body.role ?? 'MEMBER',
        organizationId: req.auth!.organizationId,
      },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });
    res.status(201).json(member);
  }),
);
