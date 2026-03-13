export { COOKIE_NAME, CUSTOM_AUTH_COOKIE, ONE_YEAR_MS } from "@shared/const";

// For local Supabase email/password auth we just send users to the
// first-party login route within this app instead of an external OAuth portal.
export const getLoginUrl = () => "/login";
