# Hali Saha İddaa Sitesi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-first fun-money betting site for a friend group's hali saha matches — admin enters teams/rosters/match time, system auto-computes odds, users place one combined bet slip per match with STA virtual currency, admin settles results, leaderboard ranks by balance.

**Architecture:** Single Next.js (App Router, TypeScript) project. Prisma ORM over SQLite for local dev/test (schema uses standard SQL types so switching the datasource to Postgres/Neon for production is a one-line provider change — documented in README, not part of this plan since it requires the user's own Neon account). NextAuth credentials provider for auth. Server Actions for all mutations (no separate REST layer). Pure, dependency-free modules in `src/lib/` hold all business logic (odds math, bet evaluation, lock-time check) so they're unit-testable without a database.

**Tech Stack:** Next.js 14 (App Router) + TypeScript, Prisma + SQLite (dev), NextAuth.js (credentials), Tailwind CSS, Vitest for unit tests, bcryptjs for password hashing.

## Global Constraints

- One bet (`Bet` row) per `(userId, matchId)` pair — enforced by a DB unique constraint, never just app logic.
- Odds are computed once when a match is created and never recalculated afterward.
- No bet can be placed once `Match.kickoffTime <= now` — checked in the server action, not just hidden in the UI.
- Starting STA balance for new registrations: `1000`.
- No real-money integration anywhere in the code.
- All user-facing text is in Turkish.
- Mobile-first layout: every page must be usable at 375px width without horizontal scroll.

---

## File Structure

```
iddaa-saha/
  package.json, tsconfig.json, next.config.js, tailwind.config.ts, postcss.config.js
  .env.example
  prisma/
    schema.prisma
    seed.ts
  src/
    lib/
      prisma.ts            # Prisma client singleton
      auth.ts              # NextAuth config + getServerAuthSession helper
      odds.ts              # pure Poisson-based odds math
      matchLock.ts         # pure lock-time check
      betting.ts           # pure combined-bet evaluation logic
    actions/
      auth.ts              # registerUser server action
      teams.ts             # createTeam, addPlayer, removePlayer
      matches.ts           # createMatch (computes+stores odds)
      bets.ts              # placeBet
      settlement.ts        # settleMatch (evaluates all bets)
      users.ts             # adjustBalance
    middleware.ts           # admin route guard
    app/
      layout.tsx, page.tsx, globals.css
      register/page.tsx
      login/page.tsx
      leaderboard/page.tsx
      matches/[id]/page.tsx
      admin/
        layout.tsx
        page.tsx
        teams/page.tsx
        matches/new/page.tsx
        matches/[id]/page.tsx
        users/page.tsx
      api/auth/[...nextauth]/route.ts
  tests/
    odds.test.ts
    matchLock.test.ts
    betting.test.ts
```

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.js`, `tailwind.config.ts`, `postcss.config.js`, `src/app/globals.css`, `src/app/layout.tsx`, `src/app/page.tsx`, `.gitignore`, `.env.example`, `vitest.config.ts`

**Interfaces:**
- Produces: a runnable `npm run dev` Next.js app and a runnable `npm test` (Vitest) command that later tasks add tests to.

- [ ] **Step 1: Scaffold Next.js app**

```bash
cd "C:\Users\muham\Documents\Projects\iddaa-saha"
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --no-turbopack
```
When prompted, accept defaults (this directory is empty aside from `docs/` and `.git/`, so it's safe).

- [ ] **Step 2: Install runtime dependencies**

```bash
npm install prisma @prisma/client next-auth bcryptjs
npm install -D vitest tsx
```

- [ ] **Step 3: Add `.env.example`**

```
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="change-me-in-production"
NEXTAUTH_URL="http://localhost:3000"
```

Copy it to a real `.env`:

```bash
cp .env.example .env
```

- [ ] **Step 4: Add Vitest config**

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
```

Add to `package.json` scripts:
```json
"test": "vitest run"
```

- [ ] **Step 5: Verify dev server boots**

Run: `npm run dev` then in a second terminal `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000`
Expected: `200`. Stop the dev server after confirming.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js project with Tailwind, Prisma, NextAuth, Vitest"
```

---

### Task 2: Prisma Schema, Migration, Seed

**Files:**
- Create: `prisma/schema.prisma`, `prisma/seed.ts`

**Interfaces:**
- Produces: Prisma Client models `User`, `Team`, `Player`, `Match`, `PlayerGoal`, `Odds`, `Bet`, `BetSelection` — every later task's `lib/`, `actions/`, and `app/` code imports these exact model names and fields.

- [ ] **Step 1: Write `prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model User {
  id           String  @id @default(cuid())
  username     String  @unique
  passwordHash String
  staBalance   Int     @default(1000)
  role         String  @default("user") // "user" | "admin"
  createdAt    DateTime @default(now())
  bets         Bet[]
}

model Team {
  id      String   @id @default(cuid())
  name    String
  players Player[]
  homeMatches Match[] @relation("HomeTeam")
  awayMatches Match[] @relation("AwayTeam")
}

model Player {
  id      String @id @default(cuid())
  teamId  String
  team    Team   @relation(fields: [teamId], references: [id])
  name    String
  number  Int?
  playerGoals PlayerGoal[]
}

model Match {
  id             String   @id @default(cuid())
  homeTeamId     String
  awayTeamId     String
  homeTeam       Team     @relation("HomeTeam", fields: [homeTeamId], references: [id])
  awayTeam       Team     @relation("AwayTeam", fields: [awayTeamId], references: [id])
  kickoffTime    DateTime
  status         String   @default("upcoming") // "upcoming" | "locked" | "finished"
  finalHomeScore Int?
  finalAwayScore Int?
  odds           Odds[]
  bets           Bet[]
  playerGoals    PlayerGoal[]
}

model PlayerGoal {
  id        String @id @default(cuid())
  matchId   String
  match     Match  @relation(fields: [matchId], references: [id])
  playerId  String
  player    Player @relation(fields: [playerId], references: [id])
  goalCount Int

  @@unique([matchId, playerId])
}

model Odds {
  id            String @id @default(cuid())
  matchId       String
  match         Match  @relation(fields: [matchId], references: [id])
  market        String // "1X2" | "SCORE" | "OU_GOALS" | "PLAYER_GOALS"
  selectionKey  String // e.g. "1", "2-1", "OVER_4.5", "player:<id>:2+"
  oddsValue     Float

  @@unique([matchId, market, selectionKey])
}

model Bet {
  id            String   @id @default(cuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id])
  matchId       String
  match         Match    @relation(fields: [matchId], references: [id])
  stake         Int
  totalOdds     Float
  potentialWin  Int
  status        String   @default("pending") // "pending" | "won" | "lost"
  createdAt     DateTime @default(now())
  selections    BetSelection[]

  @@unique([userId, matchId])
}

