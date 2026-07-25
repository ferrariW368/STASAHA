export default function FootballIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 60" className={className} xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="50" cy="30" rx="48" ry="26" fill="currentColor" />
      <path d="M20 30 Q50 10 80 30 Q50 50 20 30 Z" fill="none" stroke="#fff" strokeWidth="2" opacity="0.7" />
      <line x1="35" y1="30" x2="65" y2="30" stroke="#fff" strokeWidth="2.5" />
      <line x1="42" y1="24" x2="42" y2="36" stroke="#fff" strokeWidth="2" />
      <line x1="50" y1="22" x2="50" y2="38" stroke="#fff" strokeWidth="2" />
      <line x1="58" y1="24" x2="58" y2="36" stroke="#fff" strokeWidth="2" />
    </svg>
  );
}
