import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Global mock for next/navigation. Components that render during unit tests
// can freely call `useRouter()` / `usePathname()` without every suite having
// to wire up its own mock. Suites that care about specific router behaviour
// can override with `vi.mock("next/navigation", ...)` locally.
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));
