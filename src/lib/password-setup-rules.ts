export function shouldOfferInitialPassword(userId: string | null, hasPassword: boolean | undefined, pathname: string) {
  return Boolean(userId) && hasPassword === false && pathname !== "/reset-password" && pathname !== "/" && pathname !== "/auth" && pathname !== "/activate";
}
