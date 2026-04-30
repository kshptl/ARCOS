import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/components/explorer/Explorer', () => ({
  Explorer: () => <div data-testid="explorer-client">ok</div>,
}));

vi.mock('@/lib/data/loadCountyMeta', () => ({
  loadCountyMeta: vi.fn().mockResolvedValue([
    { fips: '54059', name: 'Mingo', state: 'WV', pop: 26000 },
  ]),
}));

import Page from '@/app/explorer/page';

describe('Explorer page', () => {
  it('renders the client Explorer with county meta', async () => {
    const ui = await Page();
    render(ui);
    expect(screen.getByTestId('explorer-client')).toBeInTheDocument();
  });

  it('has Explorer in document title via metadata export', async () => {
    const { metadata } = await import('@/app/explorer/page');
    expect((metadata as { title?: string }).title).toMatch(/Explorer/);
  });
});
