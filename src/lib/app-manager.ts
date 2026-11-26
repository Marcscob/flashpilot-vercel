export const OWNER_EMAIL = "guit1966@gmail.com";

type AppManagerIdentity = {
  email?: unknown;
  app_metadata?: unknown;
};

/** Admin flags must come from trusted Supabase app_metadata, never user_metadata. */
export function isAppManagerIdentity(identity: unknown): boolean {
  if (!identity || typeof identity !== "object") return false;
  const user = identity as AppManagerIdentity;
  const metadata =
    user.app_metadata && typeof user.app_metadata === "object"
      ? (user.app_metadata as Record<string, unknown>)
      : {};

  // Email claims are not trusted (OAuth providers may issue unverified addresses).
  return metadata.is_app_manager === true;
}
