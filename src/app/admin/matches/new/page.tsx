import { prisma } from '@/lib/prisma';
import { createMatch } from '@/actions/matches';
import { redirect } from 'next/navigation';

export default async function NewMatchPage() {
  const teams = await prisma.team.findMany({ orderBy: { name: 'asc' } });

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">Yeni Maç Oluştur</h1>
      <form
        action={async (formData) => {
          'use server';
          const homeTeamId = formData.get('homeTeamId') as string;
          const awayTeamId = formData.get('awayTeamId') as string;
          const kickoff = formData.get('kickoffTime') as string;
          const ouLine = parseFloat(formData.get('ouLine') as string);
          const result = await createMatch(homeTeamId, awayTeamId, new Date(kickoff), ouLine);
          if (!('error' in result)) redirect('/admin');
        }}
        className="flex flex-col gap-4"
      >
        <select name="homeTeamId" className="rounded border px-3 py-2" required>
          <option value="">Ev sahibi takım seç</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <select name="awayTeamId" className="rounded border px-3 py-2" required>
          <option value="">Deplasman takım seç</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <input type="datetime-local" name="kickoffTime" className="rounded border px-3 py-2" required />
        <div>
          <label className="mb-1 block text-sm text-gray-600">Toplam Gol Alt/Üst Çizgisi</label>
          <input
            type="number"
            name="ouLine"
            step="0.5"
            min="0.5"
            defaultValue={9.5}
            className="w-full rounded border px-3 py-2"
            required
          />
          <p className="mt-1 text-xs text-gray-400">
            Buçuklu bir sayı kullan (örn. 9.5) — tam sayıda beraberlik ihtimali oluşur.
          </p>
        </div>
        <button className="rounded bg-green-600 px-4 py-2 font-semibold text-white">Maçı Oluştur</button>
      </form>
    </div>
  );
}
