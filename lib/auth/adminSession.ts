export const ADMIN_SESSION_START_KEY = 'adminSessionStart';

/**
 * Remet `adminSessionStart` dans l'état d'avant une vérification TOTP qui a échoué.
 * `undefined` : la clé n'a pas été touchée ; `null` : elle n'existait pas.
 */
export function restoreSessionStart(previous: string | null | undefined): void {
  if (previous === undefined) return;
  if (previous === null) {
    localStorage.removeItem(ADMIN_SESSION_START_KEY);
  } else {
    localStorage.setItem(ADMIN_SESSION_START_KEY, previous);
  }
}
