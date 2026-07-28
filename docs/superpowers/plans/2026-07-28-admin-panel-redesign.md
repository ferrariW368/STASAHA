# Admin Panel Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle every `/admin/*` page to match the site's black/Ferrari-red/gold design system (Bebas Neue headings, `pitch-night-raised` cards, `gold`/`ferrari-red` accents) with zero functional changes.

**Architecture:** Pure CSS-class edits across 9 existing files. No new components, no new server actions, no data model changes. Every `<form action={...}>` server action call keeps its exact same arguments and behavior — only `className` strings change.

**Tech Stack:** Next.js 16 (App Router), Tailwind CSS v4 (tokens already defined in `src/app/globals.css`: `pitch-night`, `pitch-night-raised`, `line`, `gold`, `gold-dim`, `ferrari-red`, `text-primary`, `text-muted`).

## Global Constraints

- Design spec: `docs/superpowers/specs/2026-07-28-admin-panel-redesign-design.md` — read it before starting if you need the rationale.
- Every server action call signature, form field `name` attribute, and conditional-render logic must stay byte-identical — only `className` values change. If a diff shows anything other than a `className` string changing, that's a bug.
- Primary/confirm actions (create, save, approve, settle): `pop-interactive rounded-full bg-gold px-4 py-2 text-sm font-semibold text-pitch-night`.
- Secondary/neutral actions (apply, update, save-a-field): `pop-interactive rounded-full border border-line px-4 py-2 text-sm font-semibold text-text-primary`.
- Destructive actions (delete, reject, cancel, reset password): `pop-interactive rounded-full border border-ferrari-red px-4 py-2 text-sm font-semibold text-ferrari-red`. **Exception:** a single-row "remove this one item from a list" inline action (e.g. removing one player from a team's roster list) stays a plain `text-ferrari-red` text link, no pill/border/padding — the full pill treatment is reserved for page/section-level destructive actions (delete team, cancel match, reject lineup, reset password), matching this project's existing convention of lighter-weight inline list-row actions (see `LineupsList.tsx`'s compact in-card buttons for the same "denser inside a list" precedent).
- All text inputs/selects/textareas: `rounded-lg border border-line bg-pitch-night px-3 py-2 text-sm text-text-primary`. **Exception:** compact in-card rows (e.g. the per-team player-add row, per-transfer update row, per-player edit form) may use denser padding and/or a smaller type scale than this top-level value (e.g. `px-2 py-1`, `px-3 py-1.5`, `text-xs` in place of `text-sm`) — the exact reduced values are each task's own code as written in the plan, not one fixed literal string; whatever a given task's own code block already specifies for its nested-in-card elements is correct as written and should not be reconciled against the top-level values above. This compact variant is intentional wherever a form/button is nested one level inside an already-bordered card.
- All card containers (replacing bare `rounded border p-3/p-4`): `rounded-xl border border-line bg-pitch-night-raised p-4`.
- All `<h1>`: `mb-4 font-display text-3xl tracking-wide text-text-primary` (there is exactly one true `<h1>` in this whole plan — the shared `admin/layout.tsx` title — every subpage heading below it is an `<h2>`, so it's sized up to stay the visually dominant heading on the page). All `<h2>`: `mb-4 font-display text-lg tracking-wide text-text-primary`.
- Run `npx tsc --noEmit` after every task — it must stay clean throughout (pure className edits should never break types, so any failure means something else was accidentally touched).
- Verify: because admin routes are login-gated and Claude cannot enter passwords into any field (including the app's own test admin account), there is no automated Browser-pane click-through for this plan. Each task's "testing" step is a `tsc --noEmit` pass plus a manual code-diff review confirming only classNames changed.

---

### Task 1: Restyle the admin nav shell (`layout.tsx`)

**Files:**
- Modify: `src/app/admin/layout.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new — this is a leaf layout file, no other task depends on its internals.

- [ ] **Step 1: Replace the file contents**

```tsx
import Link from 'next/link';

const NAV_ITEMS = [
  { href: '/admin', label: 'Panel' },
  { href: '/admin/teams', label: 'Takımlar' },
  { href: '/admin/players', label: 'Oyuncular' },
  { href: '/admin/transfers', label: 'Transferler' },
  { href: '/admin/lineups', label: 'Kadro Onayları' },
  { href: '/admin/matches/new', label: 'Yeni Maç' },
  { href: '/admin/users', label: 'Kullanıcılar' },
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
```

Note: this plan does not attempt active-route highlighting (would need `usePathname`, a client-side hook, on what is currently a server component) — out of scope per the design doc, which only asked for a tab-like visual, not active-state logic.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/layout.tsx
git commit -m "style: restyle admin nav shell to match site design tokens"
```

---

### Task 2: Restyle the admin dashboard (`admin/page.tsx`)

**Files:**
- Modify: `src/app/admin/page.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new.

- [ ] **Step 1: Replace the file contents**

```tsx
import { prisma } from '@/lib/prisma';
import Link from 'next/link';

export default async function AdminDashboard() {
  const matches = await prisma.match.findMany({
    include: { homeTeam: true, awayTeam: true },
    orderBy: { kickoffTime: 'desc' },
  });

  return (
    <div>
      <h2 className="mb-4 font-display text-lg tracking-wide text-text-primary">Maçlar</h2>
      <ul className="flex flex-col gap-2">
        {matches.map((m) => (
          <li key={m.id} className="rounded-xl border border-line bg-pitch-night-raised p-4 text-sm">
            <Link href={`/admin/matches/${m.id}`} className="font-semibold text-gold">
              {m.homeTeam.name} vs {m.awayTeam.name}
            </Link>
            <div className="mt-1 text-text-muted">
              {m.kickoffTime.toLocaleString('tr-TR')} — durum: {m.status}
              {m.status === 'finished' ? ` (${m.finalHomeScore}-${m.finalAwayScore})` : ''}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/page.tsx
git commit -m "style: restyle admin dashboard match list"
```

---

### Task 3: Restyle the teams page (`admin/teams/page.tsx`)

**Files:**
- Modify: `src/app/admin/teams/page.tsx`

**Interfaces:**
- Consumes: `createTeam`, `updateTeamName`, `deleteTeam`, `addPlayer`, `removePlayer` from `@/actions/teams` — unchanged signatures.
- Produces: nothing new.

- [ ] **Step 1: Replace the file contents**

```tsx
import { prisma } from '@/lib/prisma';
import { createTeam, updateTeamName, deleteTeam, addPlayer, removePlayer } from '@/actions/teams';
import { redirect } from 'next/navigation';

export default async function AdminTeamsPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string }>;
}) {
  const { err } = await searchParams;
  const teams = await prisma.team.findMany({ include: { players: true }, orderBy: { name: 'asc' } });

  return (
    <div>
      <h2 className="mb-4 font-display text-lg tracking-wide text-text-primary">Takımlar & Kadro</h2>
      {err && <p className="mb-4 rounded-lg bg-ferrari-red/10 p-2 text-sm text-ferrari-red">{err}</p>}

      <form
        action={async (formData) => {
          'use server';
          await createTeam(formData.get('name') as string);
        }}
        className="mb-6 flex gap-2"
      >
        <input name="name" placeholder="Yeni takım adı" className="flex-1 rounded-lg border border-line bg-pitch-night px-3 py-2 text-sm text-text-primary" />
        <button className="pop-interactive rounded-full bg-gold px-4 py-2 text-sm font-semibold text-pitch-night">Ekle</button>
      </form>

      <div className="flex flex-col gap-6">
        {teams.map((team) => (
          <div key={team.id} className="rounded-xl border border-line bg-pitch-night-raised p-4">
            <div className="mb-2 flex gap-2">
              <form
                action={async (formData) => {
                  'use server';
                  await updateTeamName(team.id, formData.get('teamName') as string);
                }}
                className="flex flex-1 gap-2"
              >
                <input
                  name="teamName"
                  defaultValue={team.name}
                  className="flex-1 rounded-lg border border-line bg-pitch-night px-2 py-1 text-sm font-semibold text-text-primary"
                />
                <button className="pop-interactive rounded-full border border-line px-3 py-1 text-sm font-semibold text-text-primary">Kaydet</button>
              </form>
              <form
                action={async () => {
                  'use server';
                  const result: { error?: string } = await deleteTeam(team.id);
                  if (result.error) {
                    redirect(`/admin/teams?err=${encodeURIComponent(result.error)}`);
                  }
                }}
              >
                <button className="pop-interactive rounded-full border border-ferrari-red px-3 py-1 text-sm font-semibold text-ferrari-red">Takımı Sil</button>
              </form>
            </div>
            <ul className="mb-3 flex flex-col gap-1">
              {team.players.map((p) => (
                <li key={p.id} className="flex items-center justify-between text-sm text-text-primary">
                  <span>{p.name}{p.number ? ` (#${p.number})` : ''}</span>
                  <form
                    action={async () => {
                      'use server';
                      await removePlayer(p.id);
                    }}
                  >
                    <button className="text-ferrari-red">Sil</button>
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
              <input name="playerName" placeholder="Oyuncu adı" className="flex-1 rounded-lg border border-line bg-pitch-night px-2 py-1 text-sm text-text-primary" />
              <input name="number" placeholder="No" className="w-16 rounded-lg border border-line bg-pitch-night px-2 py-1 text-sm text-text-primary" />
              <button className="pop-interactive rounded-full border border-line px-3 py-1 text-sm font-semibold text-text-primary">Ekle</button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/teams/page.tsx
git commit -m "style: restyle admin teams page"
```

---

### Task 4: Restyle the player pool page (`admin/players/page.tsx`)

**Files:**
- Modify: `src/app/admin/players/page.tsx`

**Interfaces:**
- Consumes: `updatePlayerProfile`, `transferPlayer` from `@/actions/players`, `addPlayer` from `@/actions/teams` — unchanged signatures.
- Produces: nothing new.

- [ ] **Step 1: Replace the file contents**

```tsx
import { prisma } from '@/lib/prisma';
import { updatePlayerProfile, transferPlayer } from '@/actions/players';
import { addPlayer } from '@/actions/teams';

export default async function AdminPlayersPage() {
  const [players, teams] = await Promise.all([
    prisma.player.findMany({ include: { team: true }, orderBy: { name: 'asc' } }),
    prisma.team.findMany({ orderBy: { name: 'asc' } }),
  ]);

  return (
    <div>
      <h2 className="mb-1 font-display text-lg tracking-wide text-text-primary">Oyuncu Havuzu</h2>
      <p className="mb-4 text-xs text-text-muted">
        Profil bilgileri (özellikler, piyasa değeri, oyun stili esini) tamamen senin girdiğin, gerçek bir
        futbolcunun verisi kopyalanmadan sadece esin olarak kullanılan değerlerdir.
      </p>

      <form
        action={async (formData) => {
          'use server';
          const teamId = (formData.get('teamId') as string) || null;
          const number = formData.get('number') as string;
          await addPlayer(teamId, formData.get('name') as string, number ? parseInt(number, 10) : undefined);
        }}
        className="mb-6 flex flex-wrap gap-2"
      >
        <input name="name" placeholder="Yeni oyuncu adı" className="flex-1 rounded-lg border border-line bg-pitch-night px-3 py-2 text-sm text-text-primary" required />
        <input name="number" placeholder="No" className="w-16 rounded-lg border border-line bg-pitch-night px-3 py-2 text-sm text-text-primary" />
        <select name="teamId" className="rounded-lg border border-line bg-pitch-night px-3 py-2 text-sm text-text-primary">
          <option value="">Serbest Oyuncu</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <button className="pop-interactive rounded-full bg-gold px-4 py-2 text-sm font-semibold text-pitch-night">Ekle</button>
      </form>

      <div className="flex flex-col gap-4">
        {players.map((p) => (
          <div key={p.id} className="rounded-xl border border-line bg-pitch-night-raised p-4">
            <form
              action={async (formData) => {
                'use server';
                const parseNum = (key: string) => {
                  const raw = formData.get(key) as string;
                  return raw ? parseInt(raw, 10) : null;
                };
                await updatePlayerProfile(p.id, {
                  styleInspiration: (formData.get('styleInspiration') as string) ?? '',
                  position: (formData.get('position') as string) || null,
                  pace: parseNum('pace'),
                  shooting: parseNum('shooting'),
                  passing: parseNum('passing'),
                  dribbling: parseNum('dribbling'),
                  defending: parseNum('defending'),
                  physical: parseNum('physical'),
                  marketValue: parseNum('marketValue'),
                });
                const newTeamId = (formData.get('teamId') as string) || null;
                if (newTeamId !== (p.teamId ?? '')) {
                  await transferPlayer(p.id, newTeamId);
                }
              }}
              className="flex flex-col gap-2"
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="font-semibold text-text-primary">
                  {p.name} {p.number ? `#${p.number}` : ''}
                </span>
                <select name="teamId" defaultValue={p.teamId ?? ''} className="rounded-lg border border-line bg-pitch-night px-2 py-1 text-xs text-text-primary">
                  <option value="">Serbest Oyuncu</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2">
                <input
                  name="styleInspiration"
                  placeholder="Oyun stili esini (örn. Lionel Messi)"
                  defaultValue={p.styleInspiration ?? ''}
                  className="flex-1 rounded-lg border border-line bg-pitch-night px-2 py-1 text-sm text-text-primary"
                />
                <select name="position" defaultValue={p.position ?? ''} className="rounded-lg border border-line bg-pitch-night px-2 py-1 text-sm text-text-primary">
                  <option value="">Mevki seç</option>
                  <option value="GK">Kaleci</option>
                  <option value="DEF">Defans</option>
                  <option value="MID">Orta Saha</option>
                  <option value="FWD">Forvet</option>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs">
                {(['pace', 'shooting', 'passing', 'dribbling', 'defending', 'physical'] as const).map((key) => (
                  <label key={key} className="flex flex-col gap-0.5 text-text-muted">
                    {key === 'pace' && 'Hız'}
                    {key === 'shooting' && 'Şut'}
                    {key === 'passing' && 'Pas'}
                    {key === 'dribbling' && 'Dripling'}
                    {key === 'defending' && 'Defans'}
                    {key === 'physical' && 'Fizik'}
                    <input
                      name={key}
                      type="number"
                      min={1}
                      max={99}
                      defaultValue={p[key] ?? ''}
                      className="rounded-lg border border-line bg-pitch-night px-2 py-1 text-text-primary"
                    />
                  </label>
                ))}
              </div>

              <label className="flex flex-col gap-0.5 text-xs text-text-muted">
                Piyasa Değeri (STA)
                <input
                  name="marketValue"
                  type="number"
                  min={0}
                  defaultValue={p.marketValue ?? ''}
                  className="w-32 rounded-lg border border-line bg-pitch-night px-2 py-1 text-text-primary"
                />
              </label>

              <button className="pop-interactive mt-1 self-start rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-text-primary">
                Kaydet
              </button>
            </form>
          </div>
        ))}
        {players.length === 0 && <p className="text-sm text-text-muted">Henüz oyuncu yok.</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/players/page.tsx
git commit -m "style: restyle admin player pool page"
```

---

### Task 5: Restyle the transfers page (`admin/transfers/page.tsx`)

**Files:**
- Modify: `src/app/admin/transfers/page.tsx`

**Interfaces:**
- Consumes: `createTransferNews`, `updateTransferStage`, `deleteTransferNews` from `@/actions/transfers` — unchanged signatures.
- Produces: nothing new.

- [ ] **Step 1: Replace the file contents**

```tsx
import { prisma } from '@/lib/prisma';
import { createTransferNews, updateTransferStage, deleteTransferNews } from '@/actions/transfers';

const stageOptions = [
  { value: 'RUMOR', label: 'Söylenti' },
  { value: 'ADVANCED', label: 'Büyük Oranda Bitti' },
  { value: 'FAILED', label: 'Gerçekleşmedi' },
  { value: 'SIGNED', label: 'İmza Atıldı' },
  { value: 'CANCELLED', label: 'İptal Edildi / Transfer Yattı' },
];

export default async function AdminTransfersPage() {
  const [players, teams, news] = await Promise.all([
    prisma.player.findMany({ orderBy: { name: 'asc' } }),
    prisma.team.findMany({ orderBy: { name: 'asc' } }),
    prisma.transferNews.findMany({
      include: { player: true, fromTeam: true, toTeam: true },
      orderBy: { updatedAt: 'desc' },
    }),
  ]);

  return (
    <div>
      <h2 className="mb-4 font-display text-lg tracking-wide text-text-primary">Transfer Haberleri</h2>

      <form
        action={async (formData) => {
          'use server';
          const playerId = formData.get('playerId') as string;
          const toTeamId = (formData.get('toTeamId') as string) || null;
          const stage = formData.get('stage') as string;
          const note = (formData.get('note') as string) ?? '';
          await createTransferNews(playerId, toTeamId, stage, note);
        }}
        className="mb-6 flex flex-col gap-2 rounded-xl border border-line bg-pitch-night-raised p-4"
      >
        <h3 className="font-semibold text-text-primary">Yeni Haber</h3>
        <select name="playerId" className="rounded-lg border border-line bg-pitch-night px-3 py-2 text-sm text-text-primary" required>
          <option value="">Oyuncu seç</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select name="toTeamId" className="rounded-lg border border-line bg-pitch-night px-3 py-2 text-sm text-text-primary">
          <option value="">Hedef: Serbest</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <select name="stage" className="rounded-lg border border-line bg-pitch-night px-3 py-2 text-sm text-text-primary" required>
          {stageOptions.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <textarea name="note" placeholder="Not (opsiyonel)" className="rounded-lg border border-line bg-pitch-night px-3 py-2 text-sm text-text-primary" />
        <button className="pop-interactive self-start rounded-full bg-gold px-4 py-2 text-sm font-semibold text-pitch-night">
          Haberi Yayınla
        </button>
      </form>

      <div className="flex flex-col gap-3">
        {news.map((n) => (
          <div key={n.id} className="rounded-xl border border-line bg-pitch-night-raised p-4 text-sm">
            <div className="mb-1 font-semibold text-text-primary">
              {n.player.name}: {n.fromTeam?.name ?? 'Serbest'} → {n.toTeam?.name ?? 'Serbest'}
            </div>
            {n.note && <p className="mb-2 text-xs text-text-muted">{n.note}</p>}
            <form
              action={async (formData) => {
                'use server';
                const stage = formData.get('stage') as string;
                const note = (formData.get('note') as string) ?? '';
                await updateTransferStage(n.id, stage, note);
              }}
              className="flex flex-wrap items-center gap-2"
            >
              <select name="stage" defaultValue={n.stage} className="rounded-lg border border-line bg-pitch-night px-2 py-1 text-xs text-text-primary">
                {stageOptions.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <input name="note" placeholder="Güncel not" defaultValue={n.note ?? ''} className="flex-1 rounded-lg border border-line bg-pitch-night px-2 py-1 text-xs text-text-primary" />
              <button className="pop-interactive rounded-full border border-line px-3 py-1 text-xs font-semibold text-text-primary">Güncelle</button>
            </form>
            <form
              action={async () => {
                'use server';
                await deleteTransferNews(n.id);
              }}
              className="mt-2"
            >
              <button className="pop-interactive rounded-full border border-ferrari-red px-3 py-1 text-xs font-semibold text-ferrari-red">
                Sil (hiç gözükmesin)
              </button>
            </form>
          </div>
        ))}
        {news.length === 0 && <p className="text-sm text-text-muted">Henüz transfer haberi yok.</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/transfers/page.tsx
git commit -m "style: restyle admin transfers page"
```

---

### Task 6: Restyle the lineup approvals page (`admin/lineups/page.tsx` + `LineupsList.tsx`)

**Files:**
- Modify: `src/app/admin/lineups/page.tsx`
- Modify: `src/app/admin/lineups/LineupsList.tsx`

**Interfaces:**
- Consumes: `approveLineup`, `rejectLineup` from `@/actions/lineups`, `getFormation`/`Position` from `@/lib/formation` — unchanged.
- Produces: `LineupsList` keeps the exact same `LineupData`/`SlotData` prop shape — no other task depends on it.

- [ ] **Step 1: Replace `page.tsx`'s h1 line**

In `src/app/admin/lineups/page.tsx`, change:
```tsx
      <h1 className="mb-4 text-xl font-bold">Kadro Onayları</h1>
```
to:
```tsx
      <h2 className="mb-4 font-display text-lg tracking-wide text-text-primary">Kadro Onayları</h2>
```

- [ ] **Step 2: Replace `LineupsList.tsx` contents**

```tsx
'use client';

import { useState } from 'react';
import { approveLineup, rejectLineup } from '@/actions/lineups';
import type { Position } from '@/lib/formation';

const positionLabel: Record<Position, string> = { GK: 'Kaleci', DEF: 'Defans', MID: 'Orta Saha', FWD: 'Forvet' };

const statusLabel: Record<string, { text: string; className: string }> = {
  pending: { text: 'Onay Bekliyor', className: 'bg-gold/10 text-gold' },
  approved: { text: 'Onaylandı', className: 'bg-green-500/10 text-green-400' },
  rejected: { text: 'Reddedildi', className: 'bg-ferrari-red/10 text-ferrari-red' },
};

type SlotData = { position: Position; slotOrder: number; playerName: string; styleInspiration: string | null };
type LineupData = {
  id: string;
  squadName: string;
  format: number;
  status: string;
  submittedByUsername: string;
  rows: { position: Position; slots: SlotData[] }[];
};

export default function LineupsList({ lineups }: { lineups: LineupData[] }) {
  const [showInspiration, setShowInspiration] = useState(false);

  return (
    <div>
      <button
        onClick={() => setShowInspiration((v) => !v)}
        className={`pop-interactive mb-4 rounded-full border px-3 py-1.5 text-xs font-bold ${showInspiration ? 'border-gold bg-gold/10 text-gold' : 'border-line text-text-muted'}`}
      >
        {showInspiration ? '⭐ İlham Alınan Futbolcular Gösteriliyor' : 'İlham Alınan Futbolcuları Göster'}
      </button>

      <div className="flex flex-col gap-4">
        {lineups.map((lineup) => {
          const status = statusLabel[lineup.status] ?? statusLabel.pending;
          return (
            <div key={lineup.id} className="rounded-xl border border-line bg-pitch-night-raised p-4">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-text-primary">{lineup.squadName}</span>
                  <span className="ml-2 text-xs text-text-muted">
                    {lineup.format}v{lineup.format} · {lineup.submittedByUsername}
                  </span>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${status.className}`}>
                  {status.text}
                </span>
              </div>

              <div className="mb-3 flex flex-col gap-1">
                {lineup.rows.map((row) => (
                  <div key={row.position} className="flex items-center gap-2 text-xs">
                    <span className="w-16 shrink-0 font-semibold text-text-muted">{positionLabel[row.position]}</span>
                    <span className="text-text-primary">
                      {row.slots
                        .map((s) => (showInspiration && s.styleInspiration ? s.styleInspiration : s.playerName))
                        .join(', ')}
                    </span>
                  </div>
                ))}
              </div>

              {lineup.status === 'pending' && (
                <div className="flex gap-2">
                  <form action={async () => { await approveLineup(lineup.id); }}>
                    <button className="pop-interactive rounded-full bg-gold px-3 py-1.5 text-xs font-semibold text-pitch-night">
                      Onayla (takımı oluştur)
                    </button>
                  </form>
                  <form action={async () => { await rejectLineup(lineup.id); }}>
                    <button className="pop-interactive rounded-full border border-ferrari-red px-3 py-1.5 text-xs font-semibold text-ferrari-red">
                      Reddet
                    </button>
                  </form>
                </div>
              )}
            </div>
          );
        })}
        {lineups.length === 0 && <p className="text-sm text-text-muted">Henüz kadro önerisi yok.</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/lineups/page.tsx src/app/admin/lineups/LineupsList.tsx
git commit -m "style: restyle admin lineup approvals page"
```

---

### Task 7: Restyle the new-match form (`admin/matches/new/page.tsx`)

**Files:**
- Modify: `src/app/admin/matches/new/page.tsx`

**Interfaces:**
- Consumes: `createMatch` from `@/actions/matches` — unchanged signature.
- Produces: nothing new.

- [ ] **Step 1: Replace the file contents**

```tsx
import { prisma } from '@/lib/prisma';
import { createMatch } from '@/actions/matches';
import { redirect } from 'next/navigation';

export default async function NewMatchPage() {
  const teams = await prisma.team.findMany({ orderBy: { name: 'asc' } });

  return (
    <div>
      <h2 className="mb-4 font-display text-lg tracking-wide text-text-primary">Yeni Maç Oluştur</h2>
      <form
        action={async (formData) => {
          'use server';
          const homeTeamId = formData.get('homeTeamId') as string;
          const awayTeamId = formData.get('awayTeamId') as string;
          const kickoff = formData.get('kickoffTime') as string;
          const ouLine = parseFloat(formData.get('ouLine') as string);
          const htOuLine = parseFloat(formData.get('htOuLine') as string);
          const result = await createMatch(homeTeamId, awayTeamId, new Date(kickoff), ouLine, htOuLine);
          if (!('error' in result)) redirect('/admin');
        }}
        className="flex flex-col gap-4"
      >
        <select name="homeTeamId" className="rounded-lg border border-line bg-pitch-night px-3 py-2 text-text-primary" required>
          <option value="">Ev sahibi takım seç</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <select name="awayTeamId" className="rounded-lg border border-line bg-pitch-night px-3 py-2 text-text-primary" required>
          <option value="">Deplasman takım seç</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <input type="datetime-local" name="kickoffTime" className="rounded-lg border border-line bg-pitch-night px-3 py-2 text-text-primary" required />
        <div>
          <label className="mb-1 block text-sm text-text-muted">Toplam Gol Alt/Üst Çizgisi</label>
          <input
            type="number"
            name="ouLine"
            step="0.5"
            min="0.5"
            defaultValue={9.5}
            className="w-full rounded-lg border border-line bg-pitch-night px-3 py-2 text-text-primary"
            required
          />
          <p className="mt-1 text-xs text-text-muted">
            Buçuklu bir sayı kullan (örn. 9.5) — tam sayıda beraberlik ihtimali oluşur.
          </p>
        </div>
        <div>
          <label className="mb-1 block text-sm text-text-muted">İlk Yarı Toplam Gol Alt/Üst Çizgisi</label>
          <input
            type="number"
            name="htOuLine"
            step="0.5"
            min="0.5"
            defaultValue={4.5}
            className="w-full rounded-lg border border-line bg-pitch-night px-3 py-2 text-text-primary"
            required
          />
        </div>
        <button className="pop-interactive rounded-full bg-gold px-4 py-2 font-semibold text-pitch-night">Maçı Oluştur</button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/matches/new/page.tsx
git commit -m "style: restyle admin new-match form"
```

---

### Task 8: Restyle the match settlement page (`admin/matches/[id]/page.tsx`)

**Files:**
- Modify: `src/app/admin/matches/[id]/page.tsx`

**Interfaces:**
- Consumes: `settleMatch` from `@/actions/settlement`, `cancelMatch` from `@/actions/matches`, `updateOdds` from `@/actions/odds`, `isMatchLocked` from `@/lib/matchLock` — unchanged signatures.
- Produces: nothing new.

- [ ] **Step 1: Replace the file contents**

```tsx
import { prisma } from '@/lib/prisma';
import { settleMatch } from '@/actions/settlement';
import { cancelMatch } from '@/actions/matches';
import { updateOdds } from '@/actions/odds';
import { isMatchLocked } from '@/lib/matchLock';
import { redirect } from 'next/navigation';

const marketLabel: Record<string, string> = {
  '1X2': 'Maç Sonucu',
  SCORE: 'Skor',
  OU_GOALS: 'Toplam Gol',
  HT_OU_GOALS: 'İlk Yarı Toplam Gol',
  BTS: 'KG Var/Yok',
  NOVELTY: 'Eğlenceli Bahisler',
  PLAYER_GOALS: 'Oyuncu Golü',
  FIGHT: 'Kavga',
  LATE: 'Geç Kalma',
};

export default async function AdminMatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const match = await prisma.match.findUnique({
    where: { id },
    include: {
      homeTeam: { include: { players: true } },
      awayTeam: { include: { players: true } },
      odds: true,
    },
  });
  if (!match) return <p className="text-text-muted">Maç bulunamadı.</p>;

  const allPlayers = [...match.homeTeam.players, ...match.awayTeam.players];
  const playerNameById = new Map(allPlayers.map((p) => [p.id, p.name]));
  const locked = isMatchLocked(match.kickoffTime);

  function describeOddsSelection(market: string, selectionKey: string) {
    if (market === 'PLAYER_GOALS' || market === 'FIGHT' || market === 'LATE') {
      const [playerId, rest] = selectionKey.split(':');
      return `${playerNameById.get(playerId) ?? playerId} · ${rest}`;
    }
    return selectionKey;
  }

  const oddsByMarket = new Map<string, typeof match.odds>();
  for (const o of match.odds) {
    oddsByMarket.set(o.market, [...(oddsByMarket.get(o.market) ?? []), o]);
  }

  return (
    <div>
      <h2 className="mb-4 font-display text-lg tracking-wide text-text-primary">{match.homeTeam.name} vs {match.awayTeam.name}</h2>
      <p className="mb-4 text-sm text-text-muted">Durum: {match.status}</p>

      {match.status === 'finished' && (
        <div className="mb-6 rounded-xl border border-line bg-pitch-night-raised p-4 text-sm text-text-primary">
          <p>Sonuç: {match.finalHomeScore} - {match.finalAwayScore}</p>
          <p>İlk yarı: {match.htHomeScore} - {match.htAwayScore}</p>
          <p>Kırmızı kart: {match.redCard ? 'Evet' : 'Hayır'}</p>
          <p>Sahaya giriş: {match.pitchInvasion ? 'Evet' : 'Hayır'}</p>
          <p>Hakem tartışması: {match.refereeArgument ? 'Evet' : 'Hayır'}</p>
          <p>Maç yarıda kaldı: {match.matchAbandoned ? 'Evet' : 'Hayır'}</p>
        </div>
      )}

      {match.status === 'cancelled' && (
        <p className="text-sm text-text-muted">Bu maç iptal edildi, bekleyen kuponlar iade edildi.</p>
      )}

      {match.status !== 'finished' && match.status !== 'cancelled' && (
        <>
          <form
            action={async (formData) => {
              'use server';
              const homeScore = parseInt(formData.get('homeScore') as string, 10);
              const awayScore = parseInt(formData.get('awayScore') as string, 10);
              const htHomeScore = parseInt(formData.get('htHomeScore') as string, 10);
              const htAwayScore = parseInt(formData.get('htAwayScore') as string, 10);
              const playerGoals = allPlayers.map((p) => ({
                playerId: p.id,
                goalCount: parseInt((formData.get(`goals_${p.id}`) as string) || '0', 10),
              }));
              const redCard = formData.get('redCard') === 'on';
              const pitchInvasion = formData.get('pitchInvasion') === 'on';
              const refereeArgument = formData.get('refereeArgument') === 'on';
              const matchAbandoned = formData.get('matchAbandoned') === 'on';
              const fightPlayerIds = allPlayers
                .filter((p) => formData.get(`fight_${p.id}`) === 'on')
                .map((p) => p.id);
              const latePlayerIds = allPlayers
                .filter((p) => formData.get(`late_${p.id}`) === 'on')
                .map((p) => p.id);
              const yellowCardPlayerIds = allPlayers
                .filter((p) => formData.get(`yellow_${p.id}`) === 'on')
                .map((p) => p.id);
              const result = await settleMatch(
                match.id,
                homeScore,
                awayScore,
                htHomeScore,
                htAwayScore,
                playerGoals,
                redCard,
                pitchInvasion,
                refereeArgument,
                matchAbandoned,
                fightPlayerIds,
                latePlayerIds,
                yellowCardPlayerIds
              );
              if (!('error' in result)) redirect('/admin');
            }}
            className="mb-6 flex flex-col gap-4"
          >
            <div className="flex gap-2">
              <input name="homeScore" type="number" min={0} placeholder="Ev sahibi skor" className="w-1/2 rounded-lg border border-line bg-pitch-night px-3 py-2 text-text-primary" required />
              <input name="awayScore" type="number" min={0} placeholder="Deplasman skor" className="w-1/2 rounded-lg border border-line bg-pitch-night px-3 py-2 text-text-primary" required />
            </div>
            <div className="flex gap-2">
              <input name="htHomeScore" type="number" min={0} placeholder="İlk yarı ev sahibi skor" className="w-1/2 rounded-lg border border-line bg-pitch-night px-3 py-2 text-text-primary" required />
              <input name="htAwayScore" type="number" min={0} placeholder="İlk yarı deplasman skor" className="w-1/2 rounded-lg border border-line bg-pitch-night px-3 py-2 text-text-primary" required />
            </div>

            <div className="rounded-xl border border-line bg-pitch-night-raised p-4">
              <h3 className="mb-2 font-semibold text-text-primary">Oyuncu Golleri</h3>
              {allPlayers.map((p) => (
                <div key={p.id} className="mb-1 flex items-center justify-between text-sm text-text-primary">
                  <span>{p.name}</span>
                  <input name={`goals_${p.id}`} type="number" min={0} defaultValue={0} className="w-16 rounded-lg border border-line bg-pitch-night px-2 py-1 text-text-primary" />
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-line bg-pitch-night-raised p-4">
              <h3 className="mb-2 font-semibold text-text-primary">Eğlenceli Olaylar</h3>
              <label className="mb-2 flex items-center gap-2 text-sm text-text-primary">
                <input type="checkbox" name="redCard" /> Kırmızı kart çıktı mı?
              </label>
              <label className="mb-2 flex items-center gap-2 text-sm text-text-primary">
                <input type="checkbox" name="pitchInvasion" /> Sahaya izinsiz biri girdi mi?
              </label>
              <label className="mb-2 flex items-center gap-2 text-sm text-text-primary">
                <input type="checkbox" name="refereeArgument" /> Hakem tartışması çıktı mı?
              </label>
              <label className="mb-2 flex items-center gap-2 text-sm text-text-primary">
                <input type="checkbox" name="matchAbandoned" /> Maç yarıda mı kaldı?
              </label>
              <p className="mb-1 mt-3 text-xs font-semibold text-text-muted">Kavgaya karışanlar</p>
              {allPlayers.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm text-text-primary">
                  <input type="checkbox" name={`fight_${p.id}`} /> {p.name}
                </label>
              ))}
              <p className="mb-1 mt-3 text-xs font-semibold text-text-muted">Sahaya geç kalanlar</p>
              {allPlayers.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm text-text-primary">
                  <input type="checkbox" name={`late_${p.id}`} /> {p.name}
                </label>
              ))}
              <p className="mb-1 mt-3 text-xs font-semibold text-text-muted">🟨 Sarı kart görenler</p>
              {allPlayers.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm text-text-primary">
                  <input type="checkbox" name={`yellow_${p.id}`} /> {p.name}
                </label>
              ))}
            </div>

            <button className="pop-interactive rounded-full bg-ferrari-red px-4 py-2 font-semibold text-text-primary">
              Sonuçlandır (geri alınamaz)
            </button>
          </form>

          {locked ? (
            <p className="mb-6 rounded-xl border border-line bg-pitch-night-raised p-4 text-sm text-text-muted">
              Maç saati geçti, oranlar kilitlendi — sadece sonuçlandırma yapılabilir.
            </p>
          ) : (
            <div className="mb-6 rounded-xl border border-line bg-pitch-night-raised p-4">
              <h3 className="mb-2 font-semibold text-text-primary">Oranları Düzenle</h3>
              <form
                action={async (formData) => {
                  'use server';
                  const updates = match.odds
                    .map((o) => {
                      const raw = formData.get(`odds_${o.id}`) as string;
                      const value = parseFloat(raw);
                      return { oddsId: o.id, oddsValue: value };
                    })
                    .filter((u) => Number.isFinite(u.oddsValue));
                  await updateOdds(match.id, updates);
                }}
                className="flex flex-col gap-3"
              >
                {[...oddsByMarket.entries()].map(([market, rows]) => (
                  <div key={market}>
                    <p className="mb-1 text-xs font-semibold text-text-muted">{marketLabel[market] ?? market}</p>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                      {rows.map((o) => (
                        <div key={o.id} className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs text-text-muted">
                            {describeOddsSelection(o.market, o.selectionKey)}
                          </span>
                          <input
                            name={`odds_${o.id}`}
                            type="number"
                            step="0.01"
                            min="1.01"
                            defaultValue={o.oddsValue}
                            className="w-20 rounded-lg border border-line bg-pitch-night px-2 py-1 text-xs text-text-primary"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <button className="pop-interactive rounded-full border border-line px-4 py-2 text-sm font-semibold text-text-primary">
                  Oranları Kaydet
                </button>
              </form>
            </div>
          )}

          <form
            action={async () => {
              'use server';
              const result = await cancelMatch(match.id);
              if (!('error' in result)) redirect('/admin');
            }}
          >
            <button className="pop-interactive w-full rounded-full border border-ferrari-red px-4 py-2 text-sm font-semibold text-ferrari-red">
              Maçı İptal Et (oynanmadı, bekleyen kuponları iade eder)
            </button>
          </form>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/admin/matches/[id]/page.tsx"
git commit -m "style: restyle admin match settlement page"
```

---

### Task 9: Restyle the users page (`admin/users/page.tsx`)

**Files:**
- Modify: `src/app/admin/users/page.tsx`

**Interfaces:**
- Consumes: `adjustBalance`, `adminResetPassword` from `@/actions/users`, `changePassword` from `@/actions/auth` — unchanged signatures.
- Produces: nothing new.

- [ ] **Step 1: Replace the file contents**

```tsx
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
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/users/page.tsx
git commit -m "style: restyle admin users page"
```

---

## Plan Self-Review Notes

- **Spec coverage:** every bullet in the design doc (nav tab bar, card wrapping, font-display headings, form-element tokens, primary/secondary/destructive button distinction) is implemented in Tasks 1-9, one per existing admin file.
- **Placeholder scan:** none — every task ships complete, pasteable file contents.
- **Type consistency:** no new types introduced; every task is a drop-in replacement of an existing file with identical exported signatures, so nothing for other tasks to consume/produce beyond "the file still compiles."
