export default function F1Car({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 60" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="16" width="7" height="20" rx="1.5" fill="currentColor" />
      <rect x="0" y="12" width="16" height="5" rx="1.5" fill="currentColor" />
      <path d="M12 36 L18 26 Q38 17 88 19 L142 22 Q162 22 178 32 L184 38 L184 44 L12 44 Z" fill="currentColor" />
      <path d="M82 19 Q94 6 112 11 L120 21 Z" fill="currentColor" opacity="0.8" />
      <rect x="180" y="32" width="18" height="5" rx="1.5" fill="currentColor" />
      <circle cx="42" cy="46" r="11" fill="#0a0a0a" />
      <circle cx="42" cy="46" r="4.5" fill="#525252" />
      <circle cx="148" cy="46" r="11" fill="#0a0a0a" />
      <circle cx="148" cy="46" r="4.5" fill="#525252" />
    </svg>
  );
}
