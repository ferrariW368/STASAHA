# At Yarışı Canlılık Paketi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing horse racing mini-game feel more alive: win/lose result overlays with confetti, a live "how many coupons on this horse" signal, phase countdown info boxes on both the race page and the homepage board, a longer/smoother race duration, and a personal stats widget on the homepage (with an onboarding card for users who've never played).

**Architecture:** No new realtime channel, no new Prisma models/migration — every new field is derived at read time inside the existing lazy-tick engine (`src/lib/horseRace{,Engine}.ts`) and served through the existing polled `/api/horse-race/current` endpoint. `getCurrentRace` gains an optional `userId` parameter so the same endpoint can also return the caller's own bet on the current race (`myBet`), resolved from the session the same way `placeHorseBet` already does. The client pages detect a `pending` → `won`/`lost` transition across polls and render a new `RaceResultOverlay` component (confetti reused from the existing `matches/[id]` pattern). A new pure helper `simulatedBetCount` in `src/lib/horseRace.ts` fills in a small deterministic "coupon count" for lightly-bet horses so the board never looks empty, and steps aside once real betting volume takes over.

**Tech Stack:** Next.js 16 (App Router), Prisma 6.19.3 + Neon Postgres, NextAuth (existing `authOptions`), `canvas-confetti` (already installed), Tailwind v4 tokens, Vitest.

## Global Constraints

- Design spec: `docs/superpowers/specs/2026-07-30-horse-race-liveliness-design.md` — read it for full rationale before starting.
- Per `AGENTS.md`/`CLAUDE.md`: this is a modified Next.js with possible breaking changes vs. training data. Before writing code against an unfamiliar Next.js API, check `node_modules/next/dist/docs/`. (Route Handlers, the only Next.js API this plan touches beyond already-established patterns, were verified in `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` — the existing `route.ts` pattern in this codebase already matches; no adaptation needed.)
- **No new Prisma migration.** `betCount` and `myBet` are computed at query time from existing tables (`HorseBet`, `HorseRaceEntry`).
- Betting window stays `BETTING_DURATION_MS = 7_000`. Race duration changes from 10-20s to **15-30s**: `MIN_RACE_DURATION_MS = 15_000`, `MAX_RACE_DURATION_MS = 30_000`. `FINISHED_PAUSE_MS = 5_000` unchanged.
- `betCount` simulation: real `HorseBet` count for `raceId+horseId` is always shown. A simulated boost (0-4, seeded via `mulberry32(seed + horseIndex + 5000)`, inversely proportional to `oddsValue` — favorites get more simulated coupons) is added **only when the real count is below 5**; at 5+ real bets the boost is exactly 0. The boost is a pure function of `(seed, horseIndex, oddsValue)`, so it naturally "freezes" once computed — no separate FINISHED-phase handling needed, it was already deterministic for the whole race's lifetime.
- All new UI text is in Turkish, matching the rest of the site.
- All new Tailwind classes use existing design tokens (`pitch-night`, `pitch-night-raised`, `line`, `gold`, `gold-dim`, `ferrari-red`, `grass`, `text-primary`, `text-muted`, `font-display`) — no raw `neutral-*`/`gray-*` classes.
- New pure-logic functions (no Prisma import) get full Vitest coverage, matching `tests/horseRace.test.ts`. Prisma-dependent modules (`horseRaceEngine.ts`, the API route) are **not** unit-tested with a mocked DB — verify those manually via the dev server, consistent with the rest of this codebase.
- Run `npx tsc --noEmit` and `npx vitest run` after every task — both must stay clean throughout.
- Any DB-mutating code path already exists (`placeHorseBet`) and is untouched by this plan — this package only adds read-side derived data and client-side presentation, so no new `$transaction` is required anywhere in this plan.
- `prefers-reduced-motion` must gate every new animation (confetti burst, `overlay-pop-in` keyframe) exactly like the existing `matches/[id]` page and `globals.css`'s shared reduced-motion block do.

---

### Task 1: `simulatedBetCount` pure helper + tests (`src/lib/horseRace.ts`)

**Files:**
- Modify: `src/lib/horseRace.ts`
- Modify: `tests/horseRace.test.ts`