model BetSelection {
  id             String @id @default(cuid())
  betId          String
  bet            Bet    @relation(fields: [betId], references: [id])
  market         String
  selectionKey   String
  oddsValueAtBet Float
}
```

- [ ] **Step 2: Run initial migration**

```bash
npx prisma migrate dev --name init
```
Expected: `dev.db` created, migration applied, Prisma Client generated with no errors.

- [ ] **Step 3: Write `prisma/seed.ts`**

```ts
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash: adminPasswordHash,
      role: 'admin',
      staBalance: 1000,
    },
  });

  const teamA = await prisma.team.upsert({
    where: { id: 'seed-team-a' },
    update: {},
    create: { id: 'seed-team-a', name: 'Kartallar' },
  });
  const teamB = await prisma.team.upsert({
    where: { id: 'seed-team-b' },
    update: {},
    create: { id: 'seed-team-b', name: 'Aslanlar' },
  });

  await prisma.player.createMany({
    data: [
      { teamId: teamA.id, name: 'Ahmet', number: 9 },
      { teamId: teamA.id, name: 'Mehmet', number: 7 },
      { teamId: teamB.id, name: 'Burak', number: 10 },
      { teamId: teamB.id, name: 'Emre', number: 11 },
    ],
    skipDuplicates: true,
  });

  console.log('Seed complete. Admin login: admin / admin123');
}

main().finally(() => prisma.$disconnect());
```

Add to `package.json`:
```json
"prisma": { "seed": "tsx prisma/seed.ts" }
```

- [ ] **Step 4: Run the seed and verify**

```bash
npx prisma db seed
```
Expected: console prints `Seed complete. Admin login: admin / admin123` with no errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add Prisma schema, migration, and seed data"
```

---

### Task 3: Odds Engine (`src/lib/odds.ts`)

**Files:**
- Create: `src/lib/odds.ts`, `tests/odds.test.ts`

**Interfaces:**
- Consumes: nothing (pure math module).
- Produces: `computeMatchOdds(): OddsRow[]` where
  ```ts
  type OddsRow = { market: '1X2' | 'SCORE' | 'OU_GOALS' | 'PLAYER_GOALS'; selectionKey: string; oddsValue: number };
  computeMatchOdds(homePlayerIds: string[], awayPlayerIds: string[]): OddsRow[]
  ```
  Task 6 (`actions/matches.ts`) calls this exact function and persists its return value as `Odds` rows.

- [ ] **Step 1: Write failing tests**

`tests/odds.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { computeMatchOdds } from '../src/lib/odds';

describe('computeMatchOdds', () => {
  const odds = computeMatchOdds(['p1', 'p2'], ['p3', 'p4']);

  it('produces exactly one odds row per 1X2 outcome', () => {
    const oneXTwo = odds.filter((o) => o.market === '1X2');
    expect(oneXTwo.map((o) => o.selectionKey).sort()).toEqual(['1', '2', 'X']);
  });

  it('gives the home side a shorter (lower) odds than the draw', () => {
    const home = odds.find((o) => o.market === '1X2' && o.selectionKey === '1')!;
    const draw = odds.find((o) => o.market === '1X2' && o.selectionKey === 'X')!;
    expect(home.oddsValue).toBeLessThan(draw.oddsValue);
  });

  it('produces an OU_GOALS row for the 4.5 line', () => {
    const ou = odds.filter((o) => o.market === 'OU_GOALS');
    expect(ou.map((o) => o.selectionKey).sort()).toEqual(['OVER_4.5', 'UNDER_4.5']);
  });

  it('produces SCORE odds covering 0-0 through at least 4-4', () => {
    const scores = odds.filter((o) => o.market === 'SCORE').map((o) => o.selectionKey);
    expect(scores).toContain('0-0');
    expect(scores).toContain('2-1');
    expect(scores).toContain('4-4');
  });

  it('produces PLAYER_GOALS bands for every player passed in', () => {
    const playerMarkets = odds.filter((o) => o.market === 'PLAYER_GOALS');
    for (const pid of ['p1', 'p2', 'p3', 'p4']) {
      expect(playerMarkets.some((o) => o.selectionKey.startsWith(`${pid}:`))).toBe(true);
    }
  });

  it('all odds values are greater than 1.0 (no risk-free bets)', () => {
    expect(odds.every((o) => o.oddsValue > 1.0)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/odds.test.ts`
Expected: FAIL — `Cannot find module '../src/lib/odds'`

- [ ] **Step 3: Implement `src/lib/odds.ts`**

