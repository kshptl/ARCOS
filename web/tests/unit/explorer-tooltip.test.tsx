import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MapTooltip } from '@/components/explorer/Tooltip';

describe('MapTooltip', () => {
  it('renders county name + state + value', () => {
    render(
      <MapTooltip
        county={{ fips: '54059', name: 'Mingo', state: 'WV', pop: 26000 }}
        value={1000}
        metricLabel="Pills"
        year={2012}
        x={10}
        y={20}
      />,
    );
    expect(screen.getByText(/Mingo, WV/)).toBeInTheDocument();
    expect(screen.getByText(/2012/)).toBeInTheDocument();
    expect(screen.getByText(/1,000/)).toBeInTheDocument();
  });

  it('returns null when county is null', () => {
    const { container } = render(
      <MapTooltip county={null} value={null} metricLabel="Pills" year={2012} x={0} y={0} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
