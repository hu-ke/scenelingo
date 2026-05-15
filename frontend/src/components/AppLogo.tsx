import React from 'react';

interface AppLogoProps {
  /** Logo size in pixels, default 56 */
  size?: number;
  /** Enable subtle pulse/breathing animation */
  animated?: boolean;
}

/**
 * SceneLingo (场景英语) App Logo
 *
 * Visual metaphor: a magnifying glass (exploration/discovery through photography)
 * containing a stylized letter "A" (language/alphabet learning).
 * The handle incorporates camera shutter blade motifs.
 * A dotted focus ring surrounds the glass like a camera focus indicator.
 */
const AppLogo: React.FC<AppLogoProps> = ({ size = 56, animated = false }) => {
  return (
    <div
      style={{
        width: size,
        height: size,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...(animated
          ? { animation: 'logoPulse 2s ease-in-out infinite' }
          : undefined),
      }}
    >
      {animated && (
        <style
          dangerouslySetInnerHTML={{
            __html: `
              @keyframes logoPulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.05); }
              }
            `,
          }}
        />
      )}

      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="SceneLingo Logo"
        role="img"
      >
        <defs>
          {/* Diagonal gradient: primary-start (red) -> primary-mid (orange) */}
          <linearGradient
            id="appLogoGradient"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop
              offset="0%"
              style={{ stopColor: 'var(--color-primary-start)' }}
            />
            <stop
              offset="100%"
              style={{ stopColor: 'var(--color-primary-mid)' }}
            />
          </linearGradient>
        </defs>

        {/* ---- Focus ring (camera focus indicator) ---- */}
        <circle
          cx="19"
          cy="19"
          r="15.5"
          fill="none"
          stroke="var(--color-primary-start)"
          strokeWidth="0.8"
          strokeDasharray="2 3.5"
          opacity="0.35"
        />

        {/* ---- Magnifying glass outer ring ---- */}
        <circle
          cx="19"
          cy="19"
          r="11.5"
          fill="none"
          stroke="url(#appLogoGradient)"
          strokeWidth="3"
        />

        {/* ---- Glass interior (light/white background) ---- */}
        <circle
          cx="19"
          cy="19"
          r="10"
          fill="white"
        />

        {/* ---- Stylized letter "A" ---- */}
        <g stroke="url(#appLogoGradient)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          {/* Left leg */}
          <path d="M19 13 L14 24.5" />
          {/* Right leg */}
          <path d="M19 13 L24 24.5" />
          {/* Crossbar */}
          <path d="M15.5 19 L22.5 19" />
        </g>

        {/* ---- Handle (extends from glass to lower-right) ---- */}
        <line
          x1="28"
          y1="28"
          x2="43"
          y2="40.5"
          stroke="url(#appLogoGradient)"
          strokeWidth="7"
          strokeLinecap="round"
        />

        {/* ---- Shutter blade motif lines on handle ---- */}
        <g
          stroke="white"
          strokeWidth="1"
          opacity="0.55"
          strokeLinecap="round"
        >
          <line x1="30.5" y1="29.5" x2="33" y2="27" />
          <line x1="34.5" y1="32.5" x2="37" y2="30" />
          <line x1="38.5" y1="35.5" x2="41" y2="33" />
        </g>
      </svg>
    </div>
  );
};

export default AppLogo;