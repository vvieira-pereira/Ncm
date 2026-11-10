/** Logotipo do Portal NCM: letras N, C e M em bloco extrudado 3D, com "Portal" acima. */
const N = "M0 36V0h7l12 22V0h7v36h-7L7 14v22Z";
const C = "M26 0H8Q0 0 0 8v20q0 8 8 8h18v-7H9q-2 0-2-2V9q0-2 2-2h17Z";
const M = "M0 36V0h8l10 19L28 0h8v36h-7V13L18 32 7 13v23Z";

function Letters({ fill, dx = 0, dy = 0 }: { fill: string; dx?: number; dy?: number }) {
  return (
    <g transform={`translate(${dx} ${dy})`} fill={fill}>
      <path transform="translate(4 6)" d={N} />
      <path transform="translate(38 6)" d={C} />
      <path transform="translate(72 6)" d={M} />
    </g>
  );
}

export function Logo({ size = 46 }: { size?: number }) {
  // size = altura aproximada do desenho das letras em px
  const h = size / 16;
  return (
    <span role="img" aria-label="Portal NCM" className="inline-flex flex-col items-start leading-none">
      <span aria-hidden className="ml-[0.15rem] text-[0.8rem] font-medium tracking-[0.16em] text-muted">
        Portal
      </span>
      <svg aria-hidden viewBox="2 4 114 46" style={{ width: `${(h * 114) / 46}rem`, height: `${h}rem` }} className="logo mt-0.5">
        <defs>
          <linearGradient id="ncm-face" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#8aa4f4" />
            <stop offset="1" stopColor="#3f62cf" />
          </linearGradient>
        </defs>
        {[9, 8, 7, 6, 5, 4, 3, 2, 1].map((i) => (
          <Letters key={i} fill={i > 6 ? "#16224f" : "#1f3170"} dx={i * 0.45} dy={i * 0.45} />
        ))}
        <Letters fill="url(#ncm-face)" />
      </svg>
    </span>
  );
}
