/**
 * Evidence universe — expert-system threshold pins (2026-09-04).
 *
 * The architectural principle under test:
 *
 *   retrieval universe ≠ evidence classification ≠ assertion licence
 *
 * Retrieval is broad; the registry classifies known sources (publications
 * and video channels, on equal footing); admission licenses claims. One
 * categorical exclusion exists — 6moons — and it is enforced explicitly on
 * every path, not by absence from a list.
 */
import { describe, it, expect } from 'vitest';
import {
  isExcludedSource, getSourceEntry, isWhitelistedSource,
} from '../source-whitelist';
import { admitReviewObservation } from '../independent-review';
import {
  resolveCandidatePublication, admitAndStore, establishBrandFromPage,
} from '../independent-review-acquisition';

const BASE = {
  productKey: 'klipsch rp-600m ii',
  productName: 'Klipsch RP-600M II',
  observationType: 'listening' as const,
  claim: 'Heard as lively and forward in the upper midrange.',
  retrievedAt: 1,
};

describe('1 — 6moons is categorically excluded on every path', () => {
  it('is excluded by name and by URL', () => {
    expect(isExcludedSource('6moons')).toBe(true);
    expect(isExcludedSource('https://6moons.com/audioreviews/job225/1.html')).toBe(true);
    expect(isExcludedSource('https://www.6moons.com/anything')).toBe(true);
    expect(isExcludedSource('Stereophile')).toBe(false);
  });

  it('admission rejects it even page-verified', () => {
    const v = admitReviewObservation('Klipsch RP-600M II', {
      ...BASE,
      publication: '6moons',
      sourceUrl: 'https://6moons.com/review',
      pageVerified: true,
    });
    expect(v.admitted).toBe(false);
  });

  it('acquisition resolution rejects it before admission', () => {
    const r = resolveCandidatePublication({
      publication: '6moons', sourceUrl: 'https://6moons.com/review',
    });
    expect('reason' in r).toBe(true);
  });

  it('is not on the registry', () => {
    expect(isWhitelistedSource('6moons')).toBe(false);
  });
});

describe('2 — broad non-6moons sources are discoverable, not whitelist-rejected', () => {
  it('an unlisted named source with a real URL resolves as unlisted rather than unresolvable', () => {
    const r = resolveCandidatePublication({
      publication: 'Audio Science Journal',
      sourceUrl: 'https://audiosciencejournal.example/rp600m-ii-review',
    });
    expect(r).toEqual({ publication: 'Audio Science Journal', unlisted: true });
  });

  it('an unlisted source is admitted when its own page establishes the product', async () => {
    const fetcher = (async () => new Response(
      '<html><body>Klipsch RP-600M II review — we listened at length…</body></html>',
      { status: 200 },
    )) as unknown as typeof fetch;
    const out = await admitAndStore('Klipsch RP-600M II', 'klipsch rp-600m ii', [{
      productName: 'Klipsch RP-600M II',
      publication: 'Some Specialist Blog',
      reviewer: 'A. Writer',
      sourceUrl: 'https://somespecialistblog.example/rp600m-ii',
      observationType: 'listening',
      claim: 'Reported strong dynamics at low volume.',
      condition: { kind: 'level', description: 'observed at low listening volume' },
    }], 1, fetcher);
    expect(out.status).toBe('observations');
    if (out.status === 'observations') {
      expect(out.observations[0].sourceKind).toBe('unlisted');
      expect(out.observations[0].pageVerified).toBe(true);
      expect(out.observations[0].publication).toBe('Some Specialist Blog');
    }
  });

  it('an unlisted source whose page does NOT establish the product is rejected — the page is the anchor', async () => {
    const fetcher = (async () => new Response(
      '<html><body>a page about something else entirely</body></html>',
      { status: 200 },
    )) as unknown as typeof fetch;
    const out = await admitAndStore('Klipsch RP-600M II', 'klipsch rp-600m ii', [{
      productName: 'Klipsch RP-600M II',
      publication: 'Some Specialist Blog',
      sourceUrl: 'https://somespecialistblog.example/other',
      observationType: 'listening',
      claim: 'Reported strong dynamics.',
    }], 1, fetcher);
    expect(out.status).toBe('no_coverage');
    if (out.status === 'no_coverage') {
      expect(out.rejected[0].detail).toMatch(/did not establish/);
    }
  });

  it('unlisted verification never fetches an excluded host', async () => {
    const state = await establishBrandFromPage(
      'https://6moons.com/review', 'Klipsch',
      (async () => new Response('<html>Klipsch RP-600M II</html>')) as unknown as typeof fetch,
      { allowUnlistedHost: true },
    );
    expect(state).toBe('absent');
  });
});

