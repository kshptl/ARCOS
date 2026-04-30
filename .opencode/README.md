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

## Updating superpowers

If superpowers is updated upstream and the base skill content changes
substantively, re-copy `SKILL.md` and the reviewer prompts from
`~/.cache/opencode/packages/superpowers@.../node_modules/superpowers/skills/subagent-driven-development/`
and re-apply the amendment to `implementer-prompt.md`.
