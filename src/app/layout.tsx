import type { Metadata, Viewport } from 'next';
import { Bebas_Neue, Inter } from 'next/font/google';
import './globals.css';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import FerrariBetBanner from '@/components/FerrariBetBanner';
import IntroSplash from '@/components/IntroSplash';
import Footer from '@/components/Footer';
import FullscreenNav from '@/components/FullscreenNav';

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

  return (
    <html lang="tr" className={`${bebasNeue.variable} ${inter.variable}`}>
      <body className="bg-pitch-night text-text-primary">
        <IntroSplash />
        <header className="sticky top-0 z-20 border-b border-line bg-pitch-night-raised px-4 py-3">
          <div className="mx-auto flex max-w-lg items-center justify-between gap-2">
            <Link href="/" className="shrink-0 font-display text-2xl tracking-wide text-ferrari-red">
              🎰 FERRARI BET
            </Link>
            <div className="flex shrink-0 items-center gap-2">
              {currentUser && (
                <span className="shrink-0 rounded-full bg-gold/10 px-3 py-2 text-sm font-display tracking-wide text-gold">
                  {currentUser.staBalance} STA
                </span>
              )}
              <FullscreenNav user={session?.user ? { isAdmin: session.user.role === 'admin' } : null} />
            </div>
          </div>
        </header>
        <FerrariBetBanner />
        {children}
        <Footer />
      </body>
    </html>
  );
}
