'use client';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { supabase } from '../../lib/supabase';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(null); setInfo(null);
    const { data, error } = mode === 'in' ? await supabase.auth.signInWithPassword({ email, password }) : await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (error) return setError(error.message);
    if (mode === 'up' && !data.session) return setInfo('Check your email to confirm your account, then sign in.');
    router.replace('/');
  }
  return (
    <main style={{ maxWidth: 400, margin: '10vh auto' }}>
      <h1>MY LIFE OS</h1>
      <p className="muted">Design your life. Execute your goals. Become better.</p>
      <form className="card" onSubmit={submit}>
        <label>Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
        <label>Password<input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} /></label>
        {error && <p className="err" role="alert">{error}</p>}
        {info && <p className="muted">{info}</p>}
        <button className="primary" disabled={busy}>{busy ? 'Please wait…' : mode === 'in' ? 'Sign in' : 'Create account'}</button>
        <p className="muted" style={{ textAlign: 'center' }}>
          <a href="#" onClick={(e) => { e.preventDefault(); setMode(mode === 'in' ? 'up' : 'in'); }}>{mode === 'in' ? 'New here? Create an account' : 'Have an account? Sign in'}</a>
        </p>
      </form>
    </main>
  );
}
