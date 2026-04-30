import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ExplorerErrorBoundary } from '@/components/errors/ExplorerErrorBoundary';
import { ScrollyErrorBoundary } from '@/components/errors/ScrollyErrorBoundary';

function Boom(): React.JSX.Element {
  throw new Error('boom');
}

describe('error boundaries', () => {
  it('ExplorerErrorBoundary catches render errors and shows report link', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ExplorerErrorBoundary>
        <Boom />
      </ExplorerErrorBoundary>,
    );
    expect(screen.getByText(/explorer ran into a problem/i)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /report/i });
    expect(link.getAttribute('href')).toContain('github.com');
    spy.mockRestore();
  });

  it('ScrollyErrorBoundary falls back to inline message', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ScrollyErrorBoundary>
        <Boom />
      </ScrollyErrorBoundary>,
    );
    expect(screen.getByText(/chart could not load/i)).toBeInTheDocument();
    spy.mockRestore();
  });
});
