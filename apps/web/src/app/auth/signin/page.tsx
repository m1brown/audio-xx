'use client';

import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const res = await signIn('credentials', { email, password, redirect: false });
    if (res?.error) setError('Invalid credentials');
    else router.push('/systems');
  }

  return (
    <div style={{ maxWidth: 360 }}>
      <h1>Sign in</h1>
      <p className="small muted mb-2">New accounts are created automatically.</p>
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error && <p className="danger small mb-1">{error}</p>}
        <button type="submit" className="btn btn-primary">Sign in</button>
      </form>
    </div>
  );
}
