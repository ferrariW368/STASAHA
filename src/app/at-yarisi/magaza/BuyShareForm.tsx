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
        className="pop-interactive flex-1 rounded-full bg-gold px-3 py-1.5 text-sm font-semibold text-pitch-night disabled:opacity-40"
      >
        {submitting ? 'Gönderiliyor...' : 'Pay Al'}
      </button>
      {message && <span className="text-xs text-text-muted">{message}</span>}
    </div>
  );
}
