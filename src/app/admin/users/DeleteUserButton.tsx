'use client';

import { useState } from 'react';
import { deleteUser } from '@/actions/users';

export default function DeleteUserButton({ userId, username }: { userId: string; username: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!window.confirm(`${username} kullanıcısını kalıcı olarak silmek istediğine emin misin?`)) return;
    setPending(true);
    setError(null);
    const result = await deleteUser(userId);
    setPending(false);
    if (result.error) setError(result.error);
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleDelete}
        disabled={pending}
        className="pop-interactive rounded-full border border-ferrari-red px-3 py-1 text-xs font-semibold text-ferrari-red disabled:opacity-40"
      >
        {pending ? 'Siliniyor...' : 'Hesabı Sil'}
      </button>
      {error && <p className="text-xs text-ferrari-red">{error}</p>}
    </div>
  );
}
