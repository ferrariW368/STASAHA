import { prisma } from '@/lib/prisma';
import { adjustBalance } from '@/actions/users';

export default async function AdminUsersPage() {
  const users = await prisma.user.findMany({ where: { role: 'user' }, orderBy: { username: 'asc' } });

  return (
    <div>
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
