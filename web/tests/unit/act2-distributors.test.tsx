import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScrollyProgressContext } from '@/components/scrolly/progressContext';
import { Act2Distributors } from '@/components/scrolly/scenes/Act2Distributors';

const DATA = [
  { distributor: 'McKesson', start: 30, end: 40, emphasized: true },
  { distributor: 'Cardinal Health', start: 25, end: 35, emphasized: true },
  { distributor: 'AmerisourceBergen', start: 20, end: 30, emphasized: true },
  { distributor: 'H.D. Smith', start: 10, end: 8, emphasized: false },
  { distributor: 'Walgreens', start: 8, end: 6, emphasized: false },
];

describe('Act2Distributors', () => {
  it('renders slope lines for all distributors', () => {
    render(
      <ScrollyProgressContext.Provider value={1}>
        <Act2Distributors rows={DATA} />
      </ScrollyProgressContext.Provider>,
    );
    expect(screen.getAllByTestId('slope-line')).toHaveLength(5);
  });

  it('emphasized rows get accent-hot stroke; others muted', () => {
    render(
      <ScrollyProgressContext.Provider value={1}>
        <Act2Distributors rows={DATA} />
      </ScrollyProgressContext.Provider>,
    );
    const lines = screen.getAllByTestId('slope-line');
    expect(lines[0]!.getAttribute('stroke')).toMatch(/accent-hot|#c23b20/);
    expect(lines[3]!.getAttribute('stroke')).not.toMatch(/accent-hot|#c23b20/);
  });

  it('renders data table for a11y', () => {
    render(
      <ScrollyProgressContext.Provider value={0.5}>
        <Act2Distributors rows={DATA} />
      </ScrollyProgressContext.Provider>,
    );
    expect(screen.getByTestId('act2-table')).toBeInTheDocument();
  });
});
