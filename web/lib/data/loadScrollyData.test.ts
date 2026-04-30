import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadScrollyData, resetScrollyDataCache } from '@/lib/data/loadScrollyData';

describe('loadScrollyData', () => {
  beforeEach(() => {
    resetScrollyDataCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetScrollyDataCache();
  });

  it('reads and parses scrolly-data.json', async () => {
    const readFile = vi.fn().mockResolvedValue(
      JSON.stringify({
        act1: { totalPills: 76_000_000_000, yearly: [{ year: 2006, pills: 8_000_000_000 }] },
        act2: { rows: [{ distributor: 'McKesson', start: 40, end: 35, emphasized: true }] },
        act3: { actions: [{ year: 2012, action_count: 40, notable_actions: [] }] },
        act4: { counties: [{ fips: '54059', name: 'Mingo', state: 'WV', deaths: [1, 2, 3] }] },
      }),
    );
    const data = await loadScrollyData({ readFile });
    expect(data.act1.totalPills).toBe(76_000_000_000);
    expect(data.act2.rows[0]!.distributor).toBe('McKesson');
    expect(data.act3.actions[0]!.year).toBe(2012);
    expect(data.act4.counties[0]!.fips).toBe('54059');
  });

  it('returns empty-fixture fallback when file missing', async () => {
    const readFile = vi.fn().mockRejectedValue(
      Object.assign(new Error('missing'), { code: 'ENOENT' }),
    );
    const data = await loadScrollyData({ readFile });
    expect(data.act1.totalPills).toBe(0);
    expect(data.act2.rows).toEqual([]);
  });
});
