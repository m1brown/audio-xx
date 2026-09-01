import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { verifyResetToken, consumeResetToken } from '@/lib/password-reset';
import { passwordResetEnabled } from '@/lib/password-reset-flag';

/**
 * Complete a password reset (pre-beta item 3).
 *
 * The raw token is verified against its stored hash, must be unexpired
 * and unused, and is consumed atomically with the password change —
 * consuming also invalidates every other outstanding token for the
 * account. Nothing here logs the token or the password.
 */
export async function POST(req: NextRequest) {
  // Recovery disabled: a token must not be redeemable. Gating the pages and
  // the request endpoint is not enough — a link minted before the flag was
  // switched off would otherwise still spend here via a direct POST, which
  // is the completion half of the flow the disabled state is meant to stop.
  if (!passwordResetEnabled()) {
    return NextResponse.json(
      { error: 'Password reset is unavailable. Contact hello@audio-xx.com.' },
      { status: 404 },
    );
  }

  let token = '';
  let password = '';
  try {
    const body = await req.json();
    token = String(body?.token ?? '');
    password = String(body?.password ?? '');
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  if (password.length < 8 || password.length > 200) {
    return NextResponse.json(
      { error: 'Password must be at least 8 characters.' },
      { status: 400 },
    );
  }

  const userId = await verifyResetToken(token);
  if (!userId) {
    return NextResponse.json(
      { error: 'This reset link is invalid or has expired. Request a new one.' },
      { status: 400 },
    );
  }

  const hashed = await bcrypt.hash(password, 10);
  await prisma.user.update({ where: { id: userId }, data: { password: hashed } });
  await consumeResetToken(token);

  return NextResponse.json({ ok: true });
}
