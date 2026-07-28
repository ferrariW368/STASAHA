import Link from 'next/link';

const NAV_ITEMS = [
  { href: '/admin', label: 'Panel' },
  { href: '/admin/teams', label: 'Takımlar' },
  { href: '/admin/players', label: 'Oyuncular' },
  { href: '/admin/transfers', label: 'Transferler' },
  { href: '/admin/lineups', label: 'Kadro Onayları' },
  { href: '/admin/matches/new', label: 'Yeni Maç' },
  { href: '/admin/users', label: 'Kullanıcılar' },
  { href: '/admin/horses', label: 'Atlar' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-4 font-display text-3xl tracking-wide text-text-primary">Admin Panel</h1>
      <nav className="mb-6 flex flex-wrap gap-2">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="pop-interactive rounded-full border border-line px-3 py-1.5 text-sm font-semibold text-text-muted"
          >
            {item.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
