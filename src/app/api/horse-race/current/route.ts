import { NextResponse } from 'next/server';
import { getCurrentRace } from '@/lib/horseRaceEngine';

export async function GET() {
  const race = await getCurrentRace();
  return NextResponse.json(race);
}
