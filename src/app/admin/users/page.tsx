import { prisma } from '@/lib/prisma';
import { adjustBalance, adminResetPassword } from '@/actions/users';
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
      <div className="mb-6 rounded-xl border border-line bg-pitch-night-raised p-4">
        <h3 className="mb-2 font-semibold text-text-primary">Şifreni Değiştir</h3>
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
            className="rounded-lg border border-line bg-pitch-night px-3 py-2 text-sm text-text-primary"
            required
          />
          <input
            name="newPassword"
            type="password"
            placeholder="Yeni şifre"
            className="rounded-lg border border-line bg-pitch-night px-3 py-2 text-sm text-text-primary"
            required
          />
          <button className="pop-interactive self-start rounded-full border border-line px-4 py-2 text-sm font-semibold text-text-primary">Şifreyi Güncelle</button>
        </form>
        {pwd === 'ok' && <p className="mt-2 text-sm text-green-400">Şifre güncellendi.</p>}
        {pwd === 'error' && <p className="mt-2 text-sm text-ferrari-red">{msg ?? 'Bir hata oluştu.'}</p>}
      </div>

      <h2 className="mb-4 font-display text-lg tracking-wide text-text-primary">Kullanıcılar</h2>
      <ul className="flex flex-col gap-3">
        {users.map((u) => (
          <li key={u.id} className="rounded-xl border border-line bg-pitch-night-raised p-4">
            <div className="mb-2 flex items-center justify-between text-text-primary">
              <span className="font-medium">{u.username}</span>
              <span className="text-gold">{u.staBalance} STA</span>
            </div>
            <form
              action={async (formData) => {
                'use server';
                const delta = parseInt(formData.get('delta') as string, 10);
                await adjustBalance(u.id, delta);
              }}
              className="flex gap-2"
            >
              <input name="delta" type="number" placeholder="+/- STA" className="flex-1 rounded-lg border border-line bg-pitch-night px-2 py-1 text-sm text-text-primary" />
              <button className="pop-interactive rounded-full border border-line px-3 py-1 text-sm font-semibold text-text-primary">Uygula</button>
            </form>
            <form
              action={async (formData) => {
                'use server';
                const newPassword = formData.get('newPassword') as string;
                await adminResetPassword(u.id, newPassword);
              }}
              className="mt-2 flex gap-2"
            >
              <input
                name="newPassword"
                type="text"
                placeholder="Yeni şifre belirle"
                className="flex-1 rounded-lg border border-line bg-pitch-night px-2 py-1 text-sm text-text-primary"
                required
              />
              <button className="pop-interactive rounded-full border border-ferrari-red px-3 py-1 text-sm font-semibold text-ferrari-red">Şifreyi Sıfırla</button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
