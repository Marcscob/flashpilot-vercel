export const LANDING_REVIEW_OPENED_KEY = "flashpilot:landing-review-opened";

export const HANDOFF_RETRY_DELAYS_MS = [0, 1500, 4000, 9000] as const;

/** A partial delivery must remain eligible for the existing bounded retry. */
export function landingMaterialsAttemptDone(failures: number): boolean {
  return failures === 0;
}

/**
 * Opens /review once after a landing handoff: right after cards are saved, or
 * when an earlier attempt saved them but its response never reached the browser.
 */
export function shouldOpenReview(input: {
  savedCards: number;
  recentlySaved: boolean;
  alreadyOpened: boolean;
  pathname: string;
}): boolean {
  if (input.pathname === "/review" || input.pathname.startsWith("/review/")) return false;
  if (input.savedCards > 0) return true;
  return input.recentlySaved && !input.alreadyOpened;
}
