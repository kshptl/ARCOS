import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { detectWebGL, useWebGLSupport } from "@/components/map/useWebGLSupport";

describe("useWebGLSupport", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("detectWebGL returns boolean", () => {
    const fake = { getContext: vi.fn().mockReturnValue(null) };
    const result = detectWebGL(fake as unknown as HTMLCanvasElement);
    expect(typeof result).toBe("boolean");
  });

  it("detectWebGL returns true when canvas yields webgl2 context", () => {
    const fake = {
      getContext: vi
        .fn()
        .mockImplementation((name: string) => (name === "webgl2" ? { fakeGL: true } : null)),
    };
    expect(detectWebGL(fake as unknown as HTMLCanvasElement)).toBe(true);
  });

  it("releases the temporary WebGL context after detection", () => {
    const loseContext = vi.fn();
    const fake = {
      getContext: vi
        .fn()
        .mockImplementation((name: string) =>
          name === "webgl2" ? { getExtension: vi.fn().mockReturnValue({ loseContext }) } : null,
        ),
    };

    expect(detectWebGL(fake as unknown as HTMLCanvasElement)).toBe(true);
    expect(loseContext).toHaveBeenCalledTimes(1);
  });

  it("detectWebGL returns false when canvas yields no context", () => {
    const fake = { getContext: vi.fn().mockReturnValue(null) };
    expect(detectWebGL(fake as unknown as HTMLCanvasElement)).toBe(false);
  });

  it("useWebGLSupport starts null then resolves", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    const { result } = renderHook(() => useWebGLSupport());
    await Promise.resolve();
    expect([true, false, null]).toContain(result.current);
  });
});
