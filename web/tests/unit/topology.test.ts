import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  loadCountyTopology,
  loadStateTopology,
  resetTopologyCache,
} from '@/lib/geo/topology';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = join(HERE, '..', 'fixtures', 'tiny-topology.json');

describe('topology', () => {
  beforeEach(() => {
    resetTopologyCache();
  });

  it('loadCountyTopology returns FeatureCollection of counties', async () => {
    const raw = await readFile(FIXTURE_PATH, 'utf8');
    const fc = await loadCountyTopology({ json: JSON.parse(raw) });
    expect(fc.type).toBe('FeatureCollection');
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0]!.id).toBe('54059');
  });

  it('loadStateTopology returns FeatureCollection of states', async () => {
    const raw = await readFile(FIXTURE_PATH, 'utf8');
    const fc = await loadStateTopology({ json: JSON.parse(raw) });
    expect(fc.type).toBe('FeatureCollection');
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0]!.id).toBe('54');
  });

  it('memoizes across calls', async () => {
    const fetchSpy = vi.fn();
    const raw = await readFile(FIXTURE_PATH, 'utf8');
    const json = JSON.parse(raw);
    await loadCountyTopology({ json, onLoad: fetchSpy });
    await loadCountyTopology({ json, onLoad: fetchSpy });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