**Interfaces:**
- Produces: `export function simulatedBetCount(realCount: number, oddsValue: number, rng: () => number): number` — consumed by Task 2 (`horseRaceEngine.ts`'s `toView`).
  - `rng` is expected to be a single `mulberry32(...)`-seeded generator call site provides; the function calls it exactly once.
  - Returns `0` immediately if `realCount >= 5`.
  - Otherwise returns an integer in `[0, 4]`, biased toward higher values for lower `oddsValue` (favorites).

- [ ] **Step 1: Write the failing tests**

Append to `tests/horseRace.test.ts` (add the import name to the existing import line, then add a new `describe` block at the end of the file):

```ts
import { describe, it, expect } from 'vitest';
import { compositeScore, winProbabilities, oddsFromProbabilities, mulberry32, drawFinishOrder, simulatedBetCount } from '../src/lib/horseRace';
```

```ts
describe('simulatedBetCount', () => {
  it('returns 0 once real betting volume reaches the threshold', () => {
    const rng = mulberry32(1);
    expect(simulatedBetCount(5, 2.0, rng)).toBe(0);
    expect(simulatedBetCount(9, 2.0, rng)).toBe(0);
  });

  it('returns an integer in [0, 4] below the threshold', () => {
    const rng = mulberry32(2);
    for (let i = 0; i < 50; i++) {
      const n = simulatedBetCount(0, 3.0, rng);
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(4);
    }
  });

  it('favors lower odds (favorites) with a higher expected boost than longshots', () => {
    const trials = 300;
    let favoriteSum = 0;
    let longshotSum = 0;
    const favoriteRng = mulberry32(10);
    const longshotRng = mulberry32(10);
    for (let i = 0; i < trials; i++) {
      favoriteSum += simulatedBetCount(0, 1.3, favoriteRng);
      longshotSum += simulatedBetCount(0, 15, longshotRng);
    }
    expect(favoriteSum / trials).toBeGreaterThan(longshotSum / trials);
  });

  it('is deterministic for a fixed rng sequence', () => {
    const seqA: number[] = [];
    const rngA = mulberry32(42);
    for (let i = 0; i < 5; i++) seqA.push(simulatedBetCount(0, 2.5, rngA));

    const seqB: number[] = [];
    const rngB = mulberry32(42);
    for (let i = 0; i < 5; i++) seqB.push(simulatedBetCount(0, 2.5, rngB));

    expect(seqA).toEqual(seqB);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/horseRace.test.ts`
Expected: FAIL — `simulatedBetCount is not exported` / `is not a function`.

- [ ] **Step 3: Implement `simulatedBetCount` in `src/lib/horseRace.ts`**

Add near the bottom of `src/lib/horseRace.ts`, after `drawFinishOrder`:

```ts
// Below this many *real* HorseBet rows for a horse in a race, the board adds
// a small deterministic "simulated" boost so a freshly-started race doesn't
// look dead before real players have placed bets. At/above this threshold,
// real traffic has taken over and the boost silently disappears (returns 0).
const SIMULATED_BET_COUNT_THRESHOLD = 5;
const SIMULATED_BET_COUNT_MAX_BOOST = 4;

export function simulatedBetCount(realCount: number, oddsValue: number, rng: () => number): number {
  if (realCount >= SIMULATED_BET_COUNT_THRESHOLD) return 0;
  // oddsValue is clamped to [MIN_ODDS, MAX_ODDS] = [1.3, 15] upstream by
  // oddsFromProbabilities. Map it to a [0, 1] "favorite-ness" — 1 at the
  // shortest odds (biggest favorite), 0 at the longest (biggest longshot) —
  // then bias the roll toward the max boost for favorites.
  const favoriteness = 1 - (oddsValue - MIN_ODDS) / (MAX_ODDS - MIN_ODDS);
  const biased = Math.pow(rng(), 1 - favoriteness * 0.7); // lower exponent skews rolls upward
  return Math.round(biased * SIMULATED_BET_COUNT_MAX_BOOST);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/horseRace.test.ts`
Expected: PASS, all tests including the new `simulatedBetCount` block.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/horseRace.ts tests/horseRace.test.ts
git commit -m "feat: add simulatedBetCount pure helper for horse race coupon counts"
```

---

### Task 2: Race duration constants + `betCount`/`myBet` in the engine (`src/lib/horseRaceEngine.ts`)

**Files:**
- Modify: `src/lib/horseRaceEngine.ts`

**Interfaces:**
- Consumes: `simulatedBetCount` from `@/lib/horseRace` (Task 1); `prisma.horseBet.groupBy` (existing Prisma Client API, no schema change).
- Produces:
  - `RaceEntryView` gains `betCount: number`.
  - `CurrentRaceView` (the non-error branch) gains `myBet: { horseId: string; horseName: string; stake: number; potentialWin: number; status: 'pending' | 'won' | 'lost' } | null`.
  - `getCurrentRace(userId?: string): Promise<CurrentRaceView>` — new optional parameter, backward compatible (existing no-arg callers keep working, `myBet` is `null` for them).
  - These are consumed by: Task 3 (`/api/horse-race/current/route.ts`), Task 5 (`/at-yarisi/page.tsx`), Task 8 (`HorseRaceBoard.tsx`).

- [ ] **Step 1: Update the duration constants**

In `src/lib/horseRaceEngine.ts`, replace:

```ts
const MIN_RACE_DURATION_MS = 10_000;
const MAX_RACE_DURATION_MS = 20_000;
```

with:

```ts
const MIN_RACE_DURATION_MS = 15_000;
const MAX_RACE_DURATION_MS = 30_000;
```

Also update the comment directly above (currently says "Race duration: 10-20 seconds..."):

```ts
// Race duration: 15-30 seconds, with variance so it doesn't feel mechanically
// identical every round. Short enough to keep the loop fast, long enough that
// the live tick animation in RaceTrack still reads as an actual race rather
// than an instant cut to the result.
```

- [ ] **Step 2: Add the `betCount` field to `RaceEntryView` and import `simulatedBetCount`**

Update the import line at the top of the file:

```ts
import { winProbabilities, oddsFromProbabilities, mulberry32, drawFinishOrder, simulatedBetCount } from './horseRace';
```

Add `betCount` to the `RaceEntryView` type:

```ts
export type RaceEntryView = {
  horseId: string;
  horseName: string;
  number: number | null;
  color: string;
  speedRating: number;
  formRating: number;
  luckRating: number;
  oddsValue: number;
  finishPosition: number | null;
  ownerCount: number;
  topOwners: string[];
  // Real HorseBet count for this horse in this race, plus a small simulated
  // boost while real volume is low (see simulatedBetCount in horseRace.ts).
  betCount: number;
};
```

- [ ] **Step 3: Add `myBet` to `CurrentRaceView`**

```ts
export type CurrentRaceView =
  | {
      id: string;
      phase: 'BETTING' | 'RACING' | 'FINISHED';
      createdAt: string;
      bettingEndsAt: string;
      raceEndsAt: string;
      seed: number;
      entries: RaceEntryView[];
      myBet: {
        horseId: string;
        horseName: string;
        stake: number;
        potentialWin: number;
        status: 'pending' | 'won' | 'lost';
      } | null;
    }
  | { error: 'NOT_ENOUGH_HORSES' };
```

- [ ] **Step 4: Fetch real bet counts and thread them (plus `myBet`) through `toView`**

`toView` currently takes only `race: RaceWithEntries`. It needs the real per-horse bet counts and the caller's own bet, both fetched by the caller (`getCurrentRace`/`startNewRace`/the phase-transition branches) since they require a `raceId` that's only known once the race is loaded, and — for `myBet` — a `userId` that isn't part of `RaceWithEntries` at all.

Replace the whole `toView` function with:

```ts
function toView(
  race: RaceWithEntries,
  realBetCounts: Map<string, number>,
  myBet: CurrentRaceView extends { myBet: infer M } ? M : never
): CurrentRaceView {
  return {
    id: race.id,
    phase: race.phase as 'BETTING' | 'RACING' | 'FINISHED',
    createdAt: race.createdAt.toISOString(),
    bettingEndsAt: race.bettingEndsAt.toISOString(),
    raceEndsAt: race.raceEndsAt.toISOString(),
    seed: race.seed,
    entries: race.entries.map((e, index) => {
      const ownerships = [...e.horse.ownerships].sort((a, b) => b.staInvested - a.staInvested);
      const realCount = realBetCounts.get(e.horseId) ?? 0;
      const rng = mulberry32(race.seed + index + 5000);
      return {
        horseId: e.horseId,
        horseName: e.horse.name,
        number: e.horse.number,
        color: e.horse.color,
        speedRating: e.horse.speedRating,
        formRating: e.horse.formRating,
        luckRating: e.horse.luckRating,
        oddsValue: e.oddsValue,
        finishPosition: e.finishPosition,
        ownerCount: ownerships.length,
        topOwners: ownerships.slice(0, 3).map((o) => o.user.username),
        betCount: realCount + simulatedBetCount(realCount, e.oddsValue, rng),
      };
    }),
    myBet,
  };
}
```

Note: the `CurrentRaceView extends ... : never` conditional type is just a terse way to reference the exact shape of the non-error branch's `myBet` field without redeclaring it — TypeScript resolves it structurally. If this reads awkwardly to whoever implements it, an equally correct alternative is to extract that object shape into its own named type (e.g. `type MyBetView = {...} | null`) and reference `MyBetView` in both `CurrentRaceView` and here; either is acceptable, keep whichever the codebase's style favors once written.

- [ ] **Step 5: Add a helper to load real bet counts for a race**

Add this new function above `toView` (it's reused by every call site that produces a view):

```ts
async function loadRealBetCounts(raceId: string): Promise<Map<string, number>> {
  const groups = await prisma.horseBet.groupBy({
    by: ['horseId'],
    where: { raceId },
    _count: { _all: true },
  });
  return new Map(groups.map((g) => [g.horseId, g._count._all]));
}

async function loadMyBet(
  raceId: string,
  userId: string | undefined
): Promise<CurrentRaceView extends { myBet: infer M } ? M : never> {
  if (!userId) return null;
  const bet = await prisma.horseBet.findUnique({
    where: { userId_raceId: { userId, raceId } },
    include: { horse: { select: { name: true } } },
  });
  if (!bet) return null;
  return {
    horseId: bet.horseId,
    horseName: bet.horse.name,
    stake: bet.stake,
    potentialWin: bet.potentialWin,
    status: bet.status as 'pending' | 'won' | 'lost',
  };
}
```

`userId_raceId` is the compound unique key Prisma generates from the existing `@@unique([userId, raceId])` on `HorseBet` (see `prisma/schema.prisma`) — no schema change needed, this key already exists.

- [ ] **Step 6: Update `startNewRace` to build and pass the new arguments**

`startNewRace` currently ends with `return toView(race);`. A brand-new race has no bets yet, so:

```ts
async function startNewRace(): Promise<CurrentRaceView> {
  // ...unchanged body up through the `prisma.horseRace.create(...)` call...

  return toView(race, new Map(), null);
}
```

(Keep everything above `return toView(race)` exactly as-is — only the final line and its arguments change. `startNewRace` does not take a `userId`, so its `myBet` is always `null`; a race that was *just* created cannot yet have any bets on it either.)

- [ ] **Step 7: Update `getCurrentRace` to accept `userId` and pass real data through every branch**

Replace the whole function:

```ts
export async function getCurrentRace(userId?: string): Promise<CurrentRaceView> {
  const now = new Date();
  let race = await prisma.horseRace.findFirst({ orderBy: { createdAt: 'desc' }, include: raceInclude });

  if (!race || (race.phase === 'FINISHED' && now.getTime() > race.raceEndsAt.getTime() + FINISHED_PAUSE_MS)) {
    return startNewRace();
  }

  if (race.phase === 'BETTING' && now.getTime() > race.bettingEndsAt.getTime()) {
    await prisma.horseRace.updateMany({ where: { id: race.id, phase: 'BETTING' }, data: { phase: 'RACING' } });
    race = await prisma.horseRace.findUniqueOrThrow({ where: { id: race.id }, include: raceInclude });
  }

  if (race.phase === 'RACING' && now.getTime() > race.raceEndsAt.getTime()) {
    await settleRace(race.id);
    race = await prisma.horseRace.findUniqueOrThrow({ where: { id: race.id }, include: raceInclude });
  }

  const [realBetCounts, myBet] = await Promise.all([loadRealBetCounts(race.id), loadMyBet(race.id, userId)]);
  return toView(race, realBetCounts, myBet);
}
```

- [ ] **Step 8: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. Pay attention to the `toView`/`loadMyBet` conditional-type expressions above — if TypeScript complains about `CurrentRaceView extends { myBet: infer M } ? M : never` (e.g. because it distributes over the union oddly), fall back to the named-type alternative mentioned in Step 4: declare

```ts
type MyBetView = {
  horseId: string;
  horseName: string;
  stake: number;
  potentialWin: number;
  status: 'pending' | 'won' | 'lost';
} | null;
```

above `CurrentRaceView`, use `myBet: MyBetView` in the `CurrentRaceView` non-error branch, and use `MyBetView` as the return/parameter type everywhere `toView`/`loadMyBet` reference it above. Re-run `npx tsc --noEmit` after switching.

- [ ] **Step 9: Run full test suite**

Run: `npx vitest run`
Expected: PASS (this task adds no new tests of its own — `horseRaceEngine.ts` is Prisma-dependent and, per this codebase's convention, verified manually in Step 10 below — but the full suite must stay green).

- [ ] **Step 10: Manual verification**

Run `npm run dev` in the background, then in another terminal:

```bash
curl http://localhost:3000/api/horse-race/current
```

Expected: JSON response where every entry object now has a `betCount` number, and the top-level object has a `myBet` key (`null` since this route isn't session-aware yet — that's Task 3). Stop the dev server after checking.

- [ ] **Step 11: Commit**

```bash
git add src/lib/horseRaceEngine.ts
git commit -m "feat: derive betCount and myBet in getCurrentRace, widen race duration to 15-30s"
```

---

### Task 3: Session-aware `/api/horse-race/current` route

**Files:**
- Modify: `src/app/api/horse-race/current/route.ts`

**Interfaces:**
- Consumes: `getServerSession`/`authOptions` from `next-auth`/`@/lib/auth` (same pattern as `src/actions/horseRace.ts`'s `placeHorseBet`), `prisma` from `@/lib/prisma`, `getCurrentRace` from `@/lib/horseRaceEngine` (Task 2).
- Produces: `GET /api/horse-race/current` now returns `myBet` populated for the logged-in user's own bet on the current race — consumed by Task 5 (`/at-yarisi/page.tsx`) and Task 8 (`HorseRaceBoard.tsx`), neither of which need any request-shape change (still a plain `GET`, no query params).

- [ ] **Step 1: Implement session lookup and pass `userId` through**

Replace the whole file:

```ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getCurrentRace } from '@/lib/horseRaceEngine';

