import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Hali Saha İddaa',
  description: 'Arkadaş grubu için eğlence amaçlı STA para birimiyle tahmin oyunu',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  return (
    <html lang="tr">
      <body className="bg-gray-100 text-gray-900">
        <header className="border-b bg-white px-4 py-3">
          <div className="mx-auto flex max-w-lg items-center justify-between">
            <Link href="/" className="font-bold text-green-700">Hali Saha İddaa</Link>
            <nav className="flex gap-3 text-sm">
              {session?.user ? (
                <>
                  {session.user.role === 'admin' && <Link href="/admin">Admin</Link>}
                  <Link href="/leaderboard">Liderlik</Link>
                </>
              ) : (
                <>
                  <Link href="/login">Giriş</Link>
                  <Link href="/register">Kayıt Ol</Link>
                </>
              )}
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
