/**
 * Site-wide constants. Keep trivially tree-shakeable (plain consts, no side
 * effects) so they can be imported from both server and client modules.
 */

/**
 * URL for filing bug reports. Used by error boundaries and similar surfaces
 * that give users a way to report failures they hit in the UI.
 */
export const GITHUB_ISSUE_NEW_URL = "https://github.com/kshptl/ARCOS/issues/new";
