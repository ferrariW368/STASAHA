'use client';

import { useState } from 'react';

const LETTERS = [
  { letter: 'F', title: 'Fair Play', text: 'Sadece şaka parası, gerçek para hiç geçmez.' },
  { letter: 'E', title: 'Eğlence', text: 'Amaç kazanmak değil, gruba laf sokmak.' },
  { letter: 'R', title: 'Rekabet', text: 'Liderlik tablosunda kimin ağzı bozulacak belli olmaz.' },
  { letter: 'R', title: 'Risk', text: 'Kuponun tutmazsa üzülme, STA basarız yine.' },
  { letter: 'A', title: 'Arkadaşlık', text: 'Hepsi aynı halı sahadan çıkma dert ortakları.' },
  { letter: 'R', title: 'Randevu', text: 'Maç saatine göre kilitlenen kupon, geç kalana yok.' },
  { letter: 'I', title: 'İddaa', text: 'Skor, gol, kart... hepsi bahis konusu.' },
];

export default function FrameworkAcronym() {
  const [active, setActive] = useState(0);

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {LETTERS.map((item, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            onMouseEnter={() => setActive(i)}
            className={`pop-interactive flex h-14 w-14 items-center justify-center rounded-xl border font-display text-3xl transition-colors ${
              active === i ? 'border-ferrari-red bg-ferrari-red/10 text-ferrari-red' : 'border-line text-text-muted'
            }`}
          >
            {item.letter}
          </button>
        ))}
      </div>
      <div className="mt-4 rounded-xl border border-line bg-pitch-night-raised p-4">
        <h3 className="font-display text-xl tracking-wide text-gold">{LETTERS[active].title}</h3>
        <p className="mt-1 text-sm text-text-muted">{LETTERS[active].text}</p>
      </div>
    </div>
  );
}