```ts
export type OddsRow = {
  market: '1X2' | 'SCORE' | 'OU_GOALS' | 'PLAYER_GOALS';
  selectionKey: string;
  oddsValue: number;
};

const HOUSE_MARGIN = 1.07; // ~7% overround
const MAX_GOALS_PER_SIDE = 5; // scores computed for 0..5 goals per side
const OU_LINE = 4.5;

function factorial(n: number): number {
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
}

function poissonPmf(lambda: number, k: number): number {
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

function oddsFromProbability(p: number): number {
  const raw = 1 / p;
  return Math.round(raw * HOUSE_MARGIN * 100) / 100;
}

// Two evenly-matched sides (world-cup-final-inspired: no clear favorite),
// home side gets a small home-field bump.
const HOME_LAMBDA = 2.9;
const AWAY_LAMBDA = 2.6;

function compute1X2(): OddsRow[] {
  let pHome = 0;
  let pDraw = 0;
  let pAway = 0;
  for (let h = 0; h <= MAX_GOALS_PER_SIDE; h++) {
    for (let a = 0; a <= MAX_GOALS_PER_SIDE; a++) {
      const p = poissonPmf(HOME_LAMBDA, h) * poissonPmf(AWAY_LAMBDA, a);
      if (h > a) pHome += p;
      else if (h === a) pDraw += p;
      else pAway += p;
    }
  }
  return [
    { market: '1X2', selectionKey: '1', oddsValue: oddsFromProbability(pHome) },
    { market: '1X2', selectionKey: 'X', oddsValue: oddsFromProbability(pDraw) },
    { market: '1X2', selectionKey: '2', oddsValue: oddsFromProbability(pAway) },
  ];
}

function computeScores(): OddsRow[] {
  const rows: OddsRow[] = [];
  for (let h = 0; h <= MAX_GOALS_PER_SIDE; h++) {
    for (let a = 0; a <= MAX_GOALS_PER_SIDE; a++) {
      const p = poissonPmf(HOME_LAMBDA, h) * poissonPmf(AWAY_LAMBDA, a);
      rows.push({ market: 'SCORE', selectionKey: `${h}-${a}`, oddsValue: oddsFromProbability(p) });
    }
  }
  return rows;
}

function computeOverUnder(): OddsRow[] {
  let pUnder = 0;
  for (let h = 0; h <= MAX_GOALS_PER_SIDE; h++) {
    for (let a = 0; a <= MAX_GOALS_PER_SIDE; a++) {
      if (h + a < OU_LINE) pUnder += poissonPmf(HOME_LAMBDA, h) * poissonPmf(AWAY_LAMBDA, a);
    }
  }
  const pOver = 1 - pUnder;
  return [
    { market: 'OU_GOALS', selectionKey: `OVER_${OU_LINE}`, oddsValue: oddsFromProbability(pOver) },
    { market: 'OU_GOALS', selectionKey: `UNDER_${OU_LINE}`, oddsValue: oddsFromProbability(pUnder) },
  ];
}

function computePlayerGoals(homePlayerIds: string[], awayPlayerIds: string[]): OddsRow[] {
  const rows: OddsRow[] = [];
  const sides: [string[], number][] = [
    [homePlayerIds, HOME_LAMBDA],
    [awayPlayerIds, AWAY_LAMBDA],
  ];
  for (const [playerIds, teamLambda] of sides) {
    if (playerIds.length === 0) continue;
    const playerLambda = teamLambda / playerIds.length;
    for (const pid of playerIds) {
      const p0 = poissonPmf(playerLambda, 0);
      const p1 = poissonPmf(playerLambda, 1);
      const p2plus = 1 - p0 - p1;
      rows.push({ market: 'PLAYER_GOALS', selectionKey: `${pid}:0`, oddsValue: oddsFromProbability(p0) });
      rows.push({ market: 'PLAYER_GOALS', selectionKey: `${pid}:1`, oddsValue: oddsFromProbability(p1) });
      rows.push({ market: 'PLAYER_GOALS', selectionKey: `${pid}:2+`, oddsValue: oddsFromProbability(p2plus) });
    }
  }
  return rows;
}

export function computeMatchOdds(homePlayerIds: string[], awayPlayerIds: string[]): OddsRow[] {
  return [
    ...compute1X2(),
    ...computeScores(),
    ...computeOverUnder(),
    ...computePlayerGoals(homePlayerIds, awayPlayerIds),
  ];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/odds.test.ts`
Expected: PASS (6/6 tests)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add Poisson-based odds engine with unit tests"
```

---

### Task 4: Match Lock Check (`src/lib/matchLock.ts`)

**Files:**
- Create: `src/lib/matchLock.ts`, `tests/matchLock.test.ts`

**Interfaces:**
- Produces: `isMatchLocked(kickoffTime: Date, now: Date): boolean` — consumed by `actions/bets.ts` (Task 7) as the server-side lock guard.

- [ ] **Step 1: Write failing tests**

`tests/matchLock.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { isMatchLocked } from '../src/lib/matchLock';

