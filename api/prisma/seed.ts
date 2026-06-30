/**
 * FlipFeedback seed entrypoint.
 *
 * Loads believable demo data so the inbox and analytics look lived-in:
 * a customer organization, a team, several sources (campaigns/channels/customers),
 * a set of labels, and a backlog of feedback items with varied content and
 * sentiment spread across the last ~45 days.
 *
 * Run with:  npm run seed   (from api/)  or  prisma db seed
 *
 * The richer, generator-driven seed data ultimately comes from flipfeedback-ops;
 * this entrypoint is the documented contract that consumes it. Until that lands,
 * the data below is self-contained and deterministic.
 *
 * Demo credentials (seed only, not a real secret): demo@flipfeedback.com / demo-password-123
 */
import { PrismaClient, SourceType, FeedbackStatus, Sentiment } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { classifySentiment } from '../src/lib/sentiment';

const prisma = new PrismaClient();

const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? 'demo-password-123';

// A deterministic pseudo-random generator so reseeding gives stable data.
function mulberry32(seed: number) {
  return function rand() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260629);
function pick<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

const SOURCES: { name: string; type: SourceType; campaign?: string }[] = [
  { name: 'Spring Launch Campaign', type: SourceType.CAMPAIGN, campaign: 'Spring Launch' },
  { name: 'Pricing Page A/B', type: SourceType.CAMPAIGN, campaign: 'Pricing 2026' },
  { name: 'Onboarding Email Series', type: SourceType.CAMPAIGN, campaign: 'Activation' },
  { name: 'In-App Widget', type: SourceType.CHANNEL },
  { name: 'Support Inbox', type: SourceType.CHANNEL },
  { name: 'App Store Reviews', type: SourceType.CHANNEL },
  { name: 'Acme Corp', type: SourceType.CUSTOMER },
  { name: 'Globex Industries', type: SourceType.CUSTOMER },
];

const LABELS = [
  { name: 'Bug', color: '#ef4444' },
  { name: 'Feature Request', color: '#3b82f6' },
  { name: 'Pricing', color: '#f59e0b' },
  { name: 'UX', color: '#8b5cf6' },
  { name: 'Performance', color: '#10b981' },
  { name: 'Billing', color: '#ec4899' },
];

// A pool of believable feedback messages with a mix of sentiment.
const MESSAGES = [
  'I love how fast the new dashboard loads. Great work on the performance improvements!',
  'The export button is broken on the analytics page, it just spins forever.',
  'Would be amazing if you added a dark mode. The white screen is hard on my eyes at night.',
  'Pricing is confusing. I cannot tell what the difference is between Pro and Team.',
  'The onboarding flow was smooth and easy, got set up in under five minutes. Thank you!',
  'App keeps crashing when I upload a large CSV. This is really frustrating.',
  'Customer support was incredibly helpful and resolved my issue quickly.',
  'The mobile experience is terrible, half the buttons are off screen.',
  'Please add the ability to bulk-assign feedback items. Doing them one by one is slow.',
  'Best feedback tool we have used. The triage workflow is intuitive and reliable.',
  'I am disappointed that the integration with Slack still does not work.',
  'Loading the inbox is slow when there are a lot of items. Some lag and a few errors.',
  'The new labels feature is fantastic and makes organizing so much easier.',
  'Billing charged me twice this month. Need someone to look into this please.',
  'Great product overall but the search is missing filters I really need.',
  'Awesome update! The sentiment analysis is surprisingly accurate.',
  'It is difficult to find where to connect a new source. The settings are confusing.',
  'Everything just works. Smooth, fast, and reliable. Highly recommend.',
  'There is a bug where assigning a teammate does not save sometimes.',
  'The analytics trends helped us catch a spike in complaints early. Very helpful.',
  'Why is the API so expensive? The per-seat pricing does not scale for us.',
  'Nice clean interface, but I wish notifications were configurable.',
  'The resolved status keeps reverting to new. Something is broken in the workflow.',
  'Thank you for shipping the campaign breakdown view, it is exactly what we wanted.',
  'Page errors out when I try to delete a label that is in use.',
];

const AUTHORS = [
  'jordan.m@acme.example',
  'sam.lee@globex.example',
  'taylor@initech.example',
  'casey.brown@umbrella.example',
  'morgan@hooli.example',
  null,
  'devon.k@stark.example',
  'riley@wayne.example',
];

async function main() {
  console.log('Seeding FlipFeedback demo data...');

  // Reset demo org idempotently by slug.
  const slug = 'demo-co';
  await prisma.organization.deleteMany({ where: { slug } });

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const org = await prisma.organization.create({
    data: {
      name: 'Demo Co',
      slug,
      users: {
        create: [
          { name: 'Demo Owner', email: 'demo@flipfeedback.com', passwordHash, role: 'OWNER' },
          { name: 'Priya Patel', email: 'priya@flipfeedback.com', passwordHash, role: 'ADMIN' },
          { name: 'Sam Rivera', email: 'sam@flipfeedback.com', passwordHash, role: 'MEMBER' },
        ],
      },
    },
    include: { users: true },
  });

  const sources = await Promise.all(
    SOURCES.map((s) =>
      prisma.source.create({ data: { ...s, organizationId: org.id } }),
    ),
  );

  const labels = await Promise.all(
    LABELS.map((l) =>
      prisma.label.create({ data: { ...l, organizationId: org.id } }),
    ),
  );

  const statuses: FeedbackStatus[] = ['NEW', 'NEW', 'NEW', 'IN_REVIEW', 'IN_REVIEW', 'RESOLVED'];
  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;

  let created = 0;
  // ~120 items spread over the last 45 days.
  for (let i = 0; i < 120; i += 1) {
    const message = pick(MESSAGES);
    const source = pick(sources);
    const status = pick(statuses);
    const daysAgo = Math.floor(rand() * 45);
    const createdAt = new Date(now - daysAgo * DAY - Math.floor(rand() * DAY));
    const assignedTo = status === 'NEW' && rand() > 0.4 ? null : pick(org.users);
    const sentiment: Sentiment = classifySentiment(message);

    const feedback = await prisma.feedback.create({
      data: {
        message,
        author: pick(AUTHORS),
        status,
        sentiment,
        createdAt,
        organizationId: org.id,
        sourceId: source.id,
        assignedToId: assignedTo ? assignedTo.id : null,
      },
    });

    // Attach 0-2 labels.
    const labelCount = Math.floor(rand() * 3);
    const chosen = new Set<string>();
    for (let j = 0; j < labelCount; j += 1) chosen.add(pick(labels).id);
    for (const labelId of chosen) {
      await prisma.feedbackLabel.create({ data: { feedbackId: feedback.id, labelId } });
    }
    created += 1;
  }

  console.log(`Seeded org "${org.name}" with ${sources.length} sources, ${labels.length} labels, ${created} feedback items.`);
  console.log(`Demo login: demo@flipfeedback.com / ${DEMO_PASSWORD}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
