"use client";

import { useEffect, useState } from "react";

export function detectWebGL(canvas?: HTMLCanvasElement): boolean {
  const el: HTMLCanvasElement | null =
    canvas ?? (typeof document !== "undefined" ? document.createElement("canvas") : null);
  if (!el) return false;
  try {
    const gl =
      el.getContext("webgl2") ||
      el.getContext("webgl") ||
      (el.getContext as unknown as (name: string) => unknown)("experimental-webgl");
    return Boolean(gl);
  } catch {
    return false;
  }
}

export function useWebGLSupport(): boolean | null {
  const [supported, setSupported] = useState<boolean | null>(null);
  useEffect(() => {
    setSupported(detectWebGL());
  }, []);
  return supported;
}
