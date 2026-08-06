import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createResetToken } from '@/lib/password-reset';
import { sendEmail, emailSendingConfigured } from '@/lib/email';

/**
 * Forgot-password entry point (pre-beta item 3).
 *
 * Enumeration-safe: every well-formed request returns the same 200
 * body regardless of whether the account exists, is inside the
 * cooldown, or email delivery fails. All the interesting work happens
 * after the response shape is already fixed.
 */
export async function POST(req: NextRequest) {
  let email = '';
  try {
    const body = await req.json();
    email = String(body?.email ?? '').trim().toLowerCase();
  } catch {
    /* fall through to the uniform response */
  }

  const uniform = NextResponse.json({ ok: true });
  if (!email || !email.includes('@') || email.length > 320) return uniform;

  const user = await prisma.user.findFirst({ where: { email } });
  if (!user || !user.password) return uniform;

  const rawToken = await createResetToken(user.id);
  if (!rawToken) return uniform; // cooldown — no new email

  // Configuration-consistency alarm. The recovery link is shown when
  // NEXT_PUBLIC_PASSWORD_RESET=1, but delivery depends on RESEND_API_KEY —
  // two independent variables with nothing coupling them. If they ever
  // drift apart the user is offered a recovery flow that silently cannot
  // deliver, and a no-op is not an error, so nothing else would report it.
  // Log loudly (Sentry captures console.error) without altering the
  // uniform response shape that enumeration safety depends on.
  if (!emailSendingConfigured()) {
    console.error(
      '[auth/forgot] password-reset requested but RESEND_API_KEY is unset — ' +
        'no email can be delivered. NEXT_PUBLIC_PASSWORD_RESET must not be ' +
        'enabled without email delivery configured.',
    );
  }

  const base = process.env.NEXTAUTH_URL || 'https://audio-xx.com';
  const resetUrl = `${base}/auth/reset?token=${rawToken}`;
  await sendEmail({
    to: email,
    subject: 'Reset your Audio XX password',
    text:
      'A password reset was requested for your Audio XX account.\n\n' +
      `Reset your password (link valid for 30 minutes):\n${resetUrl}\n\n` +
      'If you did not request this, you can ignore this email — your ' +
      'password is unchanged.',
  });

  return uniform;
}
