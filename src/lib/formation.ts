export type Position = 'GK' | 'DEF' | 'MID' | 'FWD';

export type Formation = {
  format: number;
  rows: { position: Position; count: number }[]; // ordered GK (bottom) to FWD (top)
};

const FORMATIONS: Record<number, Formation> = {
  5: { format: 5, rows: [{ position: 'GK', count: 1 }, { position: 'DEF', count: 2 }, { position: 'FWD', count: 2 }] },
  6: {
    format: 6,
    rows: [
      { position: 'GK', count: 1 },
      { position: 'DEF', count: 2 },
      { position: 'MID', count: 1 },
      { position: 'FWD', count: 2 },
    ],
  },
  7: {
    format: 7,
    rows: [
      { position: 'GK', count: 1 },
      { position: 'DEF', count: 2 },
      { position: 'MID', count: 2 },
      { position: 'FWD', count: 2 },
    ],
  },
  8: {
    format: 8,
    rows: [
      { position: 'GK', count: 1 },
      { position: 'DEF', count: 3 },
      { position: 'MID', count: 2 },
      { position: 'FWD', count: 2 },
    ],
  },
  9: {
    format: 9,
    rows: [
      { position: 'GK', count: 1 },
      { position: 'DEF', count: 3 },
      { position: 'MID', count: 3 },
      { position: 'FWD', count: 2 },
    ],
  },
  10: {
    format: 10,
    rows: [
      { position: 'GK', count: 1 },
      { position: 'DEF', count: 4 },
      { position: 'MID', count: 3 },
      { position: 'FWD', count: 2 },
    ],
  },
  11: {
    format: 11,
    rows: [
      { position: 'GK', count: 1 },
      { position: 'DEF', count: 4 },
      { position: 'MID', count: 4 },
      { position: 'FWD', count: 2 },
    ],
  },
};

export const VALID_FORMATS = Object.keys(FORMATIONS).map(Number);

export function getFormation(format: number): Formation | null {
  return FORMATIONS[format] ?? null;
}

export function totalSlots(formation: Formation): number {
  return formation.rows.reduce((sum, r) => sum + r.count, 0);
}
