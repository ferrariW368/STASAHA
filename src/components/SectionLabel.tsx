export default function SectionLabel({ number, label }: { number: string; label: string }) {
  return (
    <p className="mb-1 font-display text-xs tracking-[0.3em] text-ferrari-red">
      {number} — {label}
    </p>
  );
}
