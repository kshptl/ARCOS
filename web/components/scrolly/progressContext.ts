"use client";

import { createContext, useContext } from "react";

export const ScrollyProgressContext = createContext<number>(0);

export function useScrollyProgress(): number {
  return useContext(ScrollyProgressContext);
}
