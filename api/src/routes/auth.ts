import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { hashPassword, signToken, verifyPassword } from '../lib/auth';
import { asyncHandler, HttpError } from '../middleware/errors';
import { requireAuth } from '../middleware/auth';

export const authRouter = Router();

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'org';
}

const registerSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(200),
  organizationName: z.string().min(1).max(120),
});

// Register creates a new organization (tenant) and its first OWNER user.
authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const body = registerSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) {
      throw new HttpError(409, 'An account with that email already exists');
    }

    let slug = slugify(body.organizationName);
    // Ensure slug uniqueness with a numeric suffix if needed.
    for (let i = 1; await prisma.organization.findUnique({ where: { slug } }); i += 1) {
      slug = `${slugify(body.organizationName)}-${i}`;
    }

    const passwordHash = await hashPassword(body.password);
    const org = await prisma.organization.create({
      data: {
        name: body.organizationName,
        slug,
        users: {
          create: {
            name: body.name,
            email: body.email,
            passwordHash,
            role: 'OWNER',
          },
        },
      },
      include: { users: true },
    });

    const user = org.users[0];
    const token = signToken({ userId: user.id, organizationId: org.id });
    res.status(201).json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      organization: { id: org.id, name: org.name, slug: org.slug },
    });
  }),
);

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const body = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({
      where: { email: body.email },
      include: { organization: true },
    });
    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      throw new HttpError(401, 'Invalid email or password');
    }
    const token = signToken({ userId: user.id, organizationId: user.organizationId });
    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      organization: { id: user.organization.id, name: user.organization.name, slug: user.organization.slug },
    });
  }),
);

// Returns the current session principal. Used by the SPA on boot.
authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.auth!.userId },
      include: { organization: true },
    });
    if (!user) {
      throw new HttpError(401, 'Session user no longer exists');
    }
    res.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      organization: { id: user.organization.id, name: user.organization.name, slug: user.organization.slug },
    });
  }),
);

// Password reset stub (v1 scope: a stub). Always returns 200 so as not to leak
// which emails exist; real delivery is wired later.
const resetSchema = z.object({ email: z.string().email() });
authRouter.post(
  '/password-reset',
  asyncHandler(async (req, res) => {
    resetSchema.parse(req.body);
    res.json({ message: 'If an account exists for that email, a reset link has been sent.' });
  }),
);
