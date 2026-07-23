import { prisma } from '@/lib/prisma';
import { adjustBalance } from '@/actions/users';
import { changePassword } from '@/actions/auth';
import { redirect } from 'next/navigation';

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ pwd?: string; msg?: string }>;
}) {
  const { pwd, msg } = await searchParams;
  const users = await prisma.user.findMany({ where: { role: 'user' }, orderBy: { username: 'asc' } });

  return (
    <div>
      <div className="mb-6 rounded border p-4">
        <h2 className="mb-2 font-semibold">Şifreni Değiştir</h2>
        <form
          action={async (formData) => {
            'use server';
            const result = await changePassword(
              formData.get('currentPassword') as string,
              formData.get('newPassword') as string
            );
            if (result.error) {
              redirect(`/admin/users?pwd=error&msg=${encodeURIComponent(result.error)}`);
            }
            redirect('/admin/users?pwd=ok');
          }}
          className="flex flex-col gap-2"
        >
          <input
            name="currentPassword"
            type="password"
            placeholder="Mevcut şifre"
            className="rounded border px-3 py-2 text-sm"
            required
          />
          <input
            name="newPassword"
            type="password"
            placeholder="Yeni şifre"
            className="rounded border px-3 py-2 text-sm"
            required
          />
          <button className="rounded bg-gray-700 px-4 py-2 text-sm text-white">Şifreyi Güncelle</button>
        </form>
        {pwd === 'ok' && <p className="mt-2 text-sm text-green-600">Şifre güncellendi.</p>}
        {pwd === 'error' && <p className="mt-2 text-sm text-red-600">{msg ?? 'Bir hata oluştu.'}</p>}
      </div>

      <h1 className="mb-4 text-xl font-bold">Kullanıcılar</h1>
      <ul className="flex flex-col gap-3">
        {users.map((u) => (
          <li key={u.id} className="rounded border p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-medium">{u.username}</span>
              <span>{u.staBalance} STA</span>
            </div>
            <form
              action={async (formData) => {
                'use server';
                const delta = parseInt(formData.get('delta') as string, 10);
                await adjustBalance(u.id, delta);
              }}
              className="flex gap-2"
            >
              <input name="delta" type="number" placeholder="+/- STA" className="flex-1 rounded border px-2 py-1 text-sm" />
              <button className="rounded bg-gray-700 px-3 py-1 text-sm text-white">Uygula</button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
