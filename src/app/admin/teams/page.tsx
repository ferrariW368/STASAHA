import { prisma } from '@/lib/prisma';
import { createTeam, updateTeamName, addPlayer, removePlayer } from '@/actions/teams';

export default async function AdminTeamsPage() {
  const teams = await prisma.team.findMany({ include: { players: true }, orderBy: { name: 'asc' } });

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">Takımlar & Kadro</h1>

      <form
        action={async (formData) => {
          'use server';
          await createTeam(formData.get('name') as string);
        }}
        className="mb-6 flex gap-2"
      >
        <input name="name" placeholder="Yeni takım adı" className="flex-1 rounded border px-3 py-2" />
        <button className="rounded bg-green-600 px-4 py-2 text-white">Ekle</button>
      </form>

      <div className="flex flex-col gap-6">
        {teams.map((team) => (
          <div key={team.id} className="rounded border p-4">
            <form
              action={async (formData) => {
                'use server';
                await updateTeamName(team.id, formData.get('teamName') as string);
              }}
              className="mb-2 flex gap-2"
            >
              <input
                name="teamName"
                defaultValue={team.name}
                className="flex-1 rounded border px-2 py-1 font-semibold"
              />
              <button className="rounded bg-gray-700 px-3 py-1 text-sm text-white">Kaydet</button>
            </form>
            <ul className="mb-3 flex flex-col gap-1">
              {team.players.map((p) => (
                <li key={p.id} className="flex items-center justify-between text-sm">
                  <span>{p.name}{p.number ? ` (#${p.number})` : ''}</span>
                  <form
                    action={async () => {
                      'use server';
                      await removePlayer(p.id);
                    }}
                  >
                    <button className="text-red-600">Sil</button>
                  </form>
                </li>
              ))}
            </ul>
            <form
              action={async (formData) => {
                'use server';
                const number = formData.get('number') as string;
                await addPlayer(
                  team.id,
                  formData.get('playerName') as string,
                  number ? parseInt(number, 10) : undefined
                );
              }}
              className="flex gap-2"
            >
              <input name="playerName" placeholder="Oyuncu adı" className="flex-1 rounded border px-2 py-1 text-sm" />
              <input name="number" placeholder="No" className="w-16 rounded border px-2 py-1 text-sm" />
              <button className="rounded bg-gray-700 px-3 py-1 text-sm text-white">Ekle</button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}
