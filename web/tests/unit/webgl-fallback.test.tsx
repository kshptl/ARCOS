import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WebGLFallback } from '@/components/explorer/WebGLFallback';

describe('WebGLFallback', () => {
  it('shows reason text', () => {
    render(<WebGLFallback counties={[]} reason="WebGL unavailable." />);
    expect(screen.getByRole('alert')).toHaveTextContent('WebGL unavailable.');
  });

  it('renders keyboard-navigable county list with anchors', () => {
    render(
      <WebGLFallback
        counties={[
          { fips: '54059', name: 'Mingo', state: 'WV', pop: 26000 },
          { fips: '54047', name: 'McDowell', state: 'WV', pop: 20000 },
        ]}
        reason="No WebGL."
      />,
    );
    const links = screen.getAllByRole('link');
    expect(links.map((l) => l.getAttribute('href'))).toEqual([
      '/county/54059',
      '/county/54047',
    ]);
  });

  it('has figure wrapper with descriptive aria-label', () => {
    render(<WebGLFallback counties={[]} reason="x" />);
    expect(screen.getByRole('figure').getAttribute('aria-label')).toContain('county list');
  });
});
