import { describe, expect, it } from 'vitest';
import { classifySentiment } from './sentiment';

describe('classifySentiment', () => {
  it('classifies clearly positive messages as POSITIVE', () => {
    expect(classifySentiment('I love this, it is great and fast!')).toBe('POSITIVE');
    expect(classifySentiment('Awesome update, the team is amazing')).toBe('POSITIVE');
  });

  it('classifies clearly negative messages as NEGATIVE', () => {
    expect(classifySentiment('This is terrible, the app keeps crashing')).toBe('NEGATIVE');
    expect(classifySentiment('Broken and slow, very frustrating')).toBe('NEGATIVE');
  });

  it('falls back to NEUTRAL with no signal', () => {
    expect(classifySentiment('I have a question about the export feature')).toBe('NEUTRAL');
  });

  it('is deterministic for the same input', () => {
    const msg = 'The pricing is confusing but support was helpful';
    expect(classifySentiment(msg)).toBe(classifySentiment(msg));
  });

  it('does not treat a term embedded mid-word as a match', () => {
    // "flag" contains "lag" (a NEGATIVE term). Flagging feedback is neutral
    // triage vocabulary and must not be scored as negative.
    expect(classifySentiment('Please flag this feedback for the team')).toBe('NEUTRAL');
  });

  it('still matches intended word stems at a word boundary', () => {
    // Regression guard: word-boundary matching must keep catching stems.
    expect(classifySentiment('The app keeps crashing on load')).toBe('NEGATIVE'); // crash
    expect(classifySentiment('Thanks, this is really helpful')).toBe('POSITIVE'); // thank(s), helpful
  });
});