describe('3 — credible YouTube listening evidence is admitted and attributed', () => {
  it('the priority channels are registered as video channels', () => {
    for (const name of ['CheapAudioMan', 'OCD HiFi Guy', 'Thomas & Stereo',
      'A British Audiophile', 'The Audiophiliac']) {
      const entry = getSourceEntry(name);
      expect(entry, name).toBeTruthy();
      expect(entry?.kind, name).toBe('video_channel');
    }
  });

  it('a channel observation admits with attribution, exactly as a written one', () => {
    const v = admitReviewObservation('Klipsch RP-600M II', {
      ...BASE,
      publication: 'CheapAudioMan',
      reviewer: 'Randy',
      sourceUrl: 'https://www.youtube.com/watch?v=abc123',
    });
    expect(v.admitted).toBe(true);
  });

  it('acquisition classifies a registry channel as video_channel', async () => {
    const out = await admitAndStore('Klipsch RP-600M II', 'klipsch rp-600m ii', [{
      productName: 'Klipsch RP-600M II',
      publication: 'CheapAudioMan',
      reviewer: 'Randy',
      sourceUrl: 'https://www.youtube.com/watch?v=abc123',
      observationType: 'listening',
      claim: 'Heard as punchy and lively for the money.',
    }], 1, (async () => new Response('')) as unknown as typeof fetch);
    expect(out.status).toBe('observations');
    if (out.status === 'observations') {
      expect(out.observations[0].sourceKind).toBe('video_channel');
    }
  });
});

describe('4 — no blanket written-over-video hierarchy', () => {
  it('kind is a classification; tier semantics are shared, not stratified by medium', () => {
    const video = getSourceEntry('CheapAudioMan');
    const written = getSourceEntry('Positive Feedback');
    expect(video?.tier).toBe(written?.tier); // both 'acceptable'
    // A video channel can hold the PREFERRED tier — medium does not cap tier.
    expect(getSourceEntry('Darko Audio (video)')?.tier).toBe('preferred');
  });

  it('admission applies identical terms to both media', () => {
    const writtenVerdict = admitReviewObservation('Klipsch RP-600M II', {
      ...BASE, publication: 'Stereophile',
      sourceUrl: 'https://www.stereophile.com/content/rp600m-ii',
    });
    const videoVerdict = admitReviewObservation('Klipsch RP-600M II', {
      ...BASE, publication: 'Thomas & Stereo',
      sourceUrl: 'https://www.youtube.com/watch?v=xyz',
    });
    expect(writtenVerdict.admitted).toBe(true);
    expect(videoVerdict.admitted).toBe(true);
  });
});

describe('14 — related-model evidence stays explicitly related-model', () => {
  it('a different model without a maker bridge is rejected, not silently transferred', () => {
    const v = admitReviewObservation('Klipsch RP-600M II', {
      ...BASE,
      productName: 'Klipsch Heresy IV',
      publication: 'Stereophile',
      sourceUrl: 'https://www.stereophile.com/content/heresy-iv',
    });
    expect(v.admitted).toBe(false);
  });

  it('a maker-bridged different model admits only with the reference named in its condition', () => {
    const v = admitReviewObservation('Goldmund / JOB INTegrated', {
      productKey: 'job integrated',
      productName: 'JOB 225',
      publication: 'Sound & Vision',
      sourceUrl: 'https://www.soundandvision.com/content/job-225',
      observationType: 'listening',
      claim: 'Heard as firm and well-controlled in the bass.',
      familyBridge: {
        referenceName: 'JOB 225',
        makerStatementUrl: 'https://web.archive.org/web/2016/jobsys.com/products',
      },
      condition: {
        kind: 'other',
        description: 'observed on the JOB 225, whose power-amplifier circuit the maker states the INTegrated shares',
      },
      retrievedAt: 1,
    });
    expect(v.admitted).toBe(true);
  });
});
