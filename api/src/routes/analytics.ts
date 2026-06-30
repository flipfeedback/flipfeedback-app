import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../middleware/errors';

export const analyticsRouter = Router();
analyticsRouter.use(requireAuth);

const query = z.object({
  // Lookback window in days for the time series and trend.
  days: z.coerce.number().int().min(1).max(365).optional(),
});

// GET /analytics — volume over time, breakdown by source/campaign, sentiment, trend.
analyticsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { days = 30 } = query.parse(req.query);
    const organizationId = req.auth!.organizationId;

    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCDate(since.getUTCDate() - (days - 1));

    const items = await prisma.feedback.findMany({
      where: { organizationId, createdAt: { gte: since } },
      include: { source: true },
    });

    // Volume over time: one bucket per day across the window (zero-filled).
    const dayBuckets = new Map<string, number>();
    for (let i = 0; i < days; i += 1) {
      const d = new Date(since);
      d.setUTCDate(since.getUTCDate() + i);
      dayBuckets.set(d.toISOString().slice(0, 10), 0);
    }
    for (const f of items) {
      const key = f.createdAt.toISOString().slice(0, 10);
      if (dayBuckets.has(key)) dayBuckets.set(key, (dayBuckets.get(key) ?? 0) + 1);
    }
    const volumeOverTime = [...dayBuckets.entries()].map(([date, count]) => ({ date, count }));

    // Breakdown by source.
    const bySourceMap = new Map<string, { sourceId: string; name: string; type: string; count: number }>();
    for (const f of items) {
      if (!f.source) continue;
      const cur = bySourceMap.get(f.source.id) ?? {
        sourceId: f.source.id,
        name: f.source.name,
        type: f.source.type,
        count: 0,
      };
      cur.count += 1;
      bySourceMap.set(f.source.id, cur);
    }
    const bySource = [...bySourceMap.values()].sort((a, b) => b.count - a.count);

    // Breakdown by campaign (sources that carry a campaign tag).
    const byCampaignMap = new Map<string, number>();
    for (const f of items) {
      const campaign = f.source?.campaign;
      if (!campaign) continue;
      byCampaignMap.set(campaign, (byCampaignMap.get(campaign) ?? 0) + 1);
    }
    const byCampaign = [...byCampaignMap.entries()]
      .map(([campaign, count]) => ({ campaign, count }))
      .sort((a, b) => b.count - a.count);

    // Sentiment breakdown.
    const sentiment = { POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0 } as Record<string, number>;
    for (const f of items) sentiment[f.sentiment] += 1;

    // Status breakdown across the whole org (not just window) for the triage health.
    const statusGroups = await prisma.feedback.groupBy({
      by: ['status'],
      where: { organizationId },
      _count: true,
    });
    const byStatus = { NEW: 0, IN_REVIEW: 0, RESOLVED: 0 } as Record<string, number>;
    for (const g of statusGroups) byStatus[g.status] = g._count;

    // Simple trend: compare first half vs second half of the window.
    const mid = Math.floor(days / 2);
    const firstHalf = volumeOverTime.slice(0, mid).reduce((s, d) => s + d.count, 0);
    const secondHalf = volumeOverTime.slice(mid).reduce((s, d) => s + d.count, 0);
    const trend = {
      firstHalf,
      secondHalf,
      // Percent change of recent half vs earlier half; null when no baseline.
      changePct: firstHalf === 0 ? null : Math.round(((secondHalf - firstHalf) / firstHalf) * 100),
      direction: secondHalf > firstHalf ? 'up' : secondHalf < firstHalf ? 'down' : 'flat',
    };

    res.json({
      windowDays: days,
      total: items.length,
      volumeOverTime,
      bySource,
      byCampaign,
      sentiment,
      byStatus,
      trend,
    });
  }),
);