export async function GET() {
  const session = await getServerSession(authOptions);
  const user = session?.user?.name
    ? await prisma.user.findUnique({ where: { username: session.user.name }, select: { id: true } })
    : null;

  const race = await getCurrentRace(user?.id);
  return NextResponse.json(race);
}
```

This mirrors the exact session-to-`userId` resolution `placeHorseBet` already uses in `src/actions/horseRace.ts` (`session.user.name` → `prisma.user.findUnique({ where: { username } })`), since the session/JWT only carries `name`/`role`, never the Prisma `User.id` directly (confirmed in `src/lib/auth.ts`).

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual verification**

With `npm run dev` running: log in as a user who has an active bet on the current race (place one via `/at-yarisi` if needed), then `curl http://localhost:3000/api/horse-race/current -H "Cookie: <your session cookie>"` (or just check via the browser Network tab) — `myBet` should be populated with that bet's `horseId`/`horseName`/`stake`/`potentialWin`/`status`. Logged-out requests should still show `myBet: null`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/horse-race/current/route.ts
git commit -m "feat: make /api/horse-race/current session-aware for myBet"
```

---

### Task 4: `overlay-pop-in` keyframe + reduced-motion entry (`globals.css`)

**Files:**
- Modify: `src/app/globals.css`

**Interfaces:**
- Produces: `.overlay-pop-in` CSS class — consumed by Task 6 (`RaceResultOverlay.tsx`).

- [ ] **Step 1: Add the keyframe and class**

Add this block to `src/app/globals.css`, after the existing `.marquee-track` block (right before the `@media (prefers-reduced-motion: reduce)` block):

```css
@keyframes overlay-pop-in {
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1); }
}
.overlay-pop-in {
  animation: overlay-pop-in 280ms cubic-bezier(0.4, 0, 0.2, 1) both;
}
```

- [ ] **Step 2: Add it to the reduced-motion block**

In the existing `@media (prefers-reduced-motion: reduce)` block, add `.overlay-pop-in` to the first animation-disabling selector list:

```css
@media (prefers-reduced-motion: reduce) {
  .race-car-loader,
  .jackpot-pulse,
  .fade-slide-in,
  .live-pulse,
  .marquee-track,
  .flap-animate,
  .overlay-pop-in {
    animation: none !important;
  }
  .pop-interactive,
  .match-card-glow {
    transition: none !important;
  }
  .pop-interactive:hover,
  .pop-interactive:active,
  .match-card-glow:hover,
  .match-card-glow:active {
    transform: none !important;
  }
}
```

- [ ] **Step 3: Type-check and test suite (no-op sanity check)**

Run: `npx tsc --noEmit && npx vitest run`
Expected: both clean — this is a CSS-only change, included for consistency with the plan's "every task ends green" rule.

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: add overlay-pop-in keyframe for race result overlay"
```

