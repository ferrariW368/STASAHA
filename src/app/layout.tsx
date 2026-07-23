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
        <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-lg items-center justify-between">
            <Link href="/" className="font-bold text-green-700">⚽ Hali Saha İddaa</Link>
            <nav className="flex items-center gap-2 text-sm">
              {session?.user ? (
                <>
                  {session.user.role === 'admin' && (
                    <Link href="/admin" className="rounded-full px-3 py-1.5 font-medium text-gray-700 active:bg-gray-100">
                      Admin
                    </Link>
                  )}
                  <Link href="/leaderboard" className="rounded-full px-3 py-1.5 font-medium text-gray-700 active:bg-gray-100">
                    Liderlik
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/login" className="rounded-full px-3 py-1.5 font-medium text-gray-700 active:bg-gray-100">
                    Giriş
                  </Link>
                  <Link href="/register" className="rounded-full bg-green-600 px-3 py-1.5 font-medium text-white active:bg-green-700">
                    Kayıt Ol
                  </Link>
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
