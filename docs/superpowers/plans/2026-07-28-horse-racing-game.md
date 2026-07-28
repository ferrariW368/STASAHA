# At Yarışı Mini-Oyunu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a continuously-running fictional horse racing betting game (7 horses per round, live 2D animation, STA betting) plus a fractional-ownership shop, fully wired into the existing STA economy and leaderboard.

**Architecture:** New Prisma models (`Horse`, `HorseOwnership`, `HorseRace`, `HorseRaceEntry`, `HorseBet`) alongside the existing schema. A pure-function algorithm module (`src/lib/horseRace.ts`) computes odds and a deterministic seeded finish order — imported identically by both the server (settlement) and the client (live animation), so no realtime channel is needed to keep everyone's screen in sync. Race-round progression uses a **lazy-tick** pattern: any request that reads race state first advances it past any expired phase, so no persistent background worker is required on Vercel's serverless hosting.

**Tech Stack:** Next.js 16 (App Router), Prisma 6.19.3 + Neon Postgres, NextAuth (existing `authOptions`/`requireAdmin`), Tailwind v4 tokens, Vitest.

## Global Constraints

- Design spec: `docs/superpowers/specs/2026-07-28-horse-racing-game-design.md` — read it for the full rationale before starting.
- No real TJK data, no real money — this is the same fictional STA economy as the rest of the site.
- `RACE_SIZE = 7` horses per round, drawn randomly from all `Horse` rows where `active = true`.
- Betting window: 30 seconds. Race duration: random between 30 and 45 seconds. Post-race "sonuç" pause: 5 seconds before the next round auto-starts.
- Owner bonus rate: 10% of a horse's `price`, split proportionally to `staInvested` among that horse's `HorseOwnership` rows when it wins. This bonus is a `staBalance` credit only — it must **never** be included in any `computeUserScore` call (leaderboard "puan" stays bet-only, per the approved spec).
- One `HorseBet` per user per `HorseRace` (`@@unique([userId, raceId])`, mirroring the existing `Bet` model's `@@unique([userId, matchId])`).
- Every new Server Action that mutates data must follow the existing two patterns already in the codebase: user-facing actions check `getServerSession(authOptions)` (see `src/actions/bets.ts`), admin-only actions call `requireAdmin()` first (see `src/actions/teams.ts`).
- Every DB-mutating action that touches `User.staBalance` must use `prisma.$transaction([...])`, matching `placeBet` in `src/actions/bets.ts`.
- New pure-logic modules (no Prisma import) get full Vitest coverage, matching `tests/odds.test.ts`/`tests/score.test.ts`. Prisma-dependent modules (the race engine, server actions) are **not** unit-tested with a mocked DB — this codebase has no such infrastructure (every existing test file is pure-logic only); verify those manually via the dev server instead, consistent with how `src/actions/bets.ts` etc. are already handled.
- Run `npx tsc --noEmit` and `npx vitest run` after every task — both must stay clean throughout.
- All new UI text is in Turkish, matching the rest of the site.
- All new Tailwind classes use the existing design tokens (`pitch-night`, `pitch-night-raised`, `line`, `gold`, `ferrari-red`, `text-primary`, `text-muted`, `font-display`) — no raw `neutral-*`/`gray-*` classes (see the admin-redesign plan for why that matters).

---

### Task 1: Prisma schema + migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create (via CLI, not by hand): a new migration folder under `prisma/migrations/`

**Interfaces:**
- Produces: `Horse`, `HorseOwnership`, `HorseRace`, `HorseRaceEntry`, `HorseBet` Prisma models and their generated Prisma Client types (`prisma.horse`, `prisma.horseOwnership`, `prisma.horseRace`, `prisma.horseRaceEntry`, `prisma.horseBet`), used by every later task.

- [ ] **Step 1: Add the new models to `prisma/schema.prisma`**

Add this block at the end of the file:

```prisma
model Horse {
  id           String  @id @default(cuid())
  name         String
  number       Int?
  color        String  // hex color, e.g. "#e8b923" — visual identity on the track/shop
  speedRating  Int     // 1-10, admin-entered
  formRating   Int     // 1-10, admin-entered
  luckRating   Int     // 1-10, admin-entered — adds upset variance
  price        Int     // STA, full (100%) ownership value, admin-entered
  active       Boolean @default(true) // false = retired from the race pool, kept for history
  ownerships   HorseOwnership[]
  raceEntries  HorseRaceEntry[]
  bets         HorseBet[]
}

model HorseOwnership {
  id          String   @id @default(cuid())
  horseId     String
  horse       Horse    @relation(fields: [horseId], references: [id])
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  staInvested Int      // this user's cumulative STA investment in this horse
  createdAt   DateTime @default(now())

  @@unique([horseId, userId])
}

model HorseRace {
  id            String   @id @default(cuid())
  phase         String   @default("BETTING") // "BETTING" | "RACING" | "FINISHED"
  bettingEndsAt DateTime
  raceEndsAt    DateTime
  seed          Int      // deterministic finish-order seed, shared by server settlement and client animation
  createdAt     DateTime @default(now())
  entries       HorseRaceEntry[]
  bets          HorseBet[]
}

model HorseRaceEntry {
  id             String    @id @default(cuid())
  raceId         String
  race           HorseRace @relation(fields: [raceId], references: [id])
  horseId        String
  horse          Horse     @relation(fields: [horseId], references: [id])
  oddsValue      Float     // frozen at race creation, same pattern as the football Odds model
  finishPosition Int?      // 1 = winner, filled in at settlement

  @@unique([raceId, horseId])
}

model HorseBet {
  id             String    @id @default(cuid())
  userId         String
  user           User      @relation(fields: [userId], references: [id])
  raceId         String
  race           HorseRace @relation(fields: [raceId], references: [id])
  horseId        String
  horse          Horse     @relation(fields: [horseId], references: [id])
  stake          Int
  oddsValueAtBet Float
  potentialWin   Int       // Math.round(stake * oddsValueAtBet), stored at bet time — same shape as Bet.potentialWin so both feed computeUserScore identically
  status         String    @default("pending") // "pending" | "won" | "lost"
  createdAt      DateTime  @default(now())

  @@unique([userId, raceId])
}
```

- [ ] **Step 2: Add the back-relations to the existing `User` model**

In `prisma/schema.prisma`, find the `User` model and add two lines inside it (next to the existing `bets Bet[]` and `lineups Lineup[]` lines):

```prisma
  horseOwnerships HorseOwnership[]
  horseBets       HorseBet[]
```

- [ ] **Step 3: Generate and apply the migration**

Run: `npx prisma migrate dev --name add_horse_racing`
Expected: a new folder appears under `prisma/migrations/` named `<timestamp>_add_horse_racing`, containing a `migration.sql` that creates the 4 new tables and 2 new columns on `User`. The command applies it directly to the shared Neon dev database (same workflow as every prior migration in this project — there is no separate staging DB).

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors (Prisma Client types regenerate automatically as part of `migrate dev`).

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add Horse, HorseOwnership, HorseRace, HorseRaceEntry, HorseBet models"
```

---

### Task 2: Race algorithm (`src/lib/horseRace.ts`) + tests

**Files:**
- Create: `src/lib/horseRace.ts`
- Test: `tests/horseRace.test.ts`

**Interfaces:**
- Consumes: nothing (pure module, no Prisma import — must be safely importable from both server code and a `'use client'` component).
- Produces:
  - `type HorseAttributes = { speedRating: number; formRating: number; luckRating: number }`
  - `compositeScore(h: HorseAttributes): number`
  - `winProbabilities(horses: HorseAttributes[]): number[]` — same order as input, sums to ~1
  - `oddsFromProbabilities(probabilities: number[]): number[]` — same order as input
  - `mulberry32(seed: number): () => number` — seeded PRNG factory
  - `drawFinishOrder(horseIds: string[], probabilities: number[], rng: () => number): string[]` — full finish order, index 0 = winner
  - These 6 exports are consumed by Task 3 (`horseRaceEngine.ts`, server-side settlement) and Task 6 (`RaceTrack.tsx`, client-side animation) — the whole point of this module is that both call sites get identical results from the same seed.

- [ ] **Step 1: Write the failing tests**

Create `tests/horseRace.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { compositeScore, winProbabilities, oddsFromProbabilities, mulberry32, drawFinishOrder } from '../src/lib/horseRace';

describe('compositeScore', () => {
  it('weighs speed highest, then form, then luck', () => {
    const fast = compositeScore({ speedRating: 10, formRating: 1, luckRating: 1 });
    const inForm = compositeScore({ speedRating: 1, formRating: 10, luckRating: 1 });
    const lucky = compositeScore({ speedRating: 1, formRating: 1, luckRating: 10 });
    expect(fast).toBeGreaterThan(inForm);
    expect(inForm).toBeGreaterThan(lucky);
  });
});

describe('winProbabilities', () => {
  it('sums to 1 across the field', () => {
    const horses = [
      { speedRating: 8, formRating: 6, luckRating: 5 },
      { speedRating: 5, formRating: 5, luckRating: 5 },
      { speedRating: 3, formRating: 4, luckRating: 9 },
    ];
    const probs = winProbabilities(horses);
    expect(probs.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5);
  });

  it('gives the strongest horse the highest probability', () => {
    const horses = [
      { speedRating: 9, formRating: 9, luckRating: 5 },
      { speedRating: 3, formRating: 3, luckRating: 5 },
    ];
    const probs = winProbabilities(horses);
    expect(probs[0]).toBeGreaterThan(probs[1]);
  });

  it('gives identical horses identical probability', () => {
    const horses = [
      { speedRating: 5, formRating: 5, luckRating: 5 },
      { speedRating: 5, formRating: 5, luckRating: 5 },
    ];
    const probs = winProbabilities(horses);
    expect(probs[0]).toBeCloseTo(probs[1], 10);
  });
});

describe('oddsFromProbabilities', () => {
  it('gives lower odds to higher-probability horses', () => {
    const odds = oddsFromProbabilities([0.5, 0.1]);
    expect(odds[0]).toBeLessThan(odds[1]);
  });

  it('clamps every value into [1.3, 15]', () => {
    const odds = oddsFromProbabilities([0.99, 0.001]);
    for (const o of odds) {
      expect(o).toBeGreaterThanOrEqual(1.3);
      expect(o).toBeLessThanOrEqual(15);
    }
  });
});

describe('mulberry32', () => {
  it('is deterministic: same seed produces the same sequence', () => {
    const rngA = mulberry32(42);
    const rngB = mulberry32(42);
    const seqA = [rngA(), rngA(), rngA()];
    const seqB = [rngB(), rngB(), rngB()];
    expect(seqA).toEqual(seqB);
  });

  it('produces values in [0, 1)', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 20; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('drawFinishOrder', () => {
  it('returns every horse id exactly once', () => {
    const ids = ['a', 'b', 'c', 'd'];
    const order = drawFinishOrder(ids, [0.4, 0.3, 0.2, 0.1], mulberry32(1));
    expect([...order].sort()).toEqual([...ids].sort());
  });

  it('is deterministic for a fixed seed', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const probs = [0.3, 0.2, 0.15, 0.15, 0.1, 0.05, 0.05];
    const orderA = drawFinishOrder(ids, probs, mulberry32(123));
    const orderB = drawFinishOrder(ids, probs, mulberry32(123));
    expect(orderA).toEqual(orderB);
  });

  it('picks the winner from the weighted distribution over many trials (statistical, not exact)', () => {
    const ids = ['strong', 'weak'];
    const probs = [0.9, 0.1];
    let strongWins = 0;
    for (let seed = 0; seed < 200; seed++) {
      const order = drawFinishOrder(ids, probs, mulberry32(seed));
      if (order[0] === 'strong') strongWins++;
    }
    expect(strongWins).toBeGreaterThan(140); // expect roughly 90% x 200 = 180, allow generous margin
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/horseRace.test.ts`
Expected: FAIL — `Cannot find module '../src/lib/horseRace'`.

- [ ] **Step 3: Implement `src/lib/horseRace.ts`**

```ts
export type HorseAttributes = { speedRating: number; formRating: number; luckRating: number };

const SPEED_WEIGHT = 0.45;
const FORM_WEIGHT = 0.35;
const LUCK_WEIGHT = 0.2;

// Softmax temperature: higher = flatter distribution (favorites and
// longshots closer together), lower = sharper (favorites dominate more).
// 3.0 keeps the spread realistic without ever making a longshot a lock.
const SOFTMAX_TEMPERATURE = 3.0;

// Same "house margin multiplies the fair odds up" convention as
// src/lib/odds.ts's HOUSE_MARGIN — kept consistent across both betting
// systems on this site rather than editorializing a "correct" direction here.
const HOUSE_MARGIN = 1.08;
const MIN_ODDS = 1.3;
const MAX_ODDS = 15;

export function compositeScore(h: HorseAttributes): number {
  return SPEED_WEIGHT * h.speedRating + FORM_WEIGHT * h.formRating + LUCK_WEIGHT * h.luckRating;
}

export function winProbabilities(horses: HorseAttributes[]): number[] {
  const scaled = horses.map((h) => compositeScore(h) / SOFTMAX_TEMPERATURE);
  const max = Math.max(...scaled);
  const exps = scaled.map((s) => Math.exp(s - max)); // subtract max for numerical stability
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

export function oddsFromProbabilities(probabilities: number[]): number[] {
  return probabilities.map((p) => {
    const raw = (1 / p) * HOUSE_MARGIN;
    const clamped = Math.min(MAX_ODDS, Math.max(MIN_ODDS, raw));
    return Math.round(clamped * 100) / 100;
  });
}

// Deterministic PRNG (mulberry32) — needed because Math.random() can't be
// seeded, and the whole point here is that the server (at settlement) and
// every client (during the live animation) derive the exact same finish
// order from the same stored seed, with no realtime channel between them.
export function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Weighted draw without replacement: repeatedly picks a "next finisher" from
// the remaining field, weighted by their win probability. Index 0 of the
// result is the winner.
export function drawFinishOrder(horseIds: string[], probabilities: number[], rng: () => number): string[] {
  const remaining = horseIds.map((id, i) => ({ id, weight: probabilities[i] }));
  const order: string[] = [];
  while (remaining.length > 0) {
    const totalWeight = remaining.reduce((s, r) => s + r.weight, 0);
    let roll = rng() * totalWeight;
    let chosenIdx = remaining.length - 1;
    for (let i = 0; i < remaining.length; i++) {
      roll -= remaining[i].weight;
      if (roll <= 0) {
        chosenIdx = i;
        break;
      }
    }
    order.push(remaining[chosenIdx].id);
    remaining.splice(chosenIdx, 1);
  }
  return order;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/horseRace.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/horseRace.ts tests/horseRace.test.ts
git commit -m "feat: add horse race scoring/odds/finish-order algorithm"
```

---

### Task 3: Lazy-tick race engine (`src/lib/horseRaceEngine.ts`)

**Files:**
- Create: `src/lib/horseRaceEngine.ts`

**Interfaces:**
- Consumes: `compositeScore` is not needed directly (only via `winProbabilities`), `winProbabilities`, `oddsFromProbabilities`, `mulberry32`, `drawFinishOrder` from `@/lib/horseRace` (Task 2); `prisma` from `@/lib/prisma`.
- Produces:
  - `type RaceEntryView = { horseId: string; horseName: string; number: number | null; color: string; speedRating: number; formRating: number; luckRating: number; oddsValue: number; finishPosition: number | null }`
  - `type CurrentRaceView = { id: string; phase: 'BETTING' | 'RACING' | 'FINISHED'; bettingEndsAt: string; raceEndsAt: string; seed: number; entries: RaceEntryView[] } | { error: 'NOT_ENOUGH_HORSES' }`
  - `async function getCurrentRace(): Promise<CurrentRaceView>` — consumed by Task 4 (API route) and Task 5 (bet placement, to validate phase/odds).

- [ ] **Step 1: Implement the engine**

```ts
import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { winProbabilities, oddsFromProbabilities, mulberry32, drawFinishOrder } from './horseRace';

const RACE_SIZE = 7;
const BETTING_DURATION_MS = 30_000;
const MIN_RACE_DURATION_MS = 30_000;
const MAX_RACE_DURATION_MS = 45_000;
const FINISHED_PAUSE_MS = 5_000; // how long the "kazanan: X" screen shows before the next round auto-starts
const OWNER_BONUS_RATE = 0.1;

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
};

export type CurrentRaceView =
  | {
      id: string;
      phase: 'BETTING' | 'RACING' | 'FINISHED';
      bettingEndsAt: string;
      raceEndsAt: string;
      seed: number;
      entries: RaceEntryView[];
    }
  | { error: 'NOT_ENOUGH_HORSES' };

const raceInclude = { entries: { include: { horse: true } } } as const;

// The standard Prisma pattern for typing a query result shaped by a reused
// `include` object — `Prisma.HorseRaceGetPayload` derives the exact type
// Prisma Client returns for this include, so `toView` doesn't need its own
// hand-written interface that could drift from the real query shape.
type RaceWithEntries = Prisma.HorseRaceGetPayload<{ include: typeof raceInclude }>;

function toView(race: RaceWithEntries): CurrentRaceView {
  return {
    id: race.id,
    phase: race.phase as 'BETTING' | 'RACING' | 'FINISHED',
    bettingEndsAt: race.bettingEndsAt.toISOString(),
    raceEndsAt: race.raceEndsAt.toISOString(),
    seed: race.seed,
    entries: race.entries.map((e) => ({
      horseId: e.horseId,
      horseName: e.horse.name,
      number: e.horse.number,
      color: e.horse.color,
      speedRating: e.horse.speedRating,
      formRating: e.horse.formRating,
      luckRating: e.horse.luckRating,
      oddsValue: e.oddsValue,
      finishPosition: e.finishPosition,
    })),
  };
}

// Note on concurrency: if two requests arrive at the exact same instant with
// no current race, both could call this and create two HorseRace rows. This
// is a narrow, self-healing edge case for a low-traffic friend-group app —
// getCurrentRace always reads the single latest race by createdAt, so the
// "loser" row is simply never selected again and accumulates no bets. Not
// worth a distributed lock for this scale; the settlement path (settleRace,
// below) is the one that actually moves money, and that IS guarded.
async function startNewRace(): Promise<CurrentRaceView> {
  const activeHorses = await prisma.horse.findMany({ where: { active: true } });
  if (activeHorses.length < RACE_SIZE) return { error: 'NOT_ENOUGH_HORSES' };

  // Fisher-Yates shuffle, then take the first RACE_SIZE.
  const shuffled = [...activeHorses];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const picked = shuffled.slice(0, RACE_SIZE);

  const probs = winProbabilities(picked);
  const odds = oddsFromProbabilities(probs);

  const now = new Date();
  const bettingEndsAt = new Date(now.getTime() + BETTING_DURATION_MS);
  const raceDurationMs = MIN_RACE_DURATION_MS + Math.random() * (MAX_RACE_DURATION_MS - MIN_RACE_DURATION_MS);
  const raceEndsAt = new Date(bettingEndsAt.getTime() + raceDurationMs);
  const seed = Math.floor(Math.random() * 2 ** 31);

  const race = await prisma.horseRace.create({
    data: {
      phase: 'BETTING',
      bettingEndsAt,
      raceEndsAt,
      seed,
      entries: {
        create: picked.map((horse, i) => ({ horseId: horse.id, oddsValue: odds[i] })),
      },
    },
    include: raceInclude,
  });

  return toView(race);
}

async function settleRace(raceId: string): Promise<void> {
  // Conditional update: only the request that actually flips BETTING/RACING's
  // phase to FINISHED performs settlement. Concurrent callers get count=0 and
  // return immediately, avoiding double-payout.
  const { count } = await prisma.horseRace.updateMany({
    where: { id: raceId, phase: 'RACING' },
    data: { phase: 'FINISHED' },
  });
  if (count === 0) return;

  const race = await prisma.horseRace.findUniqueOrThrow({ where: { id: raceId }, include: raceInclude });
  const horseIds = race.entries.map((e) => e.horseId);
  const probs = winProbabilities(race.entries.map((e) => e.horse));
  const rng = mulberry32(race.seed);
  const finishOrder = drawFinishOrder(horseIds, probs, rng);
  const winnerId = finishOrder[0];

  const bets = await prisma.horseBet.findMany({ where: { raceId } });
  const winnerOwnerships = await prisma.horseOwnership.findMany({ where: { horseId: winnerId } });
  const winnerHorse = race.entries.find((e) => e.horseId === winnerId)!.horse;
  const totalInvested = winnerOwnerships.reduce((s, o) => s + o.staInvested, 0);
  const bonusPool = Math.round(winnerHorse.price * OWNER_BONUS_RATE);

  const ops = [
    ...finishOrder.map((horseId, i) =>
      prisma.horseRaceEntry.update({
        where: { raceId_horseId: { raceId, horseId } },
        data: { finishPosition: i + 1 },
      })
    ),
    ...bets.map((bet) =>
      prisma.horseBet.update({
        where: { id: bet.id },
        data: { status: bet.horseId === winnerId ? 'won' : 'lost' },
      })
    ),
    ...bets
      .filter((bet) => bet.horseId === winnerId)
      .map((bet) =>
        prisma.user.update({ where: { id: bet.userId }, data: { staBalance: { increment: bet.potentialWin } } })
      ),
    ...(totalInvested > 0
      ? winnerOwnerships
          .map((o) => ({ userId: o.userId, amount: Math.round(bonusPool * (o.staInvested / totalInvested)) }))
          .filter((p) => p.amount > 0)
          .map((p) => prisma.user.update({ where: { id: p.userId }, data: { staBalance: { increment: p.amount } } }))
      : []),
  ];
  if (ops.length > 0) await prisma.$transaction(ops);
}

export async function getCurrentRace(): Promise<CurrentRaceView> {
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

  return toView(race);
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. (No new tests here — this module is Prisma-dependent; see the "Global Constraints" note on why this codebase doesn't mock-test DB code. It's verified manually once Task 7's UI exists.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/horseRaceEngine.ts
git commit -m "feat: add lazy-tick horse race round engine"
```

---

### Task 4: `/api/horse-race/current` route

**Files:**
- Create: `src/app/api/horse-race/current/route.ts`

**Interfaces:**
- Consumes: `getCurrentRace` from `@/lib/horseRaceEngine` (Task 3).
- Produces: `GET /api/horse-race/current` returning the `CurrentRaceView` JSON shape — consumed by Task 7's client polling.

- [ ] **Step 1: Implement the route**

```ts
import { NextResponse } from 'next/server';
import { getCurrentRace } from '@/lib/horseRaceEngine';

export async function GET() {
  const race = await getCurrentRace();
  return NextResponse.json(race);
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual verification**

Run: `npm run dev` (in the background), then in another terminal: `curl http://localhost:3000/api/horse-race/current`
Expected (before Task 10 creates any horses): `{"error":"NOT_ENOUGH_HORSES"}` — this is correct, the pool is empty until admin adds horses in Task 10. Stop the dev server after checking.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/horse-race/current/route.ts
git commit -m "feat: add horse race current-state API route"
```

---

### Task 5: `placeHorseBet` server action

**Files:**
- Create: `src/actions/horseRace.ts`

**Interfaces:**
- Consumes: `authOptions` from `@/lib/auth`, `prisma` from `@/lib/prisma`.
- Produces: `async function placeHorseBet(raceId: string, horseId: string, stake: number): Promise<{ error: string } | {}>` — consumed by Task 7's betting form.

- [ ] **Step 1: Implement the action**

```ts
'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';

export async function placeHorseBet(raceId: string, horseId: string, stake: number) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.name) return { error: 'Giriş yapmalısın.' };
  if (!Number.isInteger(stake) || stake <= 0) return { error: 'Geçerli bir STA miktarı gir.' };

  const user = await prisma.user.findUnique({ where: { username: session.user.name } });
  if (!user) return { error: 'Kullanıcı bulunamadı.' };
  if (stake > user.staBalance) return { error: 'Yetersiz bakiye.' };

  const race = await prisma.horseRace.findUnique({ where: { id: raceId } });
  if (!race) return { error: 'Yarış bulunamadı.' };
  if (race.phase !== 'BETTING' || new Date() > race.bettingEndsAt) {
    return { error: 'Bu tur için bahis süresi doldu.' };
  }

  const entry = await prisma.horseRaceEntry.findUnique({ where: { raceId_horseId: { raceId, horseId } } });
  if (!entry) return { error: 'Geçersiz at seçimi, lütfen sayfayı yenile.' };

  const potentialWin = Math.round(stake * entry.oddsValue);

  try {
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { staBalance: { decrement: stake } } }),
      prisma.horseBet.create({
        data: {
          userId: user.id,
          raceId,
          horseId,
          stake,
          oddsValueAtBet: entry.oddsValue,
          potentialWin,
          status: 'pending',
        },
      }),
    ]);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return { error: 'Bu yarışa zaten bahis yaptın.' };
    }
    throw err;
  }

  revalidatePath('/at-yarisi');
  return {};
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/actions/horseRace.ts
git commit -m "feat: add placeHorseBet server action"
```

---

### Task 6: 2D race track animation (`src/components/RaceTrack.tsx`)

**Files:**
- Create: `src/components/RaceTrack.tsx`

**Interfaces:**
- Consumes: `winProbabilities`, `mulberry32`, `drawFinishOrder` from `@/lib/horseRace` (Task 2).
- Produces: `<RaceTrack entries={RaceEntryView[]} phase={'BETTING'|'RACING'|'FINISHED'} bettingEndsAt={string} raceEndsAt={string} seed={number} />` — consumed by Task 7's page. `RaceEntryView` is imported from `@/lib/horseRaceEngine` (Task 3) as a type-only import (safe: it has no Prisma value import, only a `type` re-export chain — confirm this compiles as a client component in Step 2 below).

- [ ] **Step 1: Implement the component**

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { winProbabilities, mulberry32, drawFinishOrder } from '@/lib/horseRace';
import type { RaceEntryView } from '@/lib/horseRaceEngine';

export default function RaceTrack({
  entries,
  phase,
  bettingEndsAt,
  raceEndsAt,
  seed,
}: {
  entries: RaceEntryView[];
  phase: 'BETTING' | 'RACING' | 'FINISHED';
  bettingEndsAt: string;
  raceEndsAt: string;
  seed: number;
}) {
  const [positions, setPositions] = useState<Record<string, number>>({});
  const frameRef = useRef<number | null>(null);

  // The finish order is fully determined by (entries' ratings, seed) — the
  // exact same pure functions the server uses at settlement (Task 3). This
  // lets every viewer's browser independently compute the same race outcome
  // without any realtime push channel.
  const finishOrder = drawFinishOrder(
    entries.map((e) => e.horseId),
    winProbabilities(entries),
    mulberry32(seed)
  );
  const rankByHorseId = new Map(finishOrder.map((id, i) => [id, i]));

  useEffect(() => {
    if (phase !== 'RACING') {
      if (phase === 'FINISHED') {
        const finished: Record<string, number> = {};
        for (const e of entries) finished[e.horseId] = rankByHorseId.get(e.horseId) === 0 ? 1 : 0.95;
        setPositions(finished);
      } else {
        setPositions({});
      }
      return;
    }

    const start = new Date(bettingEndsAt).getTime();
    const end = new Date(raceEndsAt).getTime();
    const totalMs = end - start;
    const rng = mulberry32(seed + 1000); // separate stream from the outcome draw, used only for visual jitter

    // Give each horse a fixed jitter frequency/phase so its wobble looks
    // organic but stays stable frame to frame (not re-randomized every tick).
    const jitterParams = entries.map(() => ({ freq: 4 + rng() * 4, phase: rng() * Math.PI * 2 }));

    function tick() {
      const now = Date.now();
      const t = Math.max(0, Math.min(1, (now - start) / totalMs));
      const next: Record<string, number> = {};
      entries.forEach((e, i) => {
        const rank = rankByHorseId.get(e.horseId) ?? entries.length - 1;
        const rankPenalty = rank * 0.025; // winner (rank 0) has no penalty, each place behind trails a bit more
        const { freq, phase: ph } = jitterParams[i];
        const jitter = 0.015 * Math.sin(freq * t * Math.PI * 2 + ph);
        next[e.horseId] = Math.max(0, Math.min(1, t * (1 - rankPenalty) + jitter));
      });
      setPositions(next);
      if (t < 1) frameRef.current = requestAnimationFrame(tick);
    }
    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, bettingEndsAt, raceEndsAt, seed]);

  return (
    <div className="flex flex-col gap-1 rounded-xl border border-line bg-pitch-night-raised p-3">
      {entries.map((e) => (
        <div key={e.horseId} className="relative h-8 rounded-lg bg-pitch-night">
          <div className="absolute right-1 top-1/2 h-px w-2 -translate-y-1/2 bg-gold" />
          <div
            className="absolute top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-xs font-bold text-pitch-night transition-[left] duration-100 ease-linear"
            style={{ left: `calc(${(positions[e.horseId] ?? 0) * 92}% )`, backgroundColor: e.color }}
          >
            {e.number ?? ''}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. If `RaceEntryView` fails to import as a type into a client component, switch the import to `import type { RaceEntryView } from '@/lib/horseRaceEngine';` (already written that way above) — this is safe because TypeScript erases type-only imports, so no server-only Prisma code is bundled into the client.

- [ ] **Step 3: Commit**

```bash
git add src/components/RaceTrack.tsx
git commit -m "feat: add 2D race track animation component"
```

---

### Task 7: `/at-yarisi` page (betting + live view)

**Files:**
- Create: `src/app/at-yarisi/page.tsx`

**Interfaces:**
- Consumes: `RaceTrack` (Task 6), `placeHorseBet` (Task 5), `RaceEntryView`/`CurrentRaceView` types from `@/lib/horseRaceEngine` (Task 3, type-only import).
- Produces: the `/at-yarisi` route — consumed by Task 12's nav wiring.

- [ ] **Step 1: Implement the page**

```tsx
'use client';

import { useEffect, useState } from 'react';
import RaceTrack from '@/components/RaceTrack';
import { placeHorseBet } from '@/actions/horseRace';
import type { CurrentRaceView } from '@/lib/horseRaceEngine';

const POLL_MS = 2000;

export default function HorseRacePage() {
  const [race, setRace] = useState<CurrentRaceView | null>(null);
  const [selectedHorseId, setSelectedHorseId] = useState<string | null>(null);
  const [stake, setStake] = useState(100);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      const res = await fetch('/api/horse-race/current');
      const data: CurrentRaceView = await res.json();
      if (!cancelled) setRace(data);
    }
    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (!race) {
    return <main className="mx-auto max-w-lg px-4 py-10 text-center text-sm text-text-muted">Yükleniyor...</main>;
  }
  if ('error' in race) {
    return (
      <main className="mx-auto max-w-lg px-4 py-10 text-center text-sm text-text-muted">
        Yarış havuzunda yeterli at yok (en az 7 aktif at gerekli). Admin panelinden at ekleyebilirsin.
      </main>
    );
  }

  async function submit() {
    if (!selectedHorseId || 'error' in race!) return;
    setMessage(null);
    setSubmitting(true);
    const result = await placeHorseBet(race!.id, selectedHorseId, stake);
    setSubmitting(false);
    setMessage(result.error ?? 'Bahis alındı, bol şans!');
  }

  const phaseLabel = { BETTING: 'Bahisler Açık', RACING: 'CANLI', FINISHED: 'Sonuç' }[race.phase];

  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      <h1 className="mb-1 font-display text-2xl tracking-wide text-text-primary">🐎 At Yarışı</h1>
      <p className="mb-4 text-sm text-text-muted">
        <span className={race.phase === 'RACING' ? 'live-pulse text-ferrari-red' : 'text-gold'}>{phaseLabel}</span>
      </p>

      <RaceTrack
        entries={race.entries}
        phase={race.phase}
        bettingEndsAt={race.bettingEndsAt}
        raceEndsAt={race.raceEndsAt}
        seed={race.seed}
      />

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
    </main>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual verification (after Task 10 seeds at least 7 horses)**

Run: `npm run dev`, open the Browser pane at `http://localhost:3000/at-yarisi`. Confirm: the page shows "yeterli at yok" before horses exist; after Task 10 adds 7+ horses, confirm a betting screen appears, a horse can be selected, a stake submitted (requires being logged in — use the seeded non-admin test account if one exists, otherwise register one), and that after ~30s the track animates and a winner is announced.

- [ ] **Step 4: Commit**

```bash
git add src/app/at-yarisi/page.tsx
git commit -m "feat: add /at-yarisi betting and live race page"
```

---

### Task 8: `buyHorseShare` server action

**Files:**
- Create: `src/actions/horseShop.ts`

**Interfaces:**
- Consumes: `authOptions` from `@/lib/auth`, `prisma` from `@/lib/prisma`.
- Produces: `async function buyHorseShare(horseId: string, amount: number): Promise<{ error: string } | {}>` — consumed by Task 9's shop page.

- [ ] **Step 1: Implement the action**

```ts
'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function buyHorseShare(horseId: string, amount: number) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.name) return { error: 'Giriş yapmalısın.' };
  if (!Number.isInteger(amount) || amount <= 0) return { error: 'Geçerli bir STA miktarı gir.' };

  const user = await prisma.user.findUnique({ where: { username: session.user.name } });
  if (!user) return { error: 'Kullanıcı bulunamadı.' };

  const horse = await prisma.horse.findUnique({ where: { id: horseId }, include: { ownerships: true } });
  if (!horse) return { error: 'At bulunamadı.' };

  const totalInvested = horse.ownerships.reduce((s, o) => s + o.staInvested, 0);
  const remaining = horse.price - totalInvested;
  if (remaining <= 0) return { error: 'Bu at tamamen sahiplenildi.' };

  const actualAmount = Math.min(amount, remaining);
  if (actualAmount > user.staBalance) return { error: 'Yetersiz bakiye.' };

  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { staBalance: { decrement: actualAmount } } }),
    prisma.horseOwnership.upsert({
      where: { horseId_userId: { horseId, userId: user.id } },
      create: { horseId, userId: user.id, staInvested: actualAmount },
      update: { staInvested: { increment: actualAmount } },
    }),
  ]);

  revalidatePath('/at-yarisi/magaza');
  return {};
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/actions/horseShop.ts
git commit -m "feat: add buyHorseShare server action"
```

---

### Task 9: `/at-yarisi/magaza` ownership shop page

**Files:**
- Create: `src/app/at-yarisi/magaza/page.tsx` (server component, fetches data)
- Create: `src/app/at-yarisi/magaza/BuyShareForm.tsx` (client component, the buy form)

**Interfaces:**
- Consumes: `buyHorseShare` from `@/actions/horseShop` (Task 8), `prisma` from `@/lib/prisma`, `getServerSession`/`authOptions` from `next-auth`/`@/lib/auth`.
- Produces: the `/at-yarisi/magaza` route — consumed by Task 12's nav wiring.

- [ ] **Step 1: Implement `BuyShareForm.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { buyHorseShare } from '@/actions/horseShop';

export default function BuyShareForm({ horseId }: { horseId: string }) {
  const [amount, setAmount] = useState(100);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setMessage(null);
    setSubmitting(true);
    const result = await buyHorseShare(horseId, amount);
    setSubmitting(false);
    setMessage(result.error ?? 'Pay alındı!');
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      <input
        type="number"
        min={1}
        value={amount}
        onChange={(e) => setAmount(parseInt(e.target.value, 10) || 0)}
        className="w-24 rounded-lg border border-line bg-pitch-night px-2 py-1 text-sm text-text-primary"
      />
      <button
        onClick={submit}
        disabled={submitting || amount <= 0}
        className="pop-interactive flex-1 rounded-full bg-gold px-3 py-1.5 text-xs font-semibold text-pitch-night disabled:opacity-40"
      >
        {submitting ? 'Gönderiliyor...' : 'Pay Al'}
      </button>
      {message && <span className="text-xs text-text-muted">{message}</span>}
    </div>
  );
}
```

- [ ] **Step 2: Implement `page.tsx`**

```tsx
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import BuyShareForm from './BuyShareForm';

export default async function HorseShopPage() {
  const session = await getServerSession(authOptions);
  const horses = await prisma.horse.findMany({
    where: { active: true },
    include: { ownerships: true },
    orderBy: { name: 'asc' },
  });

  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      <h1 className="mb-1 font-display text-2xl tracking-wide text-text-primary">🐎 At Ortaklığı Mağazası</h1>
      <p className="mb-4 text-sm text-text-muted">
        Bir ata pay al: at yarış kazandığında, payın oranında pasif bir STA geliri kazanırsın. Bu gelir liderlik
        tablosundaki puanına dahil değildir, sadece bakiyeni artırır.
      </p>

      <div className="flex flex-col gap-3">
        {horses.map((horse) => {
          const totalInvested = horse.ownerships.reduce((s, o) => s + o.staInvested, 0);
          const remaining = horse.price - totalInvested;
          const myShare = session?.user?.name
            ? horse.ownerships.find((o) => o.userId === session.user!.name)?.staInvested ?? 0
            : 0;
          const soldOut = remaining <= 0;

          return (
            <div key={horse.id} className="rounded-xl border border-line bg-pitch-night-raised p-4">
              <div className="mb-1 flex items-center justify-between">
                <span className="font-semibold text-text-primary">
                  #{horse.number ?? '?'} {horse.name}
                </span>
                <span className="text-sm text-gold">{horse.price} STA</span>
              </div>
              <div className="mb-1 h-1.5 overflow-hidden rounded-full bg-line">
                <div
                  className="h-full bg-gold"
                  style={{ width: `${Math.min(100, (totalInvested / horse.price) * 100)}%` }}
                />
              </div>
              <p className="text-xs text-text-muted">
                {totalInvested} / {horse.price} STA yatırıldı{myShare > 0 ? ` · senin payın: ${myShare} STA` : ''}
              </p>
              {soldOut ? (
                <p className="mt-2 rounded-full bg-line px-3 py-1 text-center text-xs font-semibold text-text-muted">
                  Tamamen Sahiplenildi
                </p>
              ) : (
                <BuyShareForm horseId={horse.id} />
              )}
            </div>
          );
        })}
        {horses.length === 0 && <p className="text-sm text-text-muted">Henüz at yok.</p>}
      </div>
    </main>
  );
}
```

Note: `session.user!.name` is the username string (this project's NextAuth `session.user.name` holds the username, matching the pattern already used in `src/actions/bets.ts`'s `session.user.name` lookup) — it is being compared against `HorseOwnership.userId`, which is a cuid, **not** the username. Fix before shipping: look up the actual `User.id` first.

- [ ] **Step 3: Fix the userId lookup bug just noted**

Replace the `myShare` line in `page.tsx` with:

```tsx
  const currentUser = session?.user?.name
    ? await prisma.user.findUnique({ where: { username: session.user.name }, select: { id: true } })
    : null;
```

placed right after the `const session = ...` line, and change the `myShare` computation inside the `.map()` to:

```tsx
          const myShare = currentUser
            ? horse.ownerships.find((o) => o.userId === currentUser.id)?.staInvested ?? 0
            : 0;
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/at-yarisi/magaza/page.tsx src/app/at-yarisi/magaza/BuyShareForm.tsx
git commit -m "feat: add horse ownership shop page"
```

---

### Task 10: Admin horse CRUD (`src/actions/horses.ts` + `src/app/admin/horses/page.tsx`)

**Files:**
- Create: `src/actions/horses.ts`
- Create: `src/app/admin/horses/page.tsx`

**Interfaces:**
- Consumes: `requireAdmin` from `@/lib/auth`, `prisma` from `@/lib/prisma`.
- Produces: `createHorse`, `updateHorse`, `setHorseActive` actions and the `/admin/horses` route — this is where the pool that Task 7/9 depend on gets populated. Also consumed by Task 12's nav wiring.

- [ ] **Step 1: Implement `src/actions/horses.ts`**

```ts
'use server';

import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function createHorse(data: {
  name: string;
  number: number | null;
  color: string;
  speedRating: number;
  formRating: number;
  luckRating: number;
  price: number;
}) {
  const authError = await requireAdmin();
  if (authError) return authError;
  if (!data.name || data.name.trim().length < 2) return { error: 'At adı en az 2 karakter olmalı.' };

  await prisma.horse.create({ data: { ...data, name: data.name.trim() } });
  revalidatePath('/admin/horses');
  revalidatePath('/at-yarisi/magaza');
  return {};
}

export async function updateHorse(
  id: string,
  data: {
    name: string;
    number: number | null;
    color: string;
    speedRating: number;
    formRating: number;
    luckRating: number;
    price: number;
  }
) {
  const authError = await requireAdmin();
  if (authError) return authError;
  if (!data.name || data.name.trim().length < 2) return { error: 'At adı en az 2 karakter olmalı.' };

  await prisma.horse.update({ where: { id }, data: { ...data, name: data.name.trim() } });
  revalidatePath('/admin/horses');
  revalidatePath('/at-yarisi/magaza');
  return {};
}

export async function setHorseActive(id: string, active: boolean) {
  const authError = await requireAdmin();
  if (authError) return authError;

  await prisma.horse.update({ where: { id }, data: { active } });
  revalidatePath('/admin/horses');
  revalidatePath('/at-yarisi/magaza');
  return {};
}
```

Note: real deletion is intentionally not offered — `setHorseActive(id, false)` ("emekli et") is the only removal path, because past `HorseRaceEntry`/`HorseBet`/`HorseOwnership` rows reference the horse and must keep working, matching the same "free the players instead of deleting" precedent already used in `deleteTeam` (`src/actions/teams.ts`).

- [ ] **Step 2: Implement `src/app/admin/horses/page.tsx`**

```tsx
import { prisma } from '@/lib/prisma';
import { createHorse, updateHorse, setHorseActive } from '@/actions/horses';

export default async function AdminHorsesPage() {
  const horses = await prisma.horse.findMany({ orderBy: { name: 'asc' } });
  const activeCount = horses.filter((h) => h.active).length;

  return (
    <div>
      <h2 className="mb-1 font-display text-lg tracking-wide text-text-primary">At Yarışı Havuzu</h2>
      {activeCount < 7 && (
        <p className="mb-4 rounded-lg bg-ferrari-red/10 p-2 text-sm text-ferrari-red">
          Aktif at sayısı {activeCount}/7 — yarış turu başlayamaz, en az 7 aktif at gerekli.
        </p>
      )}

      <form
        action={async (formData) => {
          'use server';
          const number = formData.get('number') as string;
          await createHorse({
            name: formData.get('name') as string,
            number: number ? parseInt(number, 10) : null,
            color: (formData.get('color') as string) || '#e8b923',
            speedRating: parseInt(formData.get('speedRating') as string, 10),
            formRating: parseInt(formData.get('formRating') as string, 10),
            luckRating: parseInt(formData.get('luckRating') as string, 10),
            price: parseInt(formData.get('price') as string, 10),
          });
        }}
        className="mb-6 flex flex-col gap-2 rounded-xl border border-line bg-pitch-night-raised p-4"
      >
        <h3 className="font-semibold text-text-primary">Yeni At</h3>
        <div className="flex gap-2">
          <input name="name" placeholder="At adı" className="flex-1 rounded-lg border border-line bg-pitch-night px-3 py-2 text-sm text-text-primary" required />
          <input name="number" placeholder="No" className="w-16 rounded-lg border border-line bg-pitch-night px-3 py-2 text-sm text-text-primary" />
          <input name="color" type="color" defaultValue="#e8b923" className="h-10 w-12 rounded-lg border border-line bg-pitch-night" />
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <label className="flex flex-col gap-0.5 text-text-muted">
            Hız (1-10)
            <input name="speedRating" type="number" min={1} max={10} defaultValue={5} className="rounded-lg border border-line bg-pitch-night px-2 py-1 text-text-primary" required />
          </label>
          <label className="flex flex-col gap-0.5 text-text-muted">
            Form (1-10)
            <input name="formRating" type="number" min={1} max={10} defaultValue={5} className="rounded-lg border border-line bg-pitch-night px-2 py-1 text-text-primary" required />
          </label>
          <label className="flex flex-col gap-0.5 text-text-muted">
            Şans (1-10)
            <input name="luckRating" type="number" min={1} max={10} defaultValue={5} className="rounded-lg border border-line bg-pitch-night px-2 py-1 text-text-primary" required />
          </label>
        </div>
        <label className="flex flex-col gap-0.5 text-xs text-text-muted">
          Fiyat (STA, %100 sahiplik değeri)
          <input name="price" type="number" min={1} defaultValue={5000} className="w-40 rounded-lg border border-line bg-pitch-night px-2 py-1 text-text-primary" required />
        </label>
        <button className="pop-interactive self-start rounded-full bg-gold px-4 py-2 text-sm font-semibold text-pitch-night">
          Ekle
        </button>
      </form>

      <div className="flex flex-col gap-3">
        {horses.map((horse) => (
          <form
            key={horse.id}
            action={async (formData) => {
              'use server';
              const number = formData.get('number') as string;
              await updateHorse(horse.id, {
                name: formData.get('name') as string,
                number: number ? parseInt(number, 10) : null,
                color: formData.get('color') as string,
                speedRating: parseInt(formData.get('speedRating') as string, 10),
                formRating: parseInt(formData.get('formRating') as string, 10),
                luckRating: parseInt(formData.get('luckRating') as string, 10),
                price: parseInt(formData.get('price') as string, 10),
              });
            }}
            className="flex flex-col gap-2 rounded-xl border border-line bg-pitch-night-raised p-4"
          >
            <div className="flex gap-2">
              <input name="name" defaultValue={horse.name} className="flex-1 rounded-lg border border-line bg-pitch-night px-2 py-1 text-sm font-semibold text-text-primary" />
              <input name="number" defaultValue={horse.number ?? ''} className="w-16 rounded-lg border border-line bg-pitch-night px-2 py-1 text-sm text-text-primary" />
              <input name="color" type="color" defaultValue={horse.color} className="h-9 w-11 rounded-lg border border-line bg-pitch-night" />
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <label className="flex flex-col gap-0.5 text-text-muted">
                Hız
                <input name="speedRating" type="number" min={1} max={10} defaultValue={horse.speedRating} className="rounded-lg border border-line bg-pitch-night px-2 py-1 text-text-primary" />
              </label>
              <label className="flex flex-col gap-0.5 text-text-muted">
                Form
                <input name="formRating" type="number" min={1} max={10} defaultValue={horse.formRating} className="rounded-lg border border-line bg-pitch-night px-2 py-1 text-text-primary" />
              </label>
              <label className="flex flex-col gap-0.5 text-text-muted">
                Şans
                <input name="luckRating" type="number" min={1} max={10} defaultValue={horse.luckRating} className="rounded-lg border border-line bg-pitch-night px-2 py-1 text-text-primary" />
              </label>
            </div>
            <label className="flex flex-col gap-0.5 text-xs text-text-muted">
              Fiyat (STA)
              <input name="price" type="number" min={1} defaultValue={horse.price} className="w-40 rounded-lg border border-line bg-pitch-night px-2 py-1 text-text-primary" />
            </label>
            <div className="flex gap-2">
              <button className="pop-interactive rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-text-primary">Kaydet</button>
            </div>
          </form>
        ))}
        {horses.map((horse) => (
          <form
            key={`toggle-${horse.id}`}
            action={async () => {
              'use server';
              await setHorseActive(horse.id, !horse.active);
            }}
          >
            <button
              className={`pop-interactive w-full rounded-full border px-3 py-1.5 text-xs font-semibold ${
                horse.active ? 'border-ferrari-red text-ferrari-red' : 'border-line text-text-muted'
              }`}
            >
              {horse.name}: {horse.active ? 'Emekli Et' : 'Yeniden Aktif Et'}
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}
```

Note: the active/inactive toggle is rendered as a second, separate list at the bottom rather than merged into each horse's edit form, purely because a `<button>` cannot be nested inside another `<form>` — two sibling `<form>`s per horse (one for the profile edit, one for the toggle) keeps each server action's `formData` unambiguous.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Seed at least 7 horses manually for testing**

Run: `npm run dev`, log in as the seeded admin (`admin`/`admin123`), open `http://localhost:3000/admin/horses`, and add 7 horses through the form (any names/numbers/ratings/prices — this is throwaway test data, not something to commit). Confirm the "yeterli at yok" warning disappears once the 7th is added, and that `/at-yarisi` (Task 7) and `/at-yarisi/magaza` (Task 9) now show real data.

- [ ] **Step 5: Commit**

```bash
git add src/actions/horses.ts src/app/admin/horses/page.tsx
git commit -m "feat: add admin horse pool CRUD"
```

---

### Task 11: Merge horse bets into the leaderboard score

**Files:**
- Modify: `src/lib/score.ts` — no signature change, just doc-comment clarification (see Step 1)
- Modify: `src/app/page.tsx`
- Modify: `src/app/api/leaderboard/route.ts`
- Modify: `src/app/leaderboard/page.tsx`

**Interfaces:**
- Consumes: `computeUserScore` from `@/lib/score` (existing, unchanged signature — it already accepts any `{status, stake, potentialWin}[]`, which is exactly the shape both `Bet` and `HorseBet` rows share).
- Produces: nothing new — every call site now passes a combined array.

- [ ] **Step 1: Add a clarifying comment to `src/lib/score.ts`**

At the top of `src/lib/score.ts`, above the `ScoredBet` type, add:

```ts
// Deliberately source-agnostic: both football Bet rows and HorseBet rows
// share this exact shape, so callers merge both arrays before calling
// computeUserScore — one net "puan" across both games. Horse ownership
// bonus payouts are NOT bet rows and must never be passed in here.
```

- [ ] **Step 2: Update `src/app/page.tsx`'s home-page leaderboard query**

Find this block:

```tsx
  const usersForScore = await prisma.user.findMany({
    where: { role: 'user' },
    select: { username: true, bets: { select: { status: true, stake: true, potentialWin: true } } },
  });
  const topUsers = usersForScore
    .map((u) => ({ username: u.username, score: computeUserScore(u.bets) }))
    .sort((a, b) => b.score.net - a.score.net)
    .slice(0, 3);
```

Replace with:

```tsx
  const usersForScore = await prisma.user.findMany({
    where: { role: 'user' },
    select: {
      username: true,
      bets: { select: { status: true, stake: true, potentialWin: true } },
      horseBets: { select: { status: true, stake: true, potentialWin: true } },
    },
  });
  const topUsers = usersForScore
    .map((u) => ({ username: u.username, score: computeUserScore([...u.bets, ...u.horseBets]) }))
    .sort((a, b) => b.score.net - a.score.net)
    .slice(0, 3);
```

- [ ] **Step 3: Update `src/app/api/leaderboard/route.ts`**

Find:

```ts
export async function GET() {
  const users = await prisma.user.findMany({
    where: { role: 'user' },
    include: { bets: true },
  });

  const ranked = users
    .map((u) => {
      const total = u.bets.length;
      const won = u.bets.filter((b) => b.status === 'won').length;
      const winRate = total > 0 ? Math.round((won / total) * 100) : 0;
      return { username: u.username, staBalance: u.staBalance, total, winRate, score: computeUserScore(u.bets) };
    })
    .sort((a, b) => b.score.net - a.score.net);

  return NextResponse.json(ranked);
}
```

Replace with:

```ts
export async function GET() {
  const users = await prisma.user.findMany({
    where: { role: 'user' },
    include: { bets: true, horseBets: true },
  });

  const ranked = users
    .map((u) => {
      const allBets = [...u.bets, ...u.horseBets];
      const total = allBets.length;
      const won = allBets.filter((b) => b.status === 'won').length;
      const winRate = total > 0 ? Math.round((won / total) * 100) : 0;
      return { username: u.username, staBalance: u.staBalance, total, winRate, score: computeUserScore(allBets) };
    })
    .sort((a, b) => b.score.net - a.score.net);

  return NextResponse.json(ranked);
}
```

- [ ] **Step 4: Apply the identical change to `src/app/leaderboard/page.tsx`**

`src/app/leaderboard/page.tsx` has the same `prisma.user.findMany({ where: { role: 'user' }, include: { bets: true } })` → `.map()` → `computeUserScore(u.bets)` shape as the route above (it's the initial server-rendered `ranked` prop passed into `<LeaderboardList initial={ranked} />`). Apply the exact same three edits: add `horseBets: true` to the `include`, build `allBets = [...u.bets, ...u.horseBets]` inside the `.map()`, and use `allBets` for `total`/`won`/`winRate`/`computeUserScore(...)` in place of `u.bets`.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass, including the existing `tests/score.test.ts` (its tests call `computeUserScore` directly with plain arrays, unaffected by these call-site changes).

- [ ] **Step 7: Commit**

```bash
git add src/lib/score.ts src/app/page.tsx src/app/api/leaderboard/route.ts src/app/leaderboard/page.tsx
git commit -m "feat: merge horse race bets into the leaderboard score"
```

---

### Task 12: Nav wiring

**Files:**
- Modify: `src/components/FullscreenNav.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new — leaf change.

- [ ] **Step 1: Add `/at-yarisi` links to both nav states**

In `src/components/FullscreenNav.tsx`, find the `links` construction:

```tsx
  const links = user
    ? [
        ...(user.isAdmin ? [{ href: '/admin', label: 'Admin' }] : []),
        { href: '/', label: 'Ana Sayfa' },
        { href: '/players', label: 'Oyuncular' },
        { href: '/kadro-plani', label: 'Kadro Planla' },
        { href: '/bets', label: 'Kuponlarım' },
        { href: '/leaderboard', label: 'Liderlik' },
      ]
    : [
        { href: '/', label: 'Ana Sayfa' },
        { href: '/players', label: 'Oyuncular' },
        { href: '/login', label: 'Giriş' },
        { href: '/register', label: 'Kayıt Ol' },
      ];
```

Replace with:

```tsx
  const links = user
    ? [
        ...(user.isAdmin ? [{ href: '/admin', label: 'Admin' }] : []),
        { href: '/', label: 'Ana Sayfa' },
        { href: '/players', label: 'Oyuncular' },
        { href: '/kadro-plani', label: 'Kadro Planla' },
        { href: '/at-yarisi', label: 'At Yarışı' },
        { href: '/at-yarisi/magaza', label: 'At Mağazası' },
        { href: '/bets', label: 'Kuponlarım' },
        { href: '/leaderboard', label: 'Liderlik' },
      ]
    : [
        { href: '/', label: 'Ana Sayfa' },
        { href: '/players', label: 'Oyuncular' },
        { href: '/at-yarisi', label: 'At Yarışı' },
        { href: '/login', label: 'Giriş' },
        { href: '/register', label: 'Kayıt Ol' },
      ];
```

Logged-out visitors get `/at-yarisi` (viewing/spectating the live race is open to everyone, same as `/matches/[id]`) but not `/at-yarisi/magaza` (buying ownership shares requires an account, so there's no reason to surface it before login) — matching how `/bets` and `/leaderboard` are already logged-in-only entries above.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual verification**

Run: `npm run dev`, open the Browser pane, click the hamburger menu, confirm "At Yarışı" and "At Mağazası" (when logged in) appear and navigate correctly.

- [ ] **Step 4: Commit**

```bash
git add src/components/FullscreenNav.tsx
git commit -m "feat: add horse racing links to the site nav"
```

---

## Plan Self-Review Notes

- **Spec coverage:** data model (Task 1), algorithm (Task 2), lazy-tick engine (Task 3), API (Task 4), betting action (Task 5), 2D animation (Task 6), betting page (Task 7), ownership purchase (Task 8), shop page (Task 9), admin CRUD (Task 10), leaderboard integration (Task 11), nav (Task 12) — every section of the design spec maps to at least one task.
- **Placeholder scan:** none found — every step ships complete code. The one deliberately-flagged bug in Task 9 (Step 2's `session.user!.name` vs `userId`) is fixed in-place by Task 9 Step 3 rather than left dangling, since it's a same-task, same-file follow-up the implementer would hit immediately on type-check/testing.
- **Type consistency:** `RaceEntryView`/`CurrentRaceView` (Task 3) are consumed identically by Task 4 (API), Task 6 (`RaceTrack` props), and Task 7 (page state) — field names (`horseId`, `horseName`, `number`, `color`, `speedRating`, `formRating`, `luckRating`, `oddsValue`, `finishPosition`) match across all three. `placeHorseBet(raceId, horseId, stake)` (Task 5) matches its Task 7 call site. `buyHorseShare(horseId, amount)` (Task 8) matches its Task 9 call site. `createHorse`/`updateHorse` (Task 10) take the identical field set the admin form submits.
- **Owner-bonus/puan separation**, called out as a hard constraint in the Global Constraints section, is upheld: Task 3's `settleRace` credits `staBalance` directly for owner bonuses without ever creating a `Bet`-shaped row, and Task 11 only ever merges `bets`/`horseBets` (never ownership rows) into `computeUserScore`.
