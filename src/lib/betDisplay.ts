export const statusLabel: Record<string, { text: string; className: string }> = {
  pending: { text: 'Bekliyor', className: 'bg-yellow-50 text-yellow-700' },
  won: { text: 'Kazandı', className: 'bg-green-50 text-green-700' },
  lost: { text: 'Kaybetti', className: 'bg-red-50 text-red-700' },
  refunded: { text: 'İade Edildi', className: 'bg-gray-100 text-gray-600' },
};

export const marketLabel: Record<string, string> = {
  '1X2': 'Maç Sonucu',
  SCORE: 'Skor',
  OU_GOALS: 'Toplam Gol',
  BTS: 'KG Var/Yok',
  NOVELTY: 'Eğlenceli Bahis',
  PLAYER_GOALS: 'Oyuncu Golü',
  FIGHT: 'Kavga',
  LATE: 'Geç Kalma',
};

const noveltyLabels: Record<string, string> = {
  RED_CARD_YES: 'Kırmızı kart çıkar',
  RED_CARD_NO: 'Kırmızı kart çıkmaz',
  PITCH_INVASION_YES: 'Sahaya biri dalar',
  PITCH_INVASION_NO: 'Sahaya kimse dalmaz',
  REFEREE_ARGUMENT_YES: 'Hakem tartışması çıkar',
  REFEREE_ARGUMENT_NO: 'Hakem tartışması çıkmaz',
  MATCH_ABANDONED_YES: 'Maç yarıda kalır',
  MATCH_ABANDONED_NO: 'Maç yarıda kalmaz',
};

export function describeSelection(
  market: string,
  selectionKey: string,
  playerNameById: Map<string, string>
): string {
  if (market === 'PLAYER_GOALS') {
    const [playerId, band] = selectionKey.split(':');
    const name = playerNameById.get(playerId) ?? 'Oyuncu';
    const bandLabel = band === '1+' ? 'Gol Atar' : '2+ Gol';
    return `${name} · ${bandLabel}`;
  }
  if (market === 'FIGHT') {
    const [playerId] = selectionKey.split(':');
    return `${playerNameById.get(playerId) ?? 'Oyuncu'} kavga eder`;
  }
  if (market === 'LATE') {
    const [playerId] = selectionKey.split(':');
    return `${playerNameById.get(playerId) ?? 'Oyuncu'} geç kalır`;
  }
  if (market === 'BTS') {
    return selectionKey === 'YES' ? 'Karşılıklı gol var' : 'Karşılıklı gol yok';
  }
  if (market === 'NOVELTY') {
    return noveltyLabels[selectionKey] ?? selectionKey;
  }
  return selectionKey;
}

export function playerIdsFromSelections(selections: { market: string; selectionKey: string }[]): string[] {
  return selections
    .filter((s) => ['PLAYER_GOALS', 'FIGHT', 'LATE'].includes(s.market))
    .map((s) => s.selectionKey.split(':')[0]);
}
