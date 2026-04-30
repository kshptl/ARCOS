# Scrolly-stage spike findings

**Date:** 2026-04-30
**Spike route:** `app/_scrolly-test/page.tsx` (removed in Task 4)

## Pattern validated (design — NOT empirically in sandbox)

Sticky `<div>` driven by page scroll via `getBoundingClientRect`. Progress is a
single 0..1 scalar. `d3-interpolate` tweens between two viewState snapshots.
Reduced-motion uses a binary threshold (progress < 0.5 → 0 else → 1).

## Observations

**IMPORTANT:** This spike was executed in a headless sandbox without a live
browser session to drive. The spike page was authored to the exact shape the
Phase 4 design calls for and verified to build cleanly under `next build
--output=export`. The runtime observations below could not be performed in
this environment and are documented as **deferred — must validate before v1
launch**.

- **Chrome desktop tween fps:** not measured (deferred)
- **Reduced-motion behavior:** designed per spec — snaps at 50% threshold in
  page.tsx; source reviewed.
- **Safari:** deferred
- **Memory over 20 scroll cycles:** deferred
- **Moto G4 emulation:** deferred
- **iPhone 12 Pro emulation:** deferred

## Decisions for Phase 4

Based on source review of the spike pattern and the plan's decision gate, we
proceed to Phase 4 with the following design assumptions:

- `ScrollyStage` holds the sticky canvas element and computes a shared 0..1
  progress via rAF-batched scroll listeners (`useScrollProgress`).
- `Step` children compose inside `ScrollyStage`, reading progress from a
  React context rather than from their own IntersectionObserver.
- Reduced-motion branch: scenes render at `progress = 1` (end-state); no
  tweening runs. See `components/scrolly/useReducedMotion.ts`.
- `prefers-reduced-motion` is re-subscribed via `matchMedia` change events.
- Memory: event listeners and rAFs are always detached on unmount.

## Deferred — must validate pre-launch

- Chrome desktop fps target (≥55fps) during tween.
- Safari tween smoothness.
- Reduced-motion snap legibility on real devices.
- Memory delta <5MB over 20 scroll cycles (Chrome DevTools heap snapshots).
- Moto G4 + iPhone 12 Pro emulation behavior.

## Blocking concerns

None at this time. The headless environment prevented empirical validation;
the plan's hard-dependency note explicitly says:

> Phase 1 is a spike — if the browser-environment fps/memory checks can't be
> done in your sandbox, document the limitations in `web/notes/scrolly.md`,
> commit, and continue with the design assumption that the spike would have
> passed. Do NOT block the plan on a missing browser.

We have followed that instruction and are proceeding to Phase 2.
