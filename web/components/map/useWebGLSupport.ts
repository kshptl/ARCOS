"use client";

import { useEffect, useState } from "react";

type WebGLProbeContext = {
  getExtension?: (name: "WEBGL_lose_context") => { loseContext?: () => void } | null;
};

function releaseProbeContext(gl: unknown): void {
  const ext = (gl as WebGLProbeContext | null)?.getExtension?.("WEBGL_lose_context");
  ext?.loseContext?.();
}

export function detectWebGL(canvas?: HTMLCanvasElement): boolean {
  const el: HTMLCanvasElement | null =
    canvas ?? (typeof document !== "undefined" ? document.createElement("canvas") : null);
  if (!el) return false;
  let gl: unknown = null;
  try {
    gl =
      el.getContext("webgl2") ||
      el.getContext("webgl") ||
      (el.getContext as unknown as (name: string) => unknown)("experimental-webgl");
    return Boolean(gl);
  } catch {
    return false;
  } finally {
    if (gl) releaseProbeContext(gl);
  }
}

export function useWebGLSupport(): boolean | null {
  const [supported, setSupported] = useState<boolean | null>(null);
  useEffect(() => {
    setSupported(detectWebGL());
  }, []);
  return supported;
}