describe('isMatchLocked', () => {
  it('is not locked when kickoff is in the future', () => {
    const now = new Date('2026-07-22T18:00:00Z');
    const kickoff = new Date('2026-07-22T19:00:00Z');
    expect(isMatchLocked(kickoff, now)).toBe(false);
  });

  it('is locked exactly at kickoff time', () => {
    const now = new Date('2026-07-22T19:00:00Z');
    const kickoff = new Date('2026-07-22T19:00:00Z');
    expect(isMatchLocked(kickoff, now)).toBe(true);
  });

  it('is locked when kickoff is in the past', () => {
    const now = new Date('2026-07-22T20:00:00Z');
    const kickoff = new Date('2026-07-22T19:00:00Z');
    expect(isMatchLocked(kickoff, now)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/matchLock.test.ts`
Expected: FAIL — `Cannot find module '../src/lib/matchLock'`

- [ ] **Step 3: Implement `src/lib/matchLock.ts`**

```ts
export function isMatchLocked(kickoffTime: Date, now: Date = new Date()): boolean {
  return now.getTime() >= kickoffTime.getTime();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/matchLock.test.ts`
Expected: PASS (3/3 tests)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add match lock-time check with unit tests"
```

---

### Task 5: Combined Bet Evaluation Logic (`src/lib/betting.ts`)

**Files:**
- Create: `src/lib/betting.ts`, `tests/betting.test.ts`

**Interfaces:**
- Consumes: nothing (pure module; takes plain data, not Prisma models).
- Produces:
  ```ts
  type MatchResult = { homeScore: number; awayScore: number; playerGoals: Record<string, number> };
  type Selection = { market: '1X2' | 'SCORE' | 'OU_GOALS' | 'PLAYER_GOALS'; selectionKey: string };
  function isSelectionCorrect(selection: Selection, result: MatchResult): boolean
  function evaluateBet(selections: Selection[], result: MatchResult): 'won' | 'lost'
  ```
  Task 8 (`actions/settlement.ts`) calls `evaluateBet` for every `Bet` + its `BetSelection[]`.

- [ ] **Step 1: Write failing tests**

`tests/betting.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { isSelectionCorrect, evaluateBet } from '../src/lib/betting';

const result = { homeScore: 2, awayScore: 1, playerGoals: { p1: 1, p2: 1, p3: 1, p4: 0 } };

describe('isSelectionCorrect', () => {
  it('evaluates 1X2 home win correctly', () => {
    expect(isSelectionCorrect({ market: '1X2', selectionKey: '1' }, result)).toBe(true);
    expect(isSelectionCorrect({ market: '1X2', selectionKey: 'X' }, result)).toBe(false);
    expect(isSelectionCorrect({ market: '1X2', selectionKey: '2' }, result)).toBe(false);
  });

  it('evaluates exact score correctly', () => {
    expect(isSelectionCorrect({ market: 'SCORE', selectionKey: '2-1' }, result)).toBe(true);
    expect(isSelectionCorrect({ market: 'SCORE', selectionKey: '1-1' }, result)).toBe(false);
  });

  it('evaluates over/under goals correctly', () => {
    expect(isSelectionCorrect({ market: 'OU_GOALS', selectionKey: 'UNDER_4.5' }, result)).toBe(true);
    expect(isSelectionCorrect({ market: 'OU_GOALS', selectionKey: 'OVER_4.5' }, result)).toBe(false);
  });

  it('evaluates player goal bands correctly', () => {
    expect(isSelectionCorrect({ market: 'PLAYER_GOALS', selectionKey: 'p1:1' }, result)).toBe(true);
    expect(isSelectionCorrect({ market: 'PLAYER_GOALS', selectionKey: 'p4:0' }, result)).toBe(true);
    expect(isSelectionCorrect({ market: 'PLAYER_GOALS', selectionKey: 'p1:2+' }, result)).toBe(false);
  });
});

describe('evaluateBet', () => {
  it('wins only when every selection in the combined slip is correct', () => {
    const allCorrect = [
      { market: '1X2' as const, selectionKey: '1' },
      { market: 'SCORE' as const, selectionKey: '2-1' },
    ];
    expect(evaluateBet(allCorrect, result)).toBe('won');
  });

  it('loses when any single selection is wrong', () => {
    const oneWrong = [
      { market: '1X2' as const, selectionKey: '1' },
      { market: 'SCORE' as const, selectionKey: '3-0' },
    ];
    expect(evaluateBet(oneWrong, result)).toBe('lost');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/betting.test.ts`
Expected: FAIL — `Cannot find module '../src/lib/betting'`

- [ ] **Step 3: Implement `src/lib/betting.ts`**

```ts
export type MatchResult = {
  homeScore: number;
  awayScore: number;
  playerGoals: Record<string, number>; // playerId -> goal count
};

export type Selection = {
  market: '1X2' | 'SCORE' | 'OU_GOALS' | 'PLAYER_GOALS';
  selectionKey: string;
};

export function isSelectionCorrect(selection: Selection, result: MatchResult): boolean {
  const { market, selectionKey } = selection;
  const { homeScore, awayScore, playerGoals } = result;

  if (market === '1X2') {
    const outcome = homeScore > awayScore ? '1' : homeScore === awayScore ? 'X' : '2';
    return selectionKey === outcome;
  }

  if (market === 'SCORE') {
    return selectionKey === `${homeScore}-${awayScore}`;
  }

  if (market === 'OU_GOALS') {
    const [side, lineStr] = selectionKey.split('_');
    const line = parseFloat(lineStr);
    const total = homeScore + awayScore;
    return side === 'OVER' ? total > line : total < line;
  }

  if (market === 'PLAYER_GOALS') {
    const [playerId, band] = selectionKey.split(':');
    const goals = playerGoals[playerId] ?? 0;
    if (band === '0') return goals === 0;
    if (band === '1') return goals === 1;
    if (band === '2+') return goals >= 2;
    return false;
  }

  return false;
}

export function evaluateBet(selections: Selection[], result: MatchResult): 'won' | 'lost' {
  return selections.every((s) => isSelectionCorrect(s, result)) ? 'won' : 'lost';
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/betting.test.ts`
Expected: PASS (6/6 tests)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add combined bet evaluation logic with unit tests"
```

---

### Task 6: Auth — Registration and NextAuth Config

**Files:**
- Create: `src/lib/prisma.ts`, `src/lib/auth.ts`, `src/actions/auth.ts`, `src/app/api/auth/[...nextauth]/route.ts`, `src/app/register/page.tsx`, `src/app/login/page.tsx`, `src/types/next-auth.d.ts`

**Interfaces:**
- Consumes: `PrismaClient` models `User` from Task 2.
- Produces: `registerUser(username: string, password: string): Promise<{ error?: string }>` consumed by `register/page.tsx`; `authOptions` (NextAuth config) consumed by every protected page/action via `getServerSession(authOptions)`.

- [ ] **Step 1: Prisma client singleton**

`src/lib/prisma.ts`:
```ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

- [ ] **Step 2: NextAuth config**

`src/lib/auth.ts`:
```ts
import type { AuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma';

export const authOptions: AuthOptions = {
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        username: { label: 'Kullanıcı Adı', type: 'text' },
        password: { label: 'Şifre', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;
        const user = await prisma.user.findUnique({ where: { username: credentials.username } });
        if (!user) return null;
        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;
        return { id: user.id, name: user.username, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.role = (user as { role: string }).role;
      return token;
    },
    async session({ session, token }) {
      if (session.user) (session.user as { role?: string }).role = token.role as string;
      return session;
    },
  },
};
```

`src/types/next-auth.d.ts`:
```ts
import 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      name?: string | null;
      role?: string;
    };
  }
}
```

`src/app/api/auth/[...nextauth]/route.ts`:
```ts
import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
```

- [ ] **Step 3: Registration server action**

`src/actions/auth.ts`:
```ts
'use server';

import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

export async function registerUser(username: string, password: string): Promise<{ error?: string }> {
  if (!username || username.trim().length < 3) {
    return { error: 'Kullanıcı adı en az 3 karakter olmalı.' };
  }
  if (!password || password.length < 4) {
    return { error: 'Şifre en az 4 karakter olmalı.' };
  }
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    return { error: 'Bu kullanıcı adı zaten alınmış.' };
  }
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({ data: { username, passwordHash, staBalance: 1000, role: 'user' } });
  return {};
}
```

- [ ] **Step 4: Registration page**

`src/app/register/page.tsx`:
```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { registerUser } from '@/actions/auth';

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = await registerUser(username, password);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.push('/login?registered=1');
  }

  return (
    <main className="mx-auto max-w-sm px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold">Kayıt Ol</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          className="rounded border px-3 py-2"
          placeholder="Kullanıcı adı"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          className="rounded border px-3 py-2"
          type="password"
          placeholder="Şifre"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-green-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
        >
          {loading ? 'Kaydediliyor...' : 'Kayıt Ol'}
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 5: Login page**

`src/app/login/page.tsx`:
```tsx
'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const result = await signIn('credentials', { username, password, redirect: false });
    if (result?.error) {
      setError('Kullanıcı adı veya şifre hatalı.');
      return;
    }
    router.push('/');
  }

  return (
    <main className="mx-auto max-w-sm px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold">Giriş Yap</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          className="rounded border px-3 py-2"
          placeholder="Kullanıcı adı"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          className="rounded border px-3 py-2"
          type="password"
          placeholder="Şifre"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" className="rounded bg-green-600 px-4 py-2 font-semibold text-white">
          Giriş Yap
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 6: Manual verification**

Run: `npm run dev`, open `http://localhost:3000/register`, register a test user, then log in at `/login`.
Expected: redirected to `/` after successful login, no console errors.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add credentials auth with registration and login pages"
```

---

### Task 7: Admin — Team & Roster Management

**Files:**
- Create: `src/actions/teams.ts`, `src/app/admin/layout.tsx`, `src/app/admin/teams/page.tsx`, `src/middleware.ts`

**Interfaces:**
- Consumes: `authOptions` (Task 6), `prisma` (Task 6), `Team`/`Player` models (Task 2).
- Produces: `createTeam(name: string)`, `addPlayer(teamId: string, name: string, number?: number)`, `removePlayer(playerId: string)` — consumed by Task 8's match-creation page (team/player pickers) and by this task's own page.

- [ ] **Step 1: Admin route guard middleware**

`src/middleware.ts`:
```ts
import { withAuth } from 'next-auth/middleware';

export default withAuth({
  callbacks: {
    authorized: ({ token, req }) => {
      if (req.nextUrl.pathname.startsWith('/admin')) {
        return token?.role === 'admin';
      }
      return true;
    },
  },
});

export const config = {
  matcher: ['/admin/:path*'],
};
```

- [ ] **Step 2: Team/player server actions**

`src/actions/teams.ts`:
```ts
'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function createTeam(name: string) {
  if (!name || name.trim().length < 2) return { error: 'Takım adı en az 2 karakter olmalı.' };
  await prisma.team.create({ data: { name: name.trim() } });
  revalidatePath('/admin/teams');
  return {};
}

export async function addPlayer(teamId: string, name: string, number?: number) {
  if (!name || name.trim().length < 2) return { error: 'Oyuncu adı en az 2 karakter olmalı.' };
  await prisma.player.create({ data: { teamId, name: name.trim(), number: number ?? null } });
  revalidatePath('/admin/teams');
  return {};
}

export async function removePlayer(playerId: string) {
  await prisma.player.delete({ where: { id: playerId } });
  revalidatePath('/admin/teams');
  return {};
}
```

- [ ] **Step 3: Admin layout with nav**

`src/app/admin/layout.tsx`:
```tsx
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
```

- [ ] **Step 4: Teams admin page**

`src/app/admin/teams/page.tsx`:
```tsx
import { prisma } from '@/lib/prisma';
import { createTeam, addPlayer, removePlayer } from '@/actions/teams';

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
            <h2 className="mb-2 font-semibold">{team.name}</h2>
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
```

- [ ] **Step 5: Manual verification**

Log in as `admin`/`admin123` (from seed), visit `/admin/teams`.
Expected: seeded teams (Kartallar, Aslanlar) and players visible; adding a team/player and removing a player all work without page errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add admin team/roster management and admin route guard"
```

---

### Task 8: Admin — Match Creation (Odds Persisted)

**Files:**
- Create: `src/actions/matches.ts`, `src/app/admin/matches/new/page.tsx`, `src/app/admin/page.tsx`

**Interfaces:**
- Consumes: `computeMatchOdds` (Task 3), `prisma` (Task 6), `Team`/`Match`/`Odds` models (Task 2).
- Produces: `createMatch(homeTeamId: string, awayTeamId: string, kickoffTime: Date)` — this is the only place `Odds` rows are ever written, matching the Global Constraint that odds are computed once.

- [ ] **Step 1: Match creation server action**

`src/actions/matches.ts`:
```ts
'use server';

import { prisma } from '@/lib/prisma';
import { computeMatchOdds } from '@/lib/odds';
import { revalidatePath } from 'next/cache';

export async function createMatch(homeTeamId: string, awayTeamId: string, kickoffTime: Date) {
  if (homeTeamId === awayTeamId) {
    return { error: 'Ev sahibi ve deplasman takımı aynı olamaz.' };
  }

  const [homePlayers, awayPlayers] = await Promise.all([
    prisma.player.findMany({ where: { teamId: homeTeamId } }),
    prisma.player.findMany({ where: { teamId: awayTeamId } }),
  ]);

  const match = await prisma.match.create({
    data: { homeTeamId, awayTeamId, kickoffTime, status: 'upcoming' },
  });

  const oddsRows = computeMatchOdds(
    homePlayers.map((p) => p.id),
    awayPlayers.map((p) => p.id)
  );

  await prisma.odds.createMany({
    data: oddsRows.map((o) => ({ matchId: match.id, market: o.market, selectionKey: o.selectionKey, oddsValue: o.oddsValue })),
  });

  revalidatePath('/admin');
  revalidatePath('/');
  return { matchId: match.id };
}
```

- [ ] **Step 2: New match admin page**

`src/app/admin/matches/new/page.tsx`:
```tsx
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
          const result = await createMatch(homeTeamId, awayTeamId, new Date(kickoff));
          if (!result.error) redirect('/admin');
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
        <button className="rounded bg-green-600 px-4 py-2 font-semibold text-white">Maçı Oluştur</button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Admin dashboard listing matches**

`src/app/admin/page.tsx`:
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
      <h1 className="mb-4 text-xl font-bold">Maçlar</h1>
      <ul className="flex flex-col gap-2">
        {matches.map((m) => (
          <li key={m.id} className="rounded border p-3 text-sm">
            <Link href={`/admin/matches/${m.id}`} className="font-medium text-green-700">
              {m.homeTeam.name} vs {m.awayTeam.name}
            </Link>
            <div className="text-gray-500">
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

- [ ] **Step 4: Manual verification**

Visit `/admin/matches/new`, create a match between the two seeded teams with a future kickoff time.
Expected: redirected to `/admin`, new match appears in the list with status `upcoming`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add admin match creation with auto-computed odds"
```

---

### Task 9: User — Match List, Match Detail, Bet Placement

**Files:**
- Create: `src/actions/bets.ts`, `src/app/page.tsx` (overwrite scaffold default), `src/app/matches/[id]/page.tsx`

**Interfaces:**
- Consumes: `isMatchLocked` (Task 4), `prisma` (Task 6), `Match`/`Odds`/`Bet`/`BetSelection` models (Task 2), `authOptions`/`getServerSession` (Task 6).
- Produces: `placeBet(matchId: string, selections: {market: string, selectionKey: string}[], stake: number)` — returns `{ error?: string }`.

- [ ] **Step 1: Bet placement server action**

`src/actions/bets.ts`:
```ts
'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isMatchLocked } from '@/lib/matchLock';
import { revalidatePath } from 'next/cache';

type SelectionInput = { market: string; selectionKey: string };

export async function placeBet(matchId: string, selections: SelectionInput[], stake: number) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.name) return { error: 'Giriş yapmalısın.' };
  if (!selections.length) return { error: 'En az bir seçim yapmalısın.' };
  if (!Number.isInteger(stake) || stake <= 0) return { error: 'Geçerli bir STA miktarı gir.' };

  const user = await prisma.user.findUnique({ where: { username: session.user.name } });
  if (!user) return { error: 'Kullanıcı bulunamadı.' };
  if (stake > user.staBalance) return { error: 'Yetersiz bakiye.' };

  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) return { error: 'Maç bulunamadı.' };
  if (isMatchLocked(match.kickoffTime)) return { error: 'Bu maç için kupon süresi doldu.' };

  const existing = await prisma.bet.findUnique({ where: { userId_matchId: { userId: user.id, matchId } } });
  if (existing) return { error: 'Bu maça zaten kupon yaptın.' };

  const oddsRows = await prisma.odds.findMany({ where: { matchId } });
  const selectedOdds = selections.map((s) => {
    const row = oddsRows.find((o) => o.market === s.market && o.selectionKey === s.selectionKey);
    if (!row) throw new Error(`Odds not found for ${s.market}/${s.selectionKey}`);
    return row;
  });

  const totalOdds = selectedOdds.reduce((acc, o) => acc * o.oddsValue, 1);
  const potentialWin = Math.round(stake * totalOdds);

  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { staBalance: { decrement: stake } } }),
    prisma.bet.create({
      data: {
        userId: user.id,
        matchId,
        stake,
        totalOdds,
        potentialWin,
        status: 'pending',
        selections: {
          create: selectedOdds.map((o) => ({ market: o.market, selectionKey: o.selectionKey, oddsValueAtBet: o.oddsValue })),
        },
      },
    }),
  ]);

  revalidatePath(`/matches/${matchId}`);
  return {};
}
```

- [ ] **Step 2: Home page — upcoming matches + leaderboard widget**

`src/app/page.tsx`:
```tsx
import { prisma } from '@/lib/prisma';
import Link from 'next/link';

export default async function HomePage() {
  const matches = await prisma.match.findMany({
    where: { status: { in: ['upcoming', 'locked'] } },
    include: { homeTeam: true, awayTeam: true },
    orderBy: { kickoffTime: 'asc' },
  });

  const topUsers = await prisma.user.findMany({
    orderBy: { staBalance: 'desc' },
    take: 3,
    select: { username: true, staBalance: true },
  });

  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      <h1 className="mb-4 text-2xl font-bold">Hali Saha İddaa</h1>

      <section className="mb-8">
        <h2 className="mb-2 text-lg font-semibold">Yaklaşan Maçlar</h2>
        <ul className="flex flex-col gap-2">
          {matches.map((m) => (
            <li key={m.id}>
              <Link href={`/matches/${m.id}`} className="block rounded border p-3">
                <div className="font-medium">{m.homeTeam.name} vs {m.awayTeam.name}</div>
                <div className="text-sm text-gray-500">{m.kickoffTime.toLocaleString('tr-TR')}</div>
              </Link>
            </li>
          ))}
          {matches.length === 0 && <li className="text-sm text-gray-500">Şu an yaklaşan maç yok.</li>}
        </ul>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Liderlik Tablosu</h2>
          <Link href="/leaderboard" className="text-sm text-green-700">Tümünü gör</Link>
        </div>
        <ol className="flex flex-col gap-1">
          {topUsers.map((u, i) => (
            <li key={u.username} className="flex justify-between rounded bg-gray-50 px-3 py-2 text-sm">
              <span>{i + 1}. {u.username}</span>
              <span className="font-semibold">{u.staBalance} STA</span>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
```

- [ ] **Step 3: Match detail page with bet slip**

`src/app/matches/[id]/page.tsx`:
```tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { placeBet } from '@/actions/bets';

type Odds = { market: string; selectionKey: string; oddsValue: number };
type MatchData = {
  id: string;
  homeTeam: { name: string };
  awayTeam: { name: string };
  kickoffTime: string;
  odds: Odds[];
};

export default function MatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [match, setMatch] = useState<MatchData | null>(null);
  const [selected, setSelected] = useState<Odds[]>([]);
  const [stake, setStake] = useState(100);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/matches/${id}`).then((r) => r.json()).then(setMatch);
  }, [id]);

  if (!match) return <main className="p-4">Yükleniyor...</main>;

  function toggleSelection(o: Odds) {
    setSelected((prev) => {
      const withoutSameMarket = prev.filter((s) => s.market !== o.market);
      const alreadySelected = prev.some((s) => s.market === o.market && s.selectionKey === o.selectionKey);
      return alreadySelected ? withoutSameMarket : [...withoutSameMarket, o];
    });
  }

  const totalOdds = selected.reduce((acc, o) => acc * o.oddsValue, 1);

  async function submit() {
    setMessage(null);
    const result = await placeBet(
      match!.id,
      selected.map((s) => ({ market: s.market, selectionKey: s.selectionKey })),
      stake
    );
    setMessage(result.error ?? 'Kupon başarıyla oluşturuldu!');
  }

  const oneXTwo = match.odds.filter((o) => o.market === '1X2');
  const ouGoals = match.odds.filter((o) => o.market === 'OU_GOALS');

  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      <h1 className="mb-1 text-xl font-bold">{match.homeTeam.name} vs {match.awayTeam.name}</h1>
      <p className="mb-4 text-sm text-gray-500">{new Date(match.kickoffTime).toLocaleString('tr-TR')}</p>

      <section className="mb-4">
        <h2 className="mb-2 font-semibold">Maç Sonucu</h2>
        <div className="flex gap-2">
          {oneXTwo.map((o) => (
            <button
              key={o.selectionKey}
              onClick={() => toggleSelection(o)}
              className={`flex-1 rounded border py-2 text-sm ${selected.some((s) => s.selectionKey === o.selectionKey && s.market === o.market) ? 'bg-green-600 text-white' : ''}`}
            >
              {o.selectionKey} ({o.oddsValue})
            </button>
          ))}
        </div>
      </section>

      <section className="mb-4">
        <h2 className="mb-2 font-semibold">Toplam Gol</h2>
        <div className="flex gap-2">
          {ouGoals.map((o) => (
            <button
              key={o.selectionKey}
              onClick={() => toggleSelection(o)}
              className={`flex-1 rounded border py-2 text-sm ${selected.some((s) => s.selectionKey === o.selectionKey && s.market === o.market) ? 'bg-green-600 text-white' : ''}`}
            >
              {o.selectionKey} ({o.oddsValue})
            </button>
          ))}
        </div>
      </section>

      <section className="rounded border p-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span>Toplam Oran</span>
          <span className="font-bold">{selected.length ? totalOdds.toFixed(2) : '-'}</span>
        </div>
        <input
          type="number"
          min={1}
          value={stake}
          onChange={(e) => setStake(parseInt(e.target.value, 10) || 0)}
          className="mb-2 w-full rounded border px-3 py-2"
          placeholder="STA miktarı"
        />
        <button onClick={submit} className="w-full rounded bg-green-600 py-2 font-semibold text-white">
          Kuponu Onayla
        </button>
        {message && <p className="mt-2 text-sm">{message}</p>}
      </section>
    </main>
  );
}
```

- [ ] **Step 4: Match detail API route (backs the client page's fetch)**

Create: `src/app/api/matches/[id]/route.ts`
```ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const match = await prisma.match.findUnique({
    where: { id: params.id },
    include: { homeTeam: true, awayTeam: true, odds: true },
  });
  if (!match) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(match);
}
```

- [ ] **Step 5: Manual verification**

Log in as a regular user, open a match from the home page, select a 1X2 outcome and an over/under option, enter a stake within balance, submit.
Expected: success message shown; re-submitting the same match shows "Bu maça zaten kupon yaptın."; entering a stake above balance shows "Yetersiz bakiye."

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add match list, bet slip UI, and bet placement action"
```

