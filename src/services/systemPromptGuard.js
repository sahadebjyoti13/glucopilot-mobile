/**
 * Guards the app lifecycle while a system permission dialog is active.
 *
 * Android may report a permission dialog as an AppState transition. The
 * authentication layer must not interpret that transient transition as the
 * user leaving and reopening GlucoPilot.
 */
let activePrompts = 0;
let lastPromptEndedAt = 0;

const RESUME_GRACE_MS = 1500;

export function beginSystemPrompt() {
  activePrompts += 1;
}

export function endSystemPrompt() {
  activePrompts = Math.max(0, activePrompts - 1);
  lastPromptEndedAt = Date.now();
}

export function isSystemPromptActive() {
  return activePrompts > 0 || (Date.now() - lastPromptEndedAt) < RESUME_GRACE_MS;
}
