/**
 * Deployment identity — release-governance gate (2026-09-01).
 *
 * Answers exactly one question, machine-readably: WHAT BUILD IS THIS
 * DEPLOYMENT SERVING? The values are baked by Vercel into the deployment's
 * own environment at build time, so this can never report a repository
 * HEAD, a developer's checkout, or anything other than the artifact that
 * is actually running. Local dev identifies itself as such.
 *
 * The production blocker of 2026-09-01 existed because a green gate proved
 * code correctness while production served a months-stale foreign build.
 * A GREEN LOCAL/PREVIEW GATE IS NOT SUFFICIENT EVIDENCE OF PRODUCTION
 * CORRECTNESS — the smoke battery compares this endpoint against the
 * expected release commit after every deployment.
 *
 * Safe to expose: commit sha, branch, and deployment host reveal no
 * secrets for an open-source-adjacent beta and are already visible in
 * response headers Vercel sets elsewhere.
 */
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? 'local-dev',
    branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
    deployment: process.env.VERCEL_URL ?? null,
    env: process.env.VERCEL_ENV ?? 'development',
  });
}
