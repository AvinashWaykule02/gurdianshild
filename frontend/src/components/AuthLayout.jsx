import ShieldLogo from './ShieldLogo';

/**
 * AuthLayout — shared wrapper for Login & Signup pages.
 * Renders the gradient background, grid overlay, floating orbs,
 * brand header, and a centered glass card.
 */
export default function AuthLayout({ children, title, subtitle }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-auth-gradient bg-grid-overlay px-4 py-12">
      {/* Decorative orbs */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/4 h-[420px] w-[420px] rounded-full bg-shield-600/[0.07] blur-[100px] animate-pulse-slow"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 right-1/4 h-[340px] w-[340px] rounded-full bg-shield-400/[0.05] blur-[90px] animate-float"
      />

      {/* Card */}
      <div className="glass-card relative z-10 w-full max-w-[420px] animate-slide-up">
        {/* Top glow bar */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-shield-400/40 to-transparent" />

        <div className="px-8 pt-10 pb-8">
          {/* Brand header */}
          <div className="mb-8 flex flex-col items-center gap-3">
            <div className="rounded-2xl border border-white/[0.06] bg-surface-700/40 p-3 shadow-lg shadow-shield-600/10">
              <ShieldLogo />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm text-gray-400 text-center leading-relaxed max-w-[280px]">
                {subtitle}
              </p>
            )}
          </div>

          {children}
        </div>

        {/* Bottom decorative line */}
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" />
      </div>

      {/* Footer */}
      <p className="absolute bottom-6 text-xs text-gray-600">
        GuardianShield &copy; {new Date().getFullYear()}
      </p>
    </div>
  );
}
