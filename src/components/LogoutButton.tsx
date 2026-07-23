'use client';

import { signOut } from 'next-auth/react';

export default function LogoutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: '/' })}
      className="rounded-full px-3 py-1.5 text-sm font-medium text-neutral-200 active:bg-neutral-800"
    >
      Çıkış
    </button>
  );
}
