import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { CitationPopover } from '@/components/scrolly/CitationPopover';

describe('CitationPopover', () => {
  it('renders trigger with accessible name "Cite"', () => {
    render(<CitationPopover source="WaPo ARCOS" year={2019} url="https://example.com" />);
    expect(screen.getByRole('button', { name: /cite/i })).toBeInTheDocument();
  });

  it('opens popover on click with source + year + url', async () => {
    const user = userEvent.setup();
    render(<CitationPopover source="DEA Diversion" year={2016} url="https://deadiversion.usdoj.gov" />);
    await user.click(screen.getByRole('button', { name: /cite/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/DEA Diversion/)).toBeInTheDocument();
    expect(screen.getByText(/2016/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /deadiversion\.usdoj\.gov/i })).toHaveAttribute(
      'href',
      'https://deadiversion.usdoj.gov',
    );
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    render(<CitationPopover source="CDC WONDER" year={2020} url="https://wonder.cdc.gov" />);
    await user.click(screen.getByRole('button', { name: /cite/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes on click outside', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <CitationPopover source="Source" year={2020} url="https://example.com" />
        <button type="button">outside</button>
      </div>,
    );
    await user.click(screen.getByRole('button', { name: /cite/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /outside/i }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
