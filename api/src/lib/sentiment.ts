import { Sentiment } from '@prisma/client';

const POSITIVE = [
  'love', 'great', 'excellent', 'amazing', 'awesome', 'fantastic', 'perfect',
  'happy', 'wonderful', 'helpful', 'easy', 'fast', 'intuitive', 'delight',
  'thank', 'thanks', 'good', 'nice', 'smooth', 'reliable', 'best',
];
const NEGATIVE = [
  'hate', 'terrible', 'awful', 'bad', 'broken', 'bug', 'crash', 'slow',
  'confusing', 'frustrating', 'frustrated', 'disappointed', 'useless',
  'worst', 'error', 'fail', 'failed', 'annoying', 'expensive', 'difficult',
  'missing', "doesn't", 'cannot', 'unable', 'poor', 'glitch', 'lag',
];

function escapeRegExp(word: string): string {
  return word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Match a term only when it starts at a word boundary, so we still catch the
// intended stems ("crash" -> "crashing", "thank" -> "thanks") but no longer
// fire on a term that merely appears mid-word ("lag" inside "flag").
function mentions(text: string, word: string): boolean {
  return new RegExp(`\\b${escapeRegExp(word)}`).test(text);
}

// A small lexicon-based sentiment classifier. Deliberately simple: counts
// positive vs negative term matches and picks a label. Good enough for the
// "simple sentiment" the product promises, and fully deterministic for tests.
export function classifySentiment(message: string): Sentiment {
  const text = message.toLowerCase();
  let score = 0;
  for (const word of POSITIVE) {
    if (mentions(text, word)) score += 1;
  }
  for (const word of NEGATIVE) {
    if (mentions(text, word)) score -= 1;
  }
  if (score > 0) return Sentiment.POSITIVE;
  if (score < 0) return Sentiment.NEGATIVE;
  return Sentiment.NEUTRAL;
}
