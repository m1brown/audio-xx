import { getServerSession } from 'next-auth';
import { authOptions } from './auth';

export async function getSession() {
  return getServerSession(authOptions);
}

export async function getUserId(): Promise<string | null> {
  const session = await getSession();
  return (session?.user as { id?: string })?.id ?? null;
}
