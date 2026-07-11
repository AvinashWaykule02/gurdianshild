/**
 * ShieldLogo — animated SVG shield icon for the brand header.
 */
export default function ShieldLogo({ className = '' }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`w-10 h-10 ${className}`}
    >
      {/* Outer shield shape */}
      <path
        d="M24 4L6 12v12c0 11.1 7.8 21.5 18 24 10.2-2.5 18-12.9 18-24V12L24 4z"
        fill="url(#shieldGrad)"
        stroke="url(#shieldStroke)"
        strokeWidth="1.5"
      />

      {/* Inner check / lock icon */}
      <path
        d="M17 24l4 4 10-10"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="drop-shadow-lg"
      />

      <defs>
        <linearGradient id="shieldGrad" x1="6" y1="4" x2="42" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3B7DFC" stopOpacity="0.9" />
          <stop offset="1" stopColor="#1A42DE" stopOpacity="0.7" />
        </linearGradient>
        <linearGradient id="shieldStroke" x1="6" y1="4" x2="42" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#59A1FF" />
          <stop offset="1" stopColor="#1F55F1" />
        </linearGradient>
      </defs>
    </svg>
  );
}