---

### Task 10: Admin — Match Settlement

**Files:**
- Create: `src/actions/settlement.ts`, `src/app/admin/matches/[id]/page.tsx`

**Interfaces:**
- Consumes: `evaluateBet` (Task 5), `prisma` (Task 6), `Bet`/`BetSelection`/`PlayerGoal` models (Task 2).
- Produces: `settleMatch(matchId: string, homeScore: number, awayScore: number, playerGoals: {playerId: string, goalCount: number}[])`.

- [ ] **Step 1: Settlement server action**

`src/actions/settlement.ts`:
```ts
'use server';

import { prisma } from '@/lib/prisma';
import { evaluateBet } from '@/lib/betting';
import { revalidatePath } from 'next/cache';

export async function settleMatch(
  matchId: string,
  homeScore: number,
  awayScore: number,
  playerGoals: { playerId: string; goalCount: number }[]
) {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) return { error: 'Maç bulunamadı.' };
  if (match.status === 'finished') return { error: 'Bu maç zaten sonuçlandırıldı.' };

  const playerGoalMap: Record<string, number> = {};
  for (const pg of playerGoals) playerGoalMap[pg.playerId] = pg.goalCount;

  const bets = await prisma.bet.findMany({ where: { matchId }, include: { selections: true } });

  await prisma.$transaction([
    prisma.match.update({
      where: { id: matchId },
      data: { status: 'finished', finalHomeScore: homeScore, finalAwayScore: awayScore },
    }),
    ...playerGoals.map((pg) =>
      prisma.playerGoal.upsert({
        where: { matchId_playerId: { matchId, playerId: pg.playerId } },
        update: { goalCount: pg.goalCount },
        create: { matchId, playerId: pg.playerId, goalCount: pg.goalCount },
      })
    ),
    ...bets.flatMap((bet) => {
      const outcome = evaluateBet(
        bet.selections.map((s) => ({ market: s.market as never, selectionKey: s.selectionKey })),
        { homeScore, awayScore, playerGoals: playerGoalMap }
      );
      const updates = [
        prisma.bet.update({ where: { id: bet.id }, data: { status: outcome } }),
      ];
      if (outcome === 'won') {
        updates.push(
          prisma.user.update({ where: { id: bet.userId }, data: { staBalance: { increment: bet.potentialWin } } })
        );
      }
      return updates;
    }),
  ]);

  revalidatePath('/admin');
  revalidatePath('/leaderboard');
  revalidatePath('/');
  return {};
}
```

