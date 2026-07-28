import { cn } from '@/lib/utils'

/** Monogramme PROINSEC : un bouclier (prévention/sécurité) portant les
 *  initiales, décliné dans le bleu de marque avec l'accent orange. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-8', className)} aria-hidden>
      <defs>
        <linearGradient id="marque-degrade" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0086d1" />
          <stop offset="100%" stopColor="#00568a" />
        </linearGradient>
      </defs>
      <path
        d="M16 1.5 4.5 5.4v10.3c0 6.6 4.6 12.7 11.5 14.8 6.9-2.1 11.5-8.2 11.5-14.8V5.4L16 1.5Z"
        fill="url(#marque-degrade)"
      />
      <path
        d="M16 1.5 4.5 5.4v10.3c0 6.6 4.6 12.7 11.5 14.8V1.5Z"
        fill="#fff"
        fillOpacity="0.08"
      />
      <path d="M10.6 16.6 14.4 20.4 21.9 12.6" stroke="#fff" strokeWidth="2.6"
        strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="24.4" cy="7.6" r="3" fill="#ff6900" />
    </svg>
  )
}

export function Marque({ compact }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5 overflow-hidden">
      <Logo className="size-8 shrink-0" />
      {!compact && (
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-[0.9375rem] font-bold tracking-tight text-texte">
            PROINSEC
          </span>
          <span className="block truncate text-[0.6875rem] font-medium text-doux">
            Veille formations
          </span>
        </span>
      )}
    </span>
  )
}
