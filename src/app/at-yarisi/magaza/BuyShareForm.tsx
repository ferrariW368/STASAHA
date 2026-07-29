'use client';

import { useState } from 'react';
import { buyHorseShare } from '@/actions/horseShop';

// Quick-buy presets so most users never have to type a number — the whole
// "buy a share" flow is a single tap. Custom amount stays available for
// anyone who wants a specific figure.
const PRESETS = [50, 100, 250];

export default function BuyShareForm({
  horseId,
  remaining,
  totalInvested,
  myShare,
}: {
  horseId: string;
  remaining: number;
  totalInvested: number;
  myShare: number;
}) {
  const [customOpen, setCustomOpen] = useState(false);
  const [amount, setAmount] = useState(100);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function buy(value: number) {
    setMessage(null);
    setSubmitting(true);
    const result = await buyHorseShare(horseId, value);
    setSubmitting(false);
    setMessage(result.error ?? 'Pay alındı! 🎉');
  }

  // Projected payout-share preview for a given buy amount, so the user sees
  // the benefit before they tap — not just the STA cost.
  function projectedShare(value: number) {
    const newTotal = totalInvested + Math.min(value, remaining);
    const newMine = myShare + Math.min(value, remaining);
    return newTotal > 0 ? (newMine / newTotal) * 100 : 0;
  }

  return (
    <div className="mt-2 flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {PRESETS.filter((p) => p <= remaining).map((preset) => (
          <button
            key={preset}
            onClick={() => buy(preset)}
            disabled={submitting}
            className="pop-interactive rounded-full bg-gold px-3 py-1.5 text-sm font-semibold text-pitch-night disabled:opacity-40"
            title={`Alınca payın: %${projectedShare(preset).toFixed(0)}`}
          >
            +{preset} STA
          </button>
        ))}
        <button
          onClick={() => buy(remaining)}
          disabled={submitting}
          className="pop-interactive rounded-full border border-gold px-3 py-1.5 text-sm font-semibold text-gold disabled:opacity-40"
          title="Kalan tüm payı tek seferde al"
        >
          Tamamla ({remaining} STA)
        </button>
        <button
          onClick={() => setCustomOpen((v) => !v)}
          className="pop-interactive rounded-full border border-line px-3 py-1.5 text-sm text-text-muted"
        >
          Özel miktar
        </button>
      </div>

      {customOpen && (
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={remaining}
            value={amount}
            onChange={(e) => setAmount(parseInt(e.target.value, 10) || 0)}
            className="w-24 rounded-lg border border-line bg-pitch-night px-2 py-1 text-sm text-text-primary"
          />
          <button
            onClick={() => buy(amount)}
            disabled={submitting || amount <= 0}
            className="pop-interactive flex-1 rounded-full bg-gold px-3 py-1.5 text-sm font-semibold text-pitch-night disabled:opacity-40"
          >
            {submitting ? 'Gönderiliyor...' : 'Pay Al'}
          </button>
        </div>
      )}

      {message && <span className="text-xs text-text-muted">{message}</span>}
    </div>
  );
}
