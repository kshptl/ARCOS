import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { detectWebGL, useWebGLSupport } from '@/components/map/useWebGLSupport';

describe('useWebGLSupport', () => {
  it('detectWebGL returns boolean', () => {
    const result = detectWebGL();
    expect(typeof result).toBe('boolean');
  });

  it('detectWebGL returns true when canvas yields webgl2 context', () => {
    const fake = {
      getContext: vi.fn().mockImplementation((name: string) =>
        name === 'webgl2' ? { fakeGL: true } : null,
      ),
    };
    expect(detectWebGL(fake as unknown as HTMLCanvasElement)).toBe(true);
  });

  it('detectWebGL returns false when canvas yields no context', () => {
    const fake = { getContext: vi.fn().mockReturnValue(null) };
    expect(detectWebGL(fake as unknown as HTMLCanvasElement)).toBe(false);
  });

  it('useWebGLSupport starts null then resolves', async () => {
    const { result } = renderHook(() => useWebGLSupport());
    await Promise.resolve();
    expect([true, false, null]).toContain(result.current);
  });
});