---

### Task 5: `RaceResultOverlay` component

**Files:**
- Create: `src/components/RaceResultOverlay.tsx`

**Interfaces:**
- Consumes: `.overlay-pop-in` CSS class (Task 4), `canvas-confetti` (already installed, per `package.json`), the `myBet` shape from `CurrentRaceView` (Task 2) — imported as a type via `CurrentRaceView['myBet']` extended with the extra fields the overlay needs (see Step 1).
- Produces: `<RaceResultOverlay result={RaceOverlayResult} onDismiss={() => void} />` — consumed by Task 6 (`/at-yarisi/page.tsx`) and Task 9 (`HorseRaceBoard.tsx`, if the design calls for it there too — per the spec, the win/lose overlay is `/at-yarisi`-only; `HorseRaceBoard`'s homepage widget only shows the info box and bet-count subtext, not the overlay. This task's export is written generically enough that it's only actually *used* by Task 6).

- [ ] **Step 1: Implement the component**

```tsx
'use client';

import { useEffect } from 'react';
import confetti from 'canvas-confetti';

export type RaceOverlayResult = {
  status: 'won' | 'lost';
  horseName: string;
  stake: number;
  potentialWin: number;
  winningHorseName: string;
};

export default function RaceResultOverlay({
  result,
  onDismiss,
}: {
  result: RaceOverlayResult;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (result.status !== 'won') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.7 },
      colors: ['#dc0000', '#e8b923', '#ffffff'],
    });
  }, [result.status]);

  const won = result.status === 'won';
  const net = result.potentialWin - result.stake;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-pitch-night/80 px-4">
      <div className="overlay-pop-in w-full max-w-xs rounded-2xl border border-line bg-pitch-night-raised p-6 text-center shadow-lg">
        {won ? (
          <>
            <p className="font-display text-3xl tracking-wide text-gold">🎉 Kazandın!</p>
            <p className="mt-2 text-sm text-text-primary">#{result.horseName} birinci geldi.</p>
            <p className="mt-4 font-display text-2xl text-grass">+{net} STA</p>
          </>
        ) : (
          <>
            <p className="font-display text-3xl tracking-wide text-text-primary">Bu sefer olmadı</p>
            <p className="mt-2 text-sm text-text-muted">
              Senin atın: {result.horseName}
              <br />
              Kazanan: {result.winningHorseName}
            </p>
            <p className="mt-4 text-sm text-text-muted">-{result.stake} STA</p>
          </>
        )}
        <button
          onClick={onDismiss}
          className="pop-interactive mt-6 w-full rounded-full bg-gold py-2.5 text-sm font-semibold text-pitch-night"
        >
          Devam Et
        </button>
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
git add src/components/RaceResultOverlay.tsx
git commit -m "feat: add RaceResultOverlay win/lose component"
```

---

### Task 6: Wire info banner, bet-count badge, and result overlay into `/at-yarisi/page.tsx`

**Files:**
- Modify: `src/app/at-yarisi/page.tsx`

**Interfaces:**
- Consumes: `RaceResultOverlay`/`RaceOverlayResult` from `@/components/RaceResultOverlay` (Task 5); the widened `CurrentRaceView`/`RaceEntryView` types (Task 2) already flow in via the existing `import type` line, no import change needed there.
- Produces: no new exports — this is a leaf page component.

- [ ] **Step 1: Add a countdown-seconds helper and phase-specific banner text**

Add near the top of the file, after the `POLL_MS` constant:

```ts
function secondsUntil(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 1000));
}

function bannerText(race: Extract<CurrentRaceView, { phase: string }>, remaining: number): string {
  if (race.phase === 'BETTING') return `🎫 Bahisler ${remaining}sn sonra kapanıyor`;
  if (race.phase === 'RACING') return `🏇 Yarış ${remaining}sn sonra bitiyor`;
  return `🏁 Sonuçlandı — yeni tur ${remaining}sn sonra başlıyor`;
}
```

`Extract<CurrentRaceView, { phase: string }>` narrows out the `{ error: 'NOT_ENOUGH_HORSES' }` branch — this file already does the equivalent narrowing manually via `if ('error' in race) return ...` before rendering, so `bannerText` will only ever be called with the non-error branch (see Step 4).

- [ ] **Step 2: Add the countdown state, updated every second, independent of the 2s poll**

Inside the `HorseRacePage` component, after the existing `useState` declarations, add:

```ts
const [nowTick, setNowTick] = useState(Date.now());
```

And a new `useEffect` alongside the existing polling effect:

```ts
useEffect(() => {
  const interval = setInterval(() => setNowTick(Date.now()), 1000);
  return () => clearInterval(interval);
}, []);
```

`nowTick` isn't read directly by `bannerText` (which reads `Date.now()` itself via `secondsUntil`) — its only job is to force a re-render every second so the displayed countdown updates. Reference it in a no-op way so ESLint's `no-unused-vars` doesn't flag it, e.g. by using it as a `key` prop in Step 4, or simply keep it referenced as shown below.

- [ ] **Step 3: Add result-overlay state and poll-diff detection**

Add near the other `useState` declarations:

```ts
const [overlayResult, setOverlayResult] = useState<RaceOverlayResult | null>(null);
const prevBetStatusRef = useRef<string | null>(null);
```

Add the import at the top of the file:

```ts
import { useEffect, useRef, useState } from 'react';
import RaceResultOverlay, { type RaceOverlayResult } from '@/components/RaceResultOverlay';
```

Inside the existing polling `useEffect`'s `poll` function, right after `if (!cancelled) setRace(data);`, add the transition-detection logic:

```ts
if (!cancelled) {
  setRace(data);
  if (!('error' in data) && data.myBet) {
    const prevStatus = prevBetStatusRef.current;
    const currentStatus = data.myBet.status;
    const alreadyShownKey = `shown-horse-result-${data.id}`;
    if (
      prevStatus === 'pending' &&
      currentStatus !== 'pending' &&
      !sessionStorage.getItem(alreadyShownKey)
    ) {
      sessionStorage.setItem(alreadyShownKey, '1');
      const winningEntry = data.entries.find((e) => e.finishPosition === 1);
      setOverlayResult({
        status: currentStatus,
        horseName: data.myBet.horseName,
        stake: data.myBet.stake,
        potentialWin: data.myBet.potentialWin,
        winningHorseName: winningEntry?.horseName ?? data.myBet.horseName,
      });
    }
    prevBetStatusRef.current = currentStatus;
  } else if (!('error' in data)) {
    prevBetStatusRef.current = null;
  }
}
```

- [ ] **Step 4: Render the banner, bet-count badge, and overlay**

Update the `OwnerBadge`-rendering block to include the bet-count badge, and add the banner above `RaceTrack` and the overlay at the end of the returned JSX. The full updated return block:

```tsx
return (
  <main className="mx-auto max-w-lg px-4 py-6">
    <h1 className="mb-1 font-display text-2xl tracking-wide text-text-primary">🐎 At Yarışı</h1>
    <p className="mb-4 text-sm text-text-muted">
      <span className={race.phase === 'RACING' ? 'live-pulse text-ferrari-red' : 'text-gold'}>{phaseLabel}</span>
    </p>

    <div className="mb-3 rounded-lg border border-line bg-pitch-night-raised px-3 py-2 text-center text-xs font-medium text-text-primary sm:text-sm">
      {bannerText(race, secondsUntil(race.phase === 'FINISHED' ? finishedPauseEndsAt(race.raceEndsAt) : race.phase === 'BETTING' ? race.bettingEndsAt : race.raceEndsAt))}
    </div>

    <RaceTrack
      entries={race.entries}
      phase={race.phase}
      bettingEndsAt={race.bettingEndsAt}
      raceEndsAt={race.raceEndsAt}
      seed={race.seed}
    />

    {/* Owner/co-owner roster — visible in every phase, not just betting,
        so viewers watching the live race can see whose horse is running. */}
    <div className="mt-3 flex flex-col gap-1.5">
      {race.entries.map((e) => (
        <div key={e.horseId} className="flex items-center justify-between rounded-lg border border-line bg-pitch-night-raised px-3 py-1.5">
          <span className="text-sm text-text-primary">
            #{e.number ?? '?'} {e.horseName}
          </span>
          <div className="flex items-center gap-2">
            {race.phase !== 'FINISHED' && (
              <span className="text-xs text-text-muted">🎟️ {e.betCount} kupon</span>
            )}
            <OwnerBadge entry={e} />
          </div>
        </div>
      ))}
    </div>

    {race.phase === 'BETTING' && (
      <div className="mt-4 flex flex-col gap-2">
        {race.entries.map((e) => (
          <button
            key={e.horseId}
            onClick={() => setSelectedHorseId(e.horseId)}
            className={`pop-interactive flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${
              selectedHorseId === e.horseId ? 'border-gold bg-gold/10' : 'border-line bg-pitch-night-raised'
            }`}
          >
            <span className="text-text-primary">
              #{e.number ?? '?'} {e.horseName}
            </span>
            <span className="font-bold text-gold">{e.oddsValue.toFixed(2)}</span>
          </button>
        ))}

        <div className="mt-2 flex items-center gap-2">
          <input
            type="number"
            min={1}
            value={stake}
            onChange={(ev) => setStake(parseInt(ev.target.value, 10) || 0)}
            className="w-24 rounded-lg border border-line bg-pitch-night px-3 py-2 text-sm text-text-primary"
          />
          <button
            onClick={submit}
            disabled={submitting || !selectedHorseId || stake <= 0}
            className="pop-interactive flex-1 rounded-full bg-gold py-2 text-sm font-semibold text-pitch-night disabled:opacity-40"
          >
            {submitting ? 'Gönderiliyor...' : 'Bahis Yap'}
          </button>
        </div>
        {message && <p className="text-center text-sm text-text-muted">{message}</p>}
      </div>
    )}

    {race.phase === 'FINISHED' && (
      <p className="mt-4 text-center font-display text-xl tracking-wide text-gold">
        🏆 Kazanan: {race.entries.find((e) => e.finishPosition === 1)?.horseName}
      </p>
    )}

    {overlayResult && (
      <RaceResultOverlay result={overlayResult} onDismiss={() => setOverlayResult(null)} />
    )}
  </main>
);
```

Add the small `finishedPauseEndsAt` helper next to `secondsUntil`/`bannerText` (needed because the `FINISHED` countdown target is `raceEndsAt + FINISHED_PAUSE_MS`, not `raceEndsAt` itself — `FINISHED_PAUSE_MS` is an engine-internal constant not exported, so this page hardcodes the same `5_000` the spec fixes as unchanged, with a comment):

```ts
// Mirrors the FINISHED_PAUSE_MS constant in src/lib/horseRaceEngine.ts (not
// exported from there — kept in sync manually, the spec fixes this value at
// 5s and doesn't change it, so a duplicated literal is an acceptable trade
// against exporting an internal engine constant for one client-side read).
const FINISHED_PAUSE_MS = 5_000;
function finishedPauseEndsAt(raceEndsAt: string): string {
  return new Date(new Date(raceEndsAt).getTime() + FINISHED_PAUSE_MS).toISOString();
}
```

Also reference `nowTick` from Step 2 so the banner actually re-renders every second — the cleanest way is to key the banner `div` on it:

```tsx
<div key={nowTick} className="mb-3 rounded-lg border border-line bg-pitch-night-raised px-3 py-2 text-center text-xs font-medium text-text-primary sm:text-sm">
```

(Using `nowTick` as a `key` forces React to re-evaluate the `secondsUntil(...)` call inside on every tick without needing to thread `nowTick` into `bannerText`'s signature.)

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Run full test suite**

Run: `npx vitest run`
Expected: PASS (no new pure-logic tests needed here — `secondsUntil`/`bannerText`/`finishedPauseEndsAt` are simple presentational helpers colocated with a client component, consistent with how this codebase only unit-tests standalone `src/lib/*` modules).

- [ ] **Step 7: Manual verification**

With `npm run dev` running, open `/at-yarisi`: confirm the countdown banner text and seconds update every second and match the current phase; confirm the `🎟️ N kupon` badge appears next to each horse during `BETTING`/`RACING` and disappears at `FINISHED`; place a bet, wait for the race to finish, and confirm the win/lose overlay appears exactly once (confetti only on a win, none on a loss, none if `prefers-reduced-motion` is enabled in devtools), and that reloading the page after dismissal does not re-show it for the same race (per the `sessionStorage` key).

- [ ] **Step 8: Commit**

```bash
git add src/app/at-yarisi/page.tsx
git commit -m "feat: add countdown banner, bet-count badge, and result overlay to /at-yarisi"
```

---

### Task 7: `jackpot-pulse` on the FINISHED winner (`src/components/RaceTrack.tsx`)

**Files:**
- Modify: `src/components/RaceTrack.tsx`

**Interfaces:**
- No signature changes — purely a class-toggle addition inside the existing `useEffect`.

- [ ] **Step 1: Track the winner's DOM node and toggle the class on FINISHED**

The runner element for each horse is the `<div className="absolute top-1/2 ... rounded-full ...">` circle (holding `entry.number`), reached via `runnerRefs.current[entry.horseId]`'s child. Since `runnerRefs` currently only stores the outer `translate3d` wrapper, add the pulse class to that wrapper instead — `jackpot-pulse` only scales `transform`, and this wrapper's own `transform` (`translate3d`) is set imperatively in the same effect, so apply the class to the *inner* circle div via a second ref map to avoid the two transforms colliding.

Add a second ref map alongside `runnerRefs`:

```ts
const badgeRefs = useRef<Record<string, HTMLDivElement | null>>({});
```

Update the JSX for the inner circle to attach it:

```tsx
<div
  ref={(node) => {
    badgeRefs.current[entry.horseId] = node;
  }}
  className="absolute top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-xs font-bold text-pitch-night"
  style={{ backgroundColor: entry.color }}
>
  {entry.number ?? ''}
</div>
```

Inside the `useEffect`, in the `if (phase !== 'RACING')` branch's `if (phase === 'FINISHED')` sub-branch, add the class toggle right after position is set:

```ts
if (phase === 'FINISHED') {
  const winnerId = finishOrder[0];
  for (const entry of entries) {
    setRunnerPosition(entry.horseId, rankByHorseId.get(entry.horseId) === 0 ? 1 : 0.95);
    const badge = badgeRefs.current[entry.horseId];
    if (badge) badge.classList.toggle('jackpot-pulse', entry.horseId === winnerId);
  }
} else {
  for (const entry of entries) {
    setRunnerPosition(entry.horseId, 0);
    const badge = badgeRefs.current[entry.horseId];
    if (badge) badge.classList.remove('jackpot-pulse');
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual verification**

With `npm run dev` running, watch `/at-yarisi` through a full race to `FINISHED` — the winning horse's number badge should visibly pulse (scale 1 ↔ 1.18) while the others stay static.

- [ ] **Step 4: Commit**

```bash
git add src/components/RaceTrack.tsx
git commit -m "feat: pulse the winning horse's badge on race finish"
```

---

### Task 8: Info box + bet-count subtext in `HorseRaceBoard.tsx`

**Files:**
- Modify: `src/app/HorseRaceBoard.tsx`

**Interfaces:**
- Consumes: the widened `CurrentRaceView` (Task 2) — already imported as a type in this file.
- Produces: `RaceBoardRow` gains `betCount: number` — consumed by Task 9 (`src/app/page.tsx`'s `raceBoardRows` map).

- [ ] **Step 1: Add `betCount` to `RaceBoardRow`**

```ts
export type RaceBoardRow = {
  id: string;
  raceNumber: number;
  phase: 'BETTING' | 'RACING' | 'FINISHED';
  createdAt: string;
  bettingEndsAt: string;
  raceEndsAt: string;
  top3: { position: number; name: string; number: number | null }[];
  // Sum of every entry's betCount for this race's *current* leader (i.e. the
  // horse currently in 1st, or the horse with the most bets pre-finish).
  // Only meaningful/rendered for the single most-recent row — historical
  // rows pass 0 since BoardRow never reads it for them (see Step 3).
  betCount: number;
};
```

- [ ] **Step 2: Update the polling merge to compute `betCount`, and the server-side initial map (Task 9 handles `page.tsx`, but this file's own poll-merge needs its own totalling logic now)**

In the `poll` function's `setRows` callback, add `betCount` to the `merged` object — sum every entry's `betCount` as a simple "how much total coupon activity does this round have" figure:

```ts
const merged: RaceBoardRow = {
  id: data.id,
  raceNumber: idx >= 0 ? prev[idx].raceNumber : prev.length + 1,
  phase: data.phase,
  createdAt: data.createdAt,
  bettingEndsAt: data.bettingEndsAt,
  raceEndsAt: data.raceEndsAt,
  top3: data.entries
    .filter((e) => e.finishPosition !== null && e.finishPosition <= 3)
    .map((e) => ({ position: e.finishPosition!, name: e.horseName, number: e.number })),
  betCount: data.entries.reduce((sum, e) => sum + e.betCount, 0),
};
```

- [ ] **Step 3: Add the info-box logic (live tab only, current/latest row only) and the bet-count subtext**

Add the same `secondsUntil`/`bannerText`/`finishedPauseEndsAt` helpers used in Task 6, at module scope in this file (duplicated rather than shared across files — the two pages have slightly different lifetimes and this codebase doesn't currently have a shared client-hooks module for this pattern; extracting one is out of scope per the spec's "no unrelated refactoring" constraint):

```ts
const FINISHED_PAUSE_MS = 5_000;

function secondsUntil(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 1000));
}

