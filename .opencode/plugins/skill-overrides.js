/**
 * ARCOS skill overrides plugin for OpenCode.
 *
 * Registers `<project>/.opencode/skills` as a skill search path.
 *
 * Why this plugin exists:
 * The superpowers plugin appends its own skills directory to
 * `config.skills.paths` in its own `config` hook. OpenCode's skill loader
 * iterates `skills.paths` in order and later scans overwrite earlier ones
 * on duplicate skill names. That means a user-configured `skills.paths`
 * entry in `opencode.json` cannot beat superpowers — because the
 * superpowers plugin pushes its dir *after* user config is loaded.
 *
 * Plugins themselves, however, run in the order they are listed in
 * `opencode.json`. If this plugin is listed AFTER superpowers, its
 * `config` hook runs after superpowers', and any path it pushes scans
 * AFTER the superpowers dir — so it wins on duplicate skill names.
 *
 * Usage: add this plugin to `/home/kush/.config/opencode/opencode.json`
 * AFTER the `superpowers@...` entry in the `plugin` array:
 *
 *   "plugin": [
 *     "./plugins/opencode-notify",
 *     "superpowers@git+https://github.com/obra/superpowers.git",
 *     "/home/kush/ARCOS/.opencode/plugins/skill-overrides"
 *   ]
 */

import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Resolves to /home/kush/ARCOS/.opencode/skills
const OVERRIDE_SKILLS_DIR = path.resolve(__dirname, "..", "skills");

export const ArcosSkillOverridesPlugin = async () => {
  return {
    config: async (config) => {
      if (!fs.existsSync(OVERRIDE_SKILLS_DIR)) return;
      config.skills = config.skills || {};
      config.skills.paths = config.skills.paths || [];
      if (!config.skills.paths.includes(OVERRIDE_SKILLS_DIR)) {
        config.skills.paths.push(OVERRIDE_SKILLS_DIR);
      }
    },
  };
};
