import Link from 'next/link';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <nav className="mb-6 flex flex-wrap gap-3 text-sm font-medium">
        <Link href="/admin" className="text-green-700">Panel</Link>
        <Link href="/admin/teams" className="text-green-700">Takımlar</Link>
        <Link href="/admin/matches/new" className="text-green-700">Yeni Maç</Link>
        <Link href="/admin/users" className="text-green-700">Kullanıcılar</Link>
      </nav>
      {children}
    </div>
  );
}
