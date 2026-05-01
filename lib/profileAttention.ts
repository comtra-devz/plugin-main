import type { User } from '../types';

/**
 * Red dot on avatar / “Personal details” while something is still required.
 * When `patGateActive` (no OAuth in UI yet), also require `has_figma_rest_token` for email users.
 */
export function userNeedsProfileAttentionDot(u: User, patGateActive: boolean): boolean {
  if (u.name_conflict && typeof u.name_conflict === 'object') return true;
  if (u.show_profile_badge) return true;
  const hasFigmaOAuth = u.figma_user_id != null && String(u.figma_user_id).trim() !== '';
  if (hasFigmaOAuth) return false;
  if (patGateActive && u.has_figma_rest_token !== true) return true;
  if (u.profile_saved_at) return false;
  return true;
}

/** Tooltip copy for the avatar / Personal details row red dot. */
export function profileAttentionTitle(u: User, patGateActive: boolean): string {
  if (u.name_conflict && typeof u.name_conflict === 'object') {
    return 'Resolve your name in Personal details';
  }
  if (u.show_profile_badge) {
    return 'Complete your profile in Personal details';
  }
  const hasFigmaOAuth = u.figma_user_id != null && String(u.figma_user_id).trim() !== '';
  if (hasFigmaOAuth) {
    return 'Open Personal details';
  }
  if (patGateActive && u.has_figma_rest_token !== true) {
    return 'Add your Figma token in Personal details';
  }
  if (!u.profile_saved_at) {
    return 'Add your name in Personal details';
  }
  return 'Complete Personal details';
}
