import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScrollyStage } from '@/components/scrolly/ScrollyStage';

describe('ScrollyStage', () => {
  it('renders with a sticky canvas slot and children', () => {
    render(
      <ScrollyStage canvas={<div data-testid="canvas">map</div>} ariaLabel="test">
        <div data-testid="child">step</div>
      </ScrollyStage>,
    );
    expect(screen.getByTestId('canvas')).toBeInTheDocument();
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('renders with aria-label summary', () => {
    render(
      <ScrollyStage canvas={<div />} ariaLabel="Act 1 summary of 76 billion pills shipped 2006-2014">
        <div>step</div>
      </ScrollyStage>,
    );
    expect(screen.getByRole('region').getAttribute('aria-label')).toContain('76 billion');
  });

  it('renders <details> fallback when dataSummary provided', () => {
    render(
      <ScrollyStage
        canvas={<div />}
        ariaLabel="act"
        dataSummary={<table data-testid="fallback"><tbody><tr><td>x</td></tr></tbody></table>}
      >
        <div>step</div>
      </ScrollyStage>,
    );
    expect(screen.getByTestId('fallback')).toBeInTheDocument();
    expect(screen.getByText(/show data/i)).toBeInTheDocument();
  });
});