- [ ] **Step 2: Settlement admin page**

`src/app/admin/matches/[id]/page.tsx`:
```tsx
import { prisma } from '@/lib/prisma';
import { settleMatch } from '@/actions/settlement';
import { redirect } from 'next/navigation';

export default async function AdminMatchPage({ params }: { params: { id: string } }) {
  const match = await prisma.match.findUnique({
    where: { id: params.id },
    include: {
      homeTeam: { include: { players: true } },
      awayTeam: { include: { players: true } },
    },
  });
  if (!match) return <p>Maç bulunamadı.</p>;

  const allPlayers = [...match.homeTeam.players, ...match.awayTeam.players];

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">{match.homeTeam.name} vs {match.awayTeam.name}</h1>
      <p className="mb-4 text-sm text-gray-500">Durum: {match.status}</p>

      {match.status === 'finished' ? (
        <p>Sonuç: {match.finalHomeScore} - {match.finalAwayScore} (sonuçlandırıldı)</p>
      ) : (
        <form
          action={async (formData) => {
            'use server';
            const homeScore = parseInt(formData.get('homeScore') as string, 10);
            const awayScore = parseInt(formData.get('awayScore') as string, 10);
            const playerGoals = allPlayers.map((p) => ({
              playerId: p.id,
              goalCount: parseInt((formData.get(`goals_${p.id}`) as string) || '0', 10),
            }));
            const result = await settleMatch(match.id, homeScore, awayScore, playerGoals);
            if (!result.error) redirect('/admin');
          }}
          className="flex flex-col gap-4"
        >
          <div className="flex gap-2">
            <input name="homeScore" type="number" min={0} placeholder="Ev sahibi skor" className="w-1/2 rounded border px-3 py-2" required />
            <input name="awayScore" type="number" min={0} placeholder="Deplasman skor" className="w-1/2 rounded border px-3 py-2" required />
          </div>
          <div>
            <h2 className="mb-2 font-semibold">Oyuncu Golleri</h2>
            {allPlayers.map((p) => (
              <div key={p.id} className="mb-1 flex items-center justify-between text-sm">
                <span>{p.name}</span>
                <input name={`goals_${p.id}`} type="number" min={0} defaultValue={0} className="w-16 rounded border px-2 py-1" />
              </div>
            ))}
          </div>
          <button className="rounded bg-red-600 px-4 py-2 font-semibold text-white">
            Sonuçlandır (geri alınamaz)
          </button>
        </form>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Manual verification**

Place a bet as a test user on a match, then as admin enter a final score matching that bet's selections and submit.
Expected: match status becomes `finished`, bet status becomes `won`, user's STA balance increases by `potentialWin`; attempting to settle the same match again shows "Bu maç zaten sonuçlandırıldı."

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add match settlement with automatic bet evaluation"
```

