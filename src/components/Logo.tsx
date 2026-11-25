/**
 * The site's logo: its name, a scribble under it and a star, as if drawn by hand (the site's
 * personality: lively, warm and creative). `by` adds "by Teacher Clara" under it.
 */
export default function Logo({ className = '', by = false }: { className?: string; by?: boolean }) {
  return (
    <span className={`logo ${className}`}>
      <span className="logo-name">
        Funny <b>Games</b>
      </span>
      <svg className="logo-scribble" viewBox="0 0 250 18" preserveAspectRatio="none" aria-hidden>
        <path d="M4 11 C 50 3, 90 16, 135 8 S 215 4, 246 10" fill="none" stroke="var(--sun)" strokeWidth="6" strokeLinecap="round" />
      </svg>
      <svg className="logo-star" viewBox="0 0 40 40" aria-hidden>
        <path d="M20 3 L23 16 L36 20 L23 24 L20 37 L17 24 L4 20 L17 16 Z" fill="var(--mint)" stroke="var(--ink)" strokeWidth="3" strokeLinejoin="round" />
      </svg>
      {by && <span className="logo-by">by Teacher Clara</span>}
    </span>
  );
}
