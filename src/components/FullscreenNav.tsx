'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import LogoutButton from './LogoutButton';

type NavUser = { isAdmin: boolean } | null;

export default function FullscreenNav({ user }: { user: NavUser }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const links = user
    ? [
        ...(user.isAdmin ? [{ href: '/admin', label: 'Admin' }] : []),
        { href: '/', label: 'Ana Sayfa' },
        { href: '/players', label: 'Oyuncular' },
        { href: '/kadro-plani', label: 'Kadro Planla' },
        { href: '/at-yarisi', label: 'At Yarışı' },
        { href: '/at-yarisi/magaza', label: 'At Mağazası' },
        { href: '/bets', label: 'Kuponlarım' },
        { href: '/leaderboard', label: 'Liderlik' },
      ]
    : [
        { href: '/', label: 'Ana Sayfa' },
        { href: '/players', label: 'Oyuncular' },
        { href: '/at-yarisi', label: 'At Yarışı' },
        { href: '/login', label: 'Giriş' },
        { href: '/register', label: 'Kayıt Ol' },
      ];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Menüyü aç"
        className="flex h-11 w-11 shrink-0 flex-col items-center justify-center gap-1.5"
      >
        <span className="h-0.5 w-6 bg-text-primary" />
        <span className="h-0.5 w-6 bg-text-primary" />
        <span className="h-0.5 w-6 bg-text-primary" />
      </button>

      {open && (
        <div className="fade-slide-in fixed inset-0 z-40 flex flex-col bg-pitch-night">
          <div className="flex justify-end p-4">
            <button
              onClick={() => setOpen(false)}
              aria-label="Menüyü kapat"
              className="flex h-11 w-11 items-center justify-center text-3xl text-text-primary"
            >
              ✕
            </button>
          </div>
          <nav className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="font-display text-4xl tracking-wide text-text-primary transition-colors hover:text-gold"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          {user && (
            <div className="flex justify-center pb-10">
              <LogoutButton />
            </div>
          )}
        </div>
      )}
    </>
  );
}
