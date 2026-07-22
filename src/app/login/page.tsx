'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const result = await signIn('credentials', { username, password, redirect: false });
    if (result?.error) {
      setError('Kullanıcı adı veya şifre hatalı.');
      return;
    }
    router.push('/');
  }

  return (
    <main className="mx-auto max-w-sm px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold">Giriş Yap</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          className="rounded border px-3 py-2"
          placeholder="Kullanıcı adı"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          className="rounded border px-3 py-2"
          type="password"
          placeholder="Şifre"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" className="rounded bg-green-600 px-4 py-2 font-semibold text-white">
          Giriş Yap
        </button>
      </form>
    </main>
  );
}