function finishedPauseEndsAt(raceEndsAt: string): string {
  return new Date(new Date(raceEndsAt).getTime() + FINISHED_PAUSE_MS).toISOString();
}

function bannerText(row: RaceBoardRow, remaining: number): string {
  if (row.phase === 'BETTING') return `🎫 Bahisler ${remaining}sn sonra kapanıyor`;
  if (row.phase === 'RACING') return `🏇 Yarış ${remaining}sn sonra bitiyor`;
  return `🏁 Sonuçlandı — yeni tur ${remaining}sn sonra başlıyor`;
}
```

Add a 1-second re-render tick inside `HorseRaceBoard`, alongside the existing polling `useEffect`:

```ts
const [nowTick, setNowTick] = useState(Date.now());
useEffect(() => {
  const interval = setInterval(() => setNowTick(Date.now()), 1000);
  return () => clearInterval(interval);
}, []);
```

In the `tab === 'live'` render branch, add the info box above the row list, and the bet-count subtext under the current (first, since `sortedRows` is sorted `raceNumber` descending) row's ranking cell:

```tsx
{tab === 'live' && (
  <div>
    {sortedRows.length === 0 && (
      <p className="px-3 py-4 text-center text-sm text-text-muted">Bugün henüz yarış oynanmadı.</p>
    )}
    {sortedRows.length > 0 && (
      <div key={nowTick} className="mx-3 mt-3 rounded-lg border border-line bg-pitch-night px-3 py-2 text-center text-xs font-medium text-text-primary">
        {bannerText(
          sortedRows[0],
          secondsUntil(
            sortedRows[0].phase === 'FINISHED'
              ? finishedPauseEndsAt(sortedRows[0].raceEndsAt)
              : sortedRows[0].phase === 'BETTING'
                ? sortedRows[0].bettingEndsAt
                : sortedRows[0].raceEndsAt
          )
        )}
      </div>
    )}
    {sortedRows.map((row, i) => (
      <div key={row.id}>
        <BoardRow row={row} />
        {i === 0 && row.phase !== 'FINISHED' && row.betCount > 0 && (
          <p className="px-3 pb-1.5 text-[11px] text-text-muted">🎟️ {row.betCount} kupon</p>
        )}
      </div>
    ))}
    <div className="p-3">
      <Link href="/at-yarisi" className="pop-interactive block rounded-full bg-gold py-2 text-center text-sm font-semibold text-pitch-night">
        Yarışa Katıl →
      </Link>
    </div>
  </div>
)}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Run full test suite**

