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
  // Interactive transaction: the conditional phase-flip, the reads that
  // determine the outcome, and the payout writes all happen inside the same
  // transaction, so either the whole settlement commits or none of it does.
  // If any step throws (transient DB error, connection drop, etc.), Postgres
  // rolls back the phase flip too, leaving the race in RACING so a future
  // call can retry settlement cleanly instead of getting stuck at FINISHED
  // with unpaid bets.
  await prisma.$transaction(async (tx) => {
    // Conditional update: only the request that actually flips BETTING/RACING's
    // phase to FINISHED performs settlement. Concurrent callers get count=0 and
    // return immediately, avoiding double-payout.
    const { count } = await tx.horseRace.updateMany({
      where: { id: raceId, phase: 'RACING' },
      data: { phase: 'FINISHED' },
    });
    if (count === 0) return;

    const race = await tx.horseRace.findUniqueOrThrow({ where: { id: raceId }, include: raceInclude });
    const horseIds = race.entries.map((e) => e.horseId);
    const probs = winProbabilities(race.entries.map((e) => e.horse));
    const rng = mulberry32(race.seed);
    const finishOrder = drawFinishOrder(horseIds, probs, rng);
    const winnerId = finishOrder[0];

    const bets = await tx.horseBet.findMany({ where: { raceId } });
    const winnerOwnerships = await tx.horseOwnership.findMany({ where: { horseId: winnerId } });
    const winnerHorse = race.entries.find((e) => e.horseId === winnerId)!.horse;
    const totalInvested = winnerOwnerships.reduce((s, o) => s + o.staInvested, 0);
    const bonusPool = Math.round(winnerHorse.price * OWNER_BONUS_RATE);

    for (const [i, horseId] of finishOrder.entries()) {
      await tx.horseRaceEntry.update({
        where: { raceId_horseId: { raceId, horseId } },
        data: { finishPosition: i + 1 },
      });
    }

    for (const bet of bets) {
      await tx.horseBet.update({
        where: { id: bet.id },
        data: { status: bet.horseId === winnerId ? 'won' : 'lost' },
      });
    }

    for (const bet of bets.filter((bet) => bet.horseId === winnerId)) {
      await tx.user.update({ where: { id: bet.userId }, data: { staBalance: { increment: bet.potentialWin } } });
    }

    if (totalInvested > 0) {
      const payouts = winnerOwnerships
        .map((o) => ({ userId: o.userId, amount: Math.round(bonusPool * (o.staInvested / totalInvested)) }))
        .filter((p) => p.amount > 0);
      for (const p of payouts) {
        await tx.user.update({ where: { id: p.userId }, data: { staBalance: { increment: p.amount } } });
      }
    }
  });
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
