import type { Metadata, Viewport } from 'next';
import './globals.css';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import LogoutButton from '@/components/LogoutButton';

export const metadata: Metadata = {
  title: 'STASAHA',
  description: 'Arkadaş grubu için eğlence amaçlı STA para birimiyle tahmin oyunu',
};

export const viewport: Viewport = {
  colorScheme: 'light',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const currentUser = session?.user?.name
    ? await prisma.user.findUnique({ where: { username: session.user.name }, select: { staBalance: true } })
    : null;

  return (
    <html lang="tr">
      <body className="bg-gray-100 text-gray-900">
        <header className="sticky top-0 z-20 bg-neutral-900 px-4 py-3">
          <div className="mx-auto flex max-w-lg items-center justify-between gap-2">
            <Link href="/" className="shrink-0 font-bold text-amber-400">⚽ STASAHA</Link>
            <nav className="flex flex-nowrap items-center gap-1.5 overflow-x-auto text-sm">
              {session?.user ? (
                <>
                  {currentUser && (
                    <span className="shrink-0 rounded-full bg-amber-400/10 px-3 py-1.5 font-semibold text-amber-400">
                      {currentUser.staBalance} STA
                    </span>
                  )}
                  {session.user.role === 'admin' && (
                    <Link href="/admin" className="shrink-0 rounded-full px-3 py-1.5 font-medium text-neutral-200 active:bg-neutral-800">
                      Admin
                    </Link>
                  )}
                  <Link href="/bets" className="shrink-0 rounded-full px-3 py-1.5 font-medium text-neutral-200 active:bg-neutral-800">
                    Kuponlarım
                  </Link>
                  <Link href="/leaderboard" className="shrink-0 rounded-full px-3 py-1.5 font-medium text-neutral-200 active:bg-neutral-800">
                    Liderlik
                  </Link>
                  <span className="shrink-0">
                    <LogoutButton />
                  </span>
                </>
              ) : (
                <>
                  <Link href="/login" className="shrink-0 rounded-full px-3 py-1.5 font-medium text-neutral-200 active:bg-neutral-800">
                    Giriş
                  </Link>
                  <Link href="/register" className="shrink-0 rounded-full bg-amber-400 px-3 py-1.5 font-semibold text-neutral-900 active:bg-amber-500">
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
