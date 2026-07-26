import type { Metadata, Viewport } from 'next';
import { Bebas_Neue, Inter } from 'next/font/google';
import './globals.css';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import LogoutButton from '@/components/LogoutButton';
import FerrariBetBanner from '@/components/FerrariBetBanner';
import IntroSplash from '@/components/IntroSplash';
import Footer from '@/components/Footer';

const bebasNeue = Bebas_Neue({ subsets: ['latin'], weight: '400', variable: '--font-bebas-neue' });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'FERRARI BET',
  description: 'Arkadaş grubu için eğlence amaçlı STA para birimiyle tahmin oyunu',
};

export const viewport: Viewport = {
  colorScheme: 'dark',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const currentUser = session?.user?.name
    ? await prisma.user.findUnique({ where: { username: session.user.name }, select: { staBalance: true } })
    : null;

  const navLinkClass = 'shrink-0 rounded-full px-3 py-2 font-medium text-text-muted transition-colors active:bg-pitch-night-raised active:text-gold';

  return (
    <html lang="tr" className={`${bebasNeue.variable} ${inter.variable}`}>
      <body className="bg-pitch-night text-text-primary">
        <IntroSplash />
        <header className="sticky top-0 z-20 border-b border-line bg-pitch-night-raised px-4 py-3">
          <div className="mx-auto flex max-w-lg items-center justify-between gap-2">
            <Link href="/" className="shrink-0 font-display text-2xl tracking-wide text-ferrari-red">
              🎰 FERRARI BET
            </Link>
            <nav className="flex flex-nowrap items-center gap-1.5 overflow-x-auto text-sm">
              {session?.user ? (
                <>
                  {currentUser && (
                    <span className="shrink-0 rounded-full bg-gold/10 px-3 py-2 font-display tracking-wide text-gold">
                      {currentUser.staBalance} STA
                    </span>
                  )}
                  {session.user.role === 'admin' && (
                    <Link href="/admin" className={navLinkClass}>Admin</Link>
                  )}
                  <Link href="/players" className={navLinkClass}>Oyuncular</Link>
                  <Link href="/kadro-plani" className={navLinkClass}>Kadro Planla</Link>
                  <Link href="/bets" className={navLinkClass}>Kuponlarım</Link>
                  <Link href="/leaderboard" className={navLinkClass}>Liderlik</Link>
                  <span className="shrink-0">
                    <LogoutButton />
                  </span>
                </>
              ) : (
                <>
                  <Link href="/players" className={navLinkClass}>Oyuncular</Link>
                  <Link href="/login" className={navLinkClass}>Giriş</Link>
                  <Link href="/register" className="shrink-0 rounded-full bg-gold px-3 py-2 font-semibold text-pitch-night active:bg-gold-dim">
                    Kayıt Ol
                  </Link>
                </>
              )}
            </nav>
          </div>
        </header>
        <FerrariBetBanner />
        {children}
        <Footer />
      </body>
    </html>
  );
}