---

### Task 11: Leaderboard Page

**Files:**
- Create: `src/app/leaderboard/page.tsx`

**Interfaces:**
- Consumes: `prisma` (Task 6), `User`/`Bet` models (Task 2).

- [ ] **Step 1: Leaderboard page**

`src/app/leaderboard/page.tsx`:
```tsx
import { prisma } from '@/lib/prisma';

export default async function LeaderboardPage() {
  const users = await prisma.user.findMany({
    where: { role: 'user' },
    orderBy: { staBalance: 'desc' },
    include: { bets: true },
  });

  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      <h1 className="mb-4 text-2xl font-bold">Liderlik Tablosu</h1>
      <ol className="flex flex-col gap-2">
        {users.map((u, i) => {
          const total = u.bets.length;
          const won = u.bets.filter((b) => b.status === 'won').length;
          const winRate = total > 0 ? Math.round((won / total) * 100) : 0;
          return (
            <li key={u.id} className="flex items-center justify-between rounded border p-3">
              <div>
                <div className="font-medium">{i + 1}. {u.username}</div>
                <div className="text-xs text-gray-500">{total} kupon, %{winRate} kazanma</div>
              </div>
              <div className="font-bold">{u.staBalance} STA</div>
            </li>
          );
        })}
      </ol>
    </main>
  );
}
```

