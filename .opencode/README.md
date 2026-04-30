# ARCOS OpenCode overrides

Project-local OpenCode customizations that need to be committed so other
workstations / contributors get the same behaviour.

## Layout

- `plugins/skill-overrides.js` — OpenCode plugin that registers
  `./skills` as an additional skill search path. Must be listed in
  `~/.config/opencode/opencode.json` **after** the `superpowers@...`
  plugin so its `config` hook runs later and its skills path is scanned
  last (OpenCode's skill loader applies "last scan wins" on duplicate
  skill names).
- `skills/<skill-name>/` — overrides for individual superpowers skills.
  Files in here replace the cached copy shipped by the superpowers
  npm/git plugin.

## Wiring

Edit `~/.config/opencode/opencode.json` and add this plugin AFTER the
superpowers entry:

```json
"plugin": [
  "./plugins/opencode-notify",
  "superpowers@git+https://github.com/obra/superpowers.git",
  "/home/kush/ARCOS/.opencode/plugins"
]
```

(The path must be the absolute path to `.opencode/plugins` on this
workstation; OpenCode resolves a directory spec via its `package.json`
`main` entry.)

## Current overrides

### `skills/subagent-driven-development/`

Full copy of the superpowers skill, with `implementer-prompt.md` amended
to require the implementer subagent to:

- Run the project's linter, typechecker, and full test suite as part of
  self-review — not just the scoped tests it wrote.
- Report `LINT_CLEAN`, `TYPECHECK_CLEAN`, `TESTS_PASSING` as structured
  fields with the exact command used.
- Refuse to return `STATUS: DONE` unless all three fields are `yes` or
  legitimately `n/a`. If any is `no`, either fix and re-run or return
  `STATUS: BLOCKED` with the failing output.

This exists because a previous subagent declared `STATUS: DONE` with
tests green while biome lint was never invoked, shipping 5 lint errors
to main.

`SKILL.md`, `spec-reviewer-prompt.md`, and `code-quality-reviewer-prompt.md`
are verbatim copies of the cache versions — they must be present so that
the amended `implementer-prompt.md` is reachable from the override
directory (the skill tool reports the SKILL.md's dirname as base
directory; relative refs in the SKILL.md must resolve there).

## User-level config: enabling subagent nesting

Plan-execution sessions dispatch `@build` as a subagent (via the superpowers
`subagent-driven-development` workflow). Those `build` subagents in turn want
to dispatch _their own_ reviewer subagents (two-stage spec-reviewer /
code-quality-reviewer pattern). Without the config below they cannot: the
`task` tool is gated by `permission.task`, and by default `build` running as
a subagent has no task permission. Empirically confirmed across 6+ Plan
sessions — zero child sessions ever spawned under implementer subagents.

Required edit to `~/.config/opencode/opencode.json` (NOT in this repo —
must be replicated per workstation):

```json
"agent": {
  "explore":  { "disable": true  },
  "general":  { "disable": false },
  "build":    { "permission": { "task": "allow" } }
}
```

What each line does:

- `general.disable: false` — re-enables the built-in `general` subagent so
  `build` has a general-purpose target to dispatch to. (Was previously
  `true` in this workstation's config.)
- `build.permission.task: "allow"` — grants the `build` agent the `task`
  tool. Per OpenCode's agent docs, `permission.task` gates access to the
  `task` tool itself. This permission applies to the `build` agent whether
  it is running as the primary agent OR as a subagent, so a nested
  `@build` can now dispatch further subagents.

### Smoke test (run in a future session)

From a fresh OpenCode session on `main` agent `build`:

1. `@build` a trivial task: _"Dispatch a `general` subagent to echo hello
   and return its output."_
2. Watch the session tree. A **child** session should appear under the
   `build` subagent session. That child is the `general` subagent call.
3. If no child session appears and the outer `build` says it cannot call
   `task`, the config did not apply — restart OpenCode (the config is
   read at startup) and retry.

Alternatively, inspect the OpenCode session DB after running a real Plan
execution:

```bash
# path varies per install; adjust as needed
sqlite3 ~/.local/share/opencode/sessions.db \
  "select id, parent_id, agent from sessions order by created_at desc limit 20;"
```

Previously, rows with `agent=build` and non-null `parent_id` had zero
descendant rows. After this change, a Plan execution that uses the
two-stage reviewer pattern should produce `parent_id` chains three deep
(primary → build-implementer → build-reviewer/general).

### Collaborator note

This change lives only in `~/.config/opencode/opencode.json` on this
workstation. It is not committable to the repo. Anyone else running these
Plans must apply the same edit on their machine or the reviewer stages
will silently no-op.

## Updating superpowers

If superpowers is updated upstream and the base skill content changes
substantively, re-copy `SKILL.md` and the reviewer prompts from
`~/.cache/opencode/packages/superpowers@.../node_modules/superpowers/skills/subagent-driven-development/`
and re-apply the amendment to `implementer-prompt.md`.

## Known deviations from the web-core plan

These are intentional differences between the written plan at
`docs/superpowers/plans/2026-04-29-openarcos-web-core.md` and the code as
committed. Keep this list current when you deviate on purpose.

- **`typedRoutes` is a top-level Next config option, not `experimental`.**
  Next 15 promoted `typedRoutes` out of `experimental`. The plan's sample
  config shows `experimental: { typedRoutes: true }` but `web/next.config.mjs`
  correctly uses the top-level `typedRoutes: true`. Do not "fix" this back.
