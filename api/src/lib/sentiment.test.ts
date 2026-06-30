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
});