Run: `npx vitest run`
Expected: PASS (no new pure-logic module here to test, same rationale as Task 6 Step 6).

- [ ] **Step 6: Commit**

```bash
git add src/app/HorseRaceBoard.tsx
git commit -m "feat: add countdown info box and bet-count subtext to homepage race board"
```

---

### Task 9: `HorseRaceStatsWidget` + homepage wiring (`src/app/HorseRaceStatsWidget.tsx`, `src/app/page.tsx`)

**Files:**
- Create: `src/app/HorseRaceStatsWidget.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `computeUserScore` from `@/lib/score` (existing); `RaceBoardRow` type is not needed here — this widget takes its own narrow prop shape.
- Produces: `<HorseRaceStatsWidget isLoggedIn={boolean} bets={HorseBetStatRow[]} />`, exported alongside a `HorseBetStatRow` type — consumed only by `src/app/page.tsx` (this task, Step 3).

- [ ] **Step 1: Implement the widget**

```tsx
import Link from 'next/link';
import { computeUserScore } from '@/lib/score';

export type HorseBetStatRow = {
  horseName: string;
  status: 'pending' | 'won' | 'lost';
  stake: number;
  potentialWin: number;
};

function mostWonHorse(bets: HorseBetStatRow[]): string | null {
  const counts = new Map<string, number>();
  for (const bet of bets) {
    if (bet.status !== 'won') continue;
    counts.set(bet.horseName, (counts.get(bet.horseName) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [name, count] of counts) {
    if (count > bestCount) {
      best = name;
      bestCount = count;
    }
  }
  return best;
}

export default function HorseRaceStatsWidget({
  isLoggedIn,
  bets,
}: {
  isLoggedIn: boolean;
  bets: HorseBetStatRow[];
}) {
  if (!isLoggedIn || bets.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-pitch-night-raised p-4">
        <h3 className="mb-2 font-display text-lg tracking-wide text-text-primary">At Yarışı Nedir?</h3>
        <ul className="mb-4 flex flex-col gap-1.5 text-sm text-text-muted">
          <li>🎫 Her turda 7 at yarışır, bahis penceresi sadece 7 saniye — hızlı karar ver.</li>
          <li>📊 Oranlar atın hız/form/şans puanına göre otomatik hesaplanır.</li>
          <li>🤝 İstersen bir ata ortak olup pasif STA geliri kazanabilirsin (At Mağazası).</li>
        </ul>
        <Link href="/at-yarisi" className="pop-interactive inline-block rounded-full bg-gold px-5 py-2 text-sm font-semibold text-pitch-night">
          Hemen Oyna →
        </Link>
      </div>
    );
  }

  const score = computeUserScore(bets);
  const won = bets.filter((b) => b.status === 'won').length;
  const lost = bets.filter((b) => b.status === 'lost').length;
  const winRate = won + lost > 0 ? Math.round((won / (won + lost)) * 100) : 0;
  const favorite = mostWonHorse(bets);

  return (
    <div className="rounded-xl border border-line bg-pitch-night-raised p-4">
      <h3 className="mb-3 font-display text-lg tracking-wide text-text-primary">At Yarışı İstatistiklerin</h3>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className={`font-display text-2xl ${score.net > 0 ? 'text-grass' : score.net < 0 ? 'text-red-400' : 'text-text-muted'}`}>
            {score.net > 0 ? '+' : ''}{score.net}
          </p>
          <p className="text-[11px] text-text-muted">Net Puan</p>
        </div>
        <div>
          <p className="font-display text-2xl text-text-primary">{bets.length}</p>
          <p className="text-[11px] text-text-muted">Kupon</p>
        </div>
        <div>
          <p className="font-display text-2xl text-gold">%{winRate}</p>
          <p className="text-[11px] text-text-muted">Kazanma Oranı</p>
        </div>
      </div>
      {favorite && (
        <p className="mt-3 text-center text-xs text-text-muted">
          En çok kazandığın at: <span className="text-text-primary">{favorite}</span>
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Widen the `currentUser.horseBets` select in `src/app/page.tsx`**

In `src/app/page.tsx`, the `currentUser` query currently selects only `horseBets: { include: { horse: { select: { name: true, number: true } } }, orderBy: { createdAt: 'desc' }, take: 8 }`. Widen it to also select `status`, `stake`, `potentialWin` (all already exist on `HorseBet`, no schema change) and drop the `take: 8` cap for this specific query's purpose — the stats widget needs the user's *full* bet history to compute an accurate win rate and "most-won horse", not just the 8 most recent (the `myHorseBets`/`MyHorseBetRow` list used by `HorseRaceBoard`'s history tab still only needs recent ones, so it keeps its own separate `take: 8` — see Step 3 for how the two now diverge).

Replace the `currentUser` query inside the `Promise.all` array:

```ts
session?.user?.name
  ? prisma.user.findUnique({
      where: { username: session.user.name },
      select: {
        horseBets: {
          include: { horse: { select: { name: true, number: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    })
  : null,
```

(Removed `take: 8` — the same query result now feeds both the recent-history list, Step 3, and the full-history stats widget, Step 4.)

- [ ] **Step 3: Update `myHorseBets` (history tab, unchanged shape) to take only the first 8 from the now-unlimited query result**

Replace:

```ts
const myHorseBets: MyHorseBetRow[] = (currentUser?.horseBets ?? []).map((bet) => ({
  id: bet.id,
  horseName: bet.horse.name,
  horseNumber: bet.horse.number,
  stake: bet.stake,
  potentialWin: bet.potentialWin,
  status: bet.status as MyHorseBetRow['status'],
  createdAt: bet.createdAt.toISOString(),
}));
```

with:

```ts
const myHorseBets: MyHorseBetRow[] = (currentUser?.horseBets ?? []).slice(0, 8).map((bet) => ({
  id: bet.id,
  horseName: bet.horse.name,
  horseNumber: bet.horse.number,
  stake: bet.stake,
  potentialWin: bet.potentialWin,
  status: bet.status as MyHorseBetRow['status'],
  createdAt: bet.createdAt.toISOString(),
}));
```

(`orderBy: { createdAt: 'desc' }` on the query already puts newest first, so `.slice(0, 8)` reproduces the old `take: 8` behavior exactly for this list.)

- [ ] **Step 4: Build the `horseBetStats` array and render the widget**

Add, right after the `myHorseBets` assignment:

```ts
const horseBetStats: HorseBetStatRow[] = (currentUser?.horseBets ?? []).map((bet) => ({
  horseName: bet.horse.name,
  status: bet.status as HorseBetStatRow['status'],
  stake: bet.stake,
  potentialWin: bet.potentialWin,
}));
```

Add the import at the top of the file:

```ts
import HorseRaceStatsWidget, { type HorseBetStatRow } from './HorseRaceStatsWidget';
```

Render it directly below the existing `HorseRaceBoard` section (still inside the same `<Reveal delayMs={80}>` block or its own — matching the existing pattern of one `<Reveal>` per `<section>`, add a new one right after the "CANLI YARIŞ" section closes):

```tsx
<Reveal delayMs={80}>
  <section className="mb-10">
    <SectionLabel number="04" label="CANLI YARIŞ" />
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h2 className="font-display text-2xl tracking-wide text-text-primary">STA YARIŞ PANOSU</h2>
        <p className="text-sm text-text-muted">Bugünün canlı sonuçları, kalkış sırasıyla.</p>
      </div>
      <span className="shrink-0 rounded-full border border-ferrari-red/40 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-ferrari-red">
        ● canlı
      </span>
    </div>
    <HorseRaceBoard initialRows={raceBoardRows} myBets={myHorseBets} isLoggedIn={Boolean(session?.user?.name)} />
    <div className="mt-4">
      <HorseRaceStatsWidget isLoggedIn={Boolean(session?.user?.name)} bets={horseBetStats} />
    </div>
  </section>
</Reveal>
```

(This replaces the existing `04 — CANLI YARIŞ` `<Reveal>` block wholesale — same section number, the stats widget is added as a second element inside the same section rather than a new numbered section, since it's directly related content, not a new topic.)

- [ ] **Step 5: Update `raceBoardRows` map to include `betCount`**

`todayHorseRaces`'s Prisma query currently includes `entries: { include: { horse: { select: { name: true, number: true } } } }` — it has no `betCount` data available (that's computed by the engine's `toView`, not this page's own query). Per the spec, historical rows can safely send `0` since `BoardRow`/the bet-count subtext only reads `betCount` for `sortedRows[0]` when the client-side poll has already merged live engine data into it (Task 8, Step 2/3) — the *initial* server-rendered value is only a fallback until the first poll tick.

Update the `raceBoardRows` map:

```ts
const raceBoardRows: RaceBoardRow[] = todayHorseRaces.map((race, index) => ({
  id: race.id,
  raceNumber: index + 1,
  phase: race.phase as RaceBoardRow['phase'],
  createdAt: race.createdAt.toISOString(),
  bettingEndsAt: race.bettingEndsAt.toISOString(),
  raceEndsAt: race.raceEndsAt.toISOString(),
  top3: race.entries
    .filter((entry) => entry.finishPosition !== null && entry.finishPosition <= 3)
    .map((entry) => ({
      position: entry.finishPosition!,
      name: entry.horse.name,
      number: entry.horse.number,
    })),
  betCount: 0,
}));
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Run full test suite**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 8: Manual verification**

With `npm run dev` running: (a) visit the homepage logged out — the stats widget should show the "At Yarışı Nedir?" onboarding card with the "Hemen Oyna →" link to `/at-yarisi`; (b) log in as a user with zero horse bets — same onboarding card should show; (c) log in as a user with at least one settled horse bet — the widget should show net score, coupon count, win rate, and (if any wins) "En çok kazandığın at"; (d) confirm the "Geçmiş Kuponlarım" tab in `HorseRaceBoard` still shows up to 8 most recent bets, unaffected by the widget's use of the full history.

- [ ] **Step 9: Commit**

```bash
git add src/app/HorseRaceStatsWidget.tsx src/app/page.tsx
git commit -m "feat: add HorseRaceStatsWidget with onboarding card to homepage"
```

---

### Task 10: Full-suite regression pass

**Files:** none (verification-only task).

**Interfaces:** none.

- [ ] **Step 1: Full type-check**

Run: `npx tsc --noEmit`
Expected: no errors, across the whole project.

- [ ] **Step 2: Full test suite**

Run: `npx vitest run`
Expected: all tests pass, including the new `simulatedBetCount` suite from Task 1 and every pre-existing suite untouched by this plan.

- [ ] **Step 3: Manual end-to-end pass**

With `npm run dev` running, walk through the full loop once: place a winning bet and a losing bet across two rounds (use a second browser/incognito session or two accounts if needed to observe both outcomes), confirming for each:
- Countdown banners on both `/at-yarisi` and the homepage board count down accurately and switch text at each phase boundary.
- `🎟️ N kupon` badges appear and plausibly increase over a round (mix of real bets you place + the simulated boost).
- The win overlay fires confetti in the site's red/gold/white palette exactly once per settled race, the loss overlay fires with no confetti, and neither reappears on refresh for the same race.
- The winning horse's badge visibly pulses during `FINISHED`.
- The homepage stats widget reflects the two new bets' outcome after the leaderboard-affecting settlement completes (may require a page refresh, since it's server-rendered).
- A race genuinely runs 15-30 seconds now (not 10-20s) and still animates smoothly (no visible stutter/jump).

- [ ] **Step 4: Commit (only if Step 3 surfaced fixups)**

If manual verification in Step 3 requires any code fix, make the fix, re-run Steps 1-2, then:

```bash
git add -A
git commit -m "fix: address issues found in horse race liveliness end-to-end pass"
```

If no fixes were needed, skip this step — Task 10 is verification-only and produces no commit in the clean-pass case.

---