- [ ] **Step 2: Manual verification**

Visit `/leaderboard` after at least one settled match.
Expected: users sorted by balance descending, win rate reflects settled bets correctly.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add leaderboard page"
```

---

### Task 12: Admin — User STA Balance Management

**Files:**
- Create: `src/actions/users.ts`, `src/app/admin/users/page.tsx`

**Interfaces:**
- Consumes: `prisma` (Task 6), `User` model (Task 2).
- Produces: `adjustBalance(userId: string, delta: number)`.

- [ ] **Step 1: Balance adjustment server action**

`src/actions/users.ts`:
```ts
'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function adjustBalance(userId: string, delta: number) {
  if (!Number.isInteger(delta) || delta === 0) return { error: 'Geçerli bir miktar gir.' };
  await prisma.user.update({ where: { id: userId }, data: { staBalance: { increment: delta } } });
  revalidatePath('/admin/users');
  revalidatePath('/leaderboard');
  return {};
}
```

- [ ] **Step 2: Users admin page**

`src/app/admin/users/page.tsx`:
```tsx
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
```

- [ ] **Step 3: Manual verification**

Visit `/admin/users`, adjust a user's balance by `+500`, then `-200`.
Expected: displayed balance updates correctly each time.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add admin STA balance management"
```

---

### Task 13: Navigation, Session-Aware Layout, README

**Files:**
- Modify: `src/app/layout.tsx`
- Create: `README.md`

**Interfaces:**
- Consumes: `authOptions`/`getServerSession` (Task 6).

- [ ] **Step 1: Root layout with session-aware nav**

`src/app/layout.tsx`:
```tsx
import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Hali Saha İddaa',
  description: 'Arkadaş grubu için eğlence amaçlı STA para birimiyle tahmin oyunu',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  return (
    <html lang="tr">
      <body className="bg-gray-100 text-gray-900">
        <header className="border-b bg-white px-4 py-3">
          <div className="mx-auto flex max-w-lg items-center justify-between">
            <Link href="/" className="font-bold text-green-700">Hali Saha İddaa</Link>
            <nav className="flex gap-3 text-sm">
              {session?.user ? (
                <>
                  {session.user.role === 'admin' && <Link href="/admin">Admin</Link>}
                  <Link href="/leaderboard">Liderlik</Link>
                </>
              ) : (
                <>
                  <Link href="/login">Giriş</Link>
                  <Link href="/register">Kayıt Ol</Link>
                </>
              )}
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 2: README with local dev and deployment instructions**

`README.md`:
```markdown
# Hali Saha İddaa Sitesi

Arkadaş grubu maçları için eğlence amaçlı, gerçek para karşılığı olmayan STA para birimiyle çalışan tahmin sitesi.

## Yerelde çalıştırma

\`\`\`bash
npm install
cp .env.example .env
npx prisma migrate dev
npx prisma db seed
npm run dev
\`\`\`

Seed admin girişi: kullanıcı adı `admin`, şifre `admin123` (canlıya almadan önce mutlaka değiştir).

## Testler

\`\`\`bash
npm test
\`\`\`

## Canlıya alma (Vercel + Neon)

Bu adımlar senin kendi hesaplarınla yapman gereken adımlardır:

1. [neon.tech](https://neon.tech) üzerinde ücretsiz bir Postgres veritabanı oluştur, bağlantı dizesini kopyala.
2. `prisma/schema.prisma` dosyasında `datasource db` bloğundaki `provider`'ı `"postgresql"` yap.
3. Vercel projenin ortam değişkenlerine `DATABASE_URL` (Neon bağlantı dizesi), `NEXTAUTH_SECRET` (rastgele uzun bir gizli anahtar) ve `NEXTAUTH_URL` (canlı site adresin) ekle.
4. Vercel'e bu repoyu bağla ve deploy et; ilk deploy sonrası `npx prisma migrate deploy` çalıştırılmasını sağla (Vercel build komutuna ekleyebilirsin: `prisma migrate deploy && next build`).
5. Deploy sonrası bir kere `npx prisma db seed` çalıştırarak admin hesabını oluştur, ardından admin şifresini `/admin/users` üzerinden değiştir (not: şifre değiştirme UI'ı bu sürümde yok — gerekirse admin şifresini doğrudan veritabanından güncelle).
```

- [ ] **Step 3: Full manual regression pass**

Run through: register → login → view home page matches/leaderboard widget → open a match → place a combined bet (1X2 + over/under) → confirm balance decreased → as admin, create a new match → settle an existing match → confirm bet outcomes and balances updated → check `/leaderboard` reflects new standings.
Expected: no step errors, all pages render correctly at a 375px-wide viewport (mobile).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add session-aware navigation and project README"
```

---

## Self-Review Notes

- **Spec coverage:** Auth+STA start balance (Task 6), 1X2/Score/OU/PlayerGoals odds engine (Task 3), one-bet-per-match + lock-time (Tasks 2/4/9), combined bet evaluation (Tasks 5/10), admin team/roster/match/settlement/user-balance management (Tasks 7/8/10/12), leaderboard (Task 11), mobile-first Tailwind UI (all UI tasks) — all covered.
- **Type consistency checked:** `OddsRow`/`Selection` shape (`market`, `selectionKey`) is identical across `lib/odds.ts`, `lib/betting.ts`, `actions/bets.ts`, and `actions/settlement.ts`. `evaluateBet` signature matches its two call-sites verbatim.
- **Deployment to Neon/Vercel is intentionally left as user-run README steps** — creating third-party accounts is not something this plan automates.
