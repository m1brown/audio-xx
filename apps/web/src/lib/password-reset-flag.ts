/**
 * Single source of truth for whether self-service password recovery is
 * available.
 *
 * This exists because hiding the sign-in CTA is not a gate. When the flag
 * was first switched off, `/auth/forgot`, `/auth/reset` and
 * `POST /api/auth/forgot` all remained fully reachable by typing the URL,
 * and the API still minted a reset token and attempted delivery. The only
 * thing that changed was that the link was no longer rendered.
 *
 * The invariant this enforces: **when recovery is disabled, no
 * user-accessible UI or execution path may offer or initiate password
 * recovery** — navigation and direct access alike.
 *
 * `NEXT_PUBLIC_` is read on both the client (inlined at build) and the
 * server, so one helper covers the pages and the route. Absent or any
 * value other than '1' means disabled — fail closed, since the failure
 * mode of guessing "enabled" is a user stranded by a recovery flow that
 * cannot deliver.
 */
export function passwordResetEnabled(): boolean {
  return process.env.NEXT_PUBLIC_PASSWORD_RESET === '1';
}
