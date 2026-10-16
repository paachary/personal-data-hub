// scripts/generate-icon.js
// Generates build/icon.png, build/icon.ico, build/icon.icns
// Usage: node scripts/generate-icon.js

const sharp = require("sharp");
const { default: pngToIco } = require("png-to-ico");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const BUILD_DIR = path.join(__dirname, "..", "build");
const ICONSET_DIR = path.join(BUILD_DIR, "icon.iconset");
const SIZE = 1024;

// ── SVG definition ─────────────────────────────────────────────────────────

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <!-- Background radial glow -->
    <radialGradient id="bgGlow" cx="50%" cy="50%" r="55%">
      <stop offset="0%"  stop-color="#0c2044" stop-opacity="1"/>
      <stop offset="60%" stop-color="#071530" stop-opacity="1"/>
      <stop offset="100%" stop-color="#050c18" stop-opacity="1"/>
    </radialGradient>

    <!-- Center node glow filter -->
    <filter id="nodeGlow" x="-80%" y="-80%" width="260%" height="260%">
      <feGaussianBlur stdDeviation="22" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>

    <!-- Halo glow filter (large soft) -->
    <filter id="haloGlow" x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur stdDeviation="48" result="blur"/>
    </filter>

    <!-- Dot glow filter -->
    <filter id="dotGlow" x="-150%" y="-150%" width="400%" height="400%">
      <feGaussianBlur stdDeviation="8" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>

    <!-- Clip to rounded square -->
    <clipPath id="roundedSquare">
      <rect width="1024" height="1024" rx="220" ry="220"/>
    </clipPath>
  </defs>

  <!-- Rounded square background -->
  <rect width="1024" height="1024" rx="220" ry="220" fill="#050c18"/>
  <rect width="1024" height="1024" rx="220" ry="220" fill="url(#bgGlow)"/>

  <!-- Outer halo (large soft cyan glow behind everything) -->
  <circle cx="512" cy="512" r="260" fill="#0ea5e9" opacity="0.10" filter="url(#haloGlow)"/>
  <circle cx="512" cy="512" r="180" fill="#22d3ee" opacity="0.08" filter="url(#haloGlow)"/>

  <!-- ── Orbits ── (ellipses, each tilted at a different angle) -->

  <!-- Orbit 1 — Vault — blue -->
  <g transform="translate(512,512) rotate(-30)">
    <ellipse cx="0" cy="0" rx="175" ry="52"
      fill="none" stroke="#60a5fa" stroke-width="2.5" opacity="0.55"/>
    <!-- Satellite dots -->
    <circle cx="175" cy="0"   r="11" fill="#60a5fa" opacity="0.9" filter="url(#dotGlow)"/>
    <circle cx="-148" cy="-32" r="9"  fill="#60a5fa" opacity="0.9" filter="url(#dotGlow)"/>
  </g>

  <!-- Orbit 2 — Finance — emerald -->
  <g transform="translate(512,512) rotate(18)">
    <ellipse cx="0" cy="0" rx="255" ry="76"
      fill="none" stroke="#34d399" stroke-width="2.5" opacity="0.55"/>
    <circle cx="255"  cy="0"   r="12" fill="#34d399" opacity="0.9" filter="url(#dotGlow)"/>
    <circle cx="-220" cy="-38" r="10" fill="#34d399" opacity="0.9" filter="url(#dotGlow)"/>
    <circle cx="60"   cy="73"  r="9"  fill="#34d399" opacity="0.9" filter="url(#dotGlow)"/>
  </g>

  <!-- Orbit 3 — Notes — violet -->
  <g transform="translate(512,512) rotate(-52)">
    <ellipse cx="0" cy="0" rx="315" ry="94"
      fill="none" stroke="#a78bfa" stroke-width="2.5" opacity="0.50"/>
    <circle cx="315"  cy="0"   r="12" fill="#a78bfa" opacity="0.9" filter="url(#dotGlow)"/>
    <circle cx="-270" cy="-46" r="10" fill="#a78bfa" opacity="0.9" filter="url(#dotGlow)"/>
  </g>

  <!-- Orbit 4 — Todos — amber -->
  <g transform="translate(512,512) rotate(38)">
    <ellipse cx="0" cy="0" rx="372" ry="112"
      fill="none" stroke="#fbbf24" stroke-width="2.5" opacity="0.45"/>
    <circle cx="372"  cy="0"   r="13" fill="#fbbf24" opacity="0.9" filter="url(#dotGlow)"/>
    <circle cx="-340" cy="-54" r="10" fill="#fbbf24" opacity="0.9" filter="url(#dotGlow)"/>
    <circle cx="80"   cy="108" r="9"  fill="#fbbf24" opacity="0.9" filter="url(#dotGlow)"/>
  </g>

  <!-- Orbit 5 — Settings/Admin — slate -->
  <g transform="translate(512,512) rotate(-15)">
    <ellipse cx="0" cy="0" rx="435" ry="130"
      fill="none" stroke="#94a3b8" stroke-width="2"  opacity="0.38"/>
    <circle cx="435"  cy="0"   r="11" fill="#94a3b8" opacity="0.85" filter="url(#dotGlow)"/>
    <circle cx="-400" cy="-62" r="9"  fill="#94a3b8" opacity="0.85" filter="url(#dotGlow)"/>
  </g>

  <!-- ── Center node ── -->
  <!-- Outer glow rings -->
  <circle cx="512" cy="512" r="95" fill="#22d3ee" opacity="0.12" filter="url(#haloGlow)"/>
  <circle cx="512" cy="512" r="68" fill="#22d3ee" opacity="0.20" filter="url(#haloGlow)"/>

  <!-- Main node circle -->
  <circle cx="512" cy="512" r="52" fill="#0891b2" filter="url(#nodeGlow)"/>
  <circle cx="512" cy="512" r="52" fill="url(#nodeGrad)"/>

  <!-- Node gradient definition -->
  <defs>
    <radialGradient id="nodeGrad" cx="38%" cy="32%" r="65%">
      <stop offset="0%"  stop-color="#a5f3fc"/>
      <stop offset="40%" stop-color="#22d3ee"/>
      <stop offset="100%" stop-color="#0e7490"/>
    </radialGradient>
  </defs>

  <!-- Node highlight shimmer -->
  <ellipse cx="498" cy="494" rx="22" ry="14" fill="white" opacity="0.28" transform="rotate(-30,498,494)"/>

  <!-- Lock keyhole inside center node -->
  <!-- Lock body -->
  <rect x="499" y="516" width="26" height="20" rx="4" fill="white" opacity="0.85"/>
  <!-- Lock shackle -->
  <path d="M504 516 L504 508 A8 8 0 0 1 520 508 L520 516"
    fill="none" stroke="white" stroke-width="4" stroke-linecap="round" opacity="0.85"/>
  <!-- Keyhole dot -->
  <circle cx="512" cy="524" r="3.5" fill="#050c18" opacity="0.75"/>
</svg>`;

// ── Helpers ────────────────────────────────────────────────────────────────

async function svgToPng(svgStr, size) {
    return sharp(Buffer.from(svgStr)).resize(size, size).png().toBuffer();
}

// ── Main ───────────────────────────────────────────────────────────────────

(async () => {
    // Ensure directories exist
    fs.mkdirSync(BUILD_DIR, { recursive: true });
    fs.mkdirSync(ICONSET_DIR, { recursive: true });

    // console.log("Generating 1024×1024 master PNG…");
    // const master = await svgToPng(svg, SIZE);
    // fs.writeFileSync(path.join(BUILD_DIR, "icon.png"), master);
    // console.log("  ✓ build/icon.png");

    // ── macOS iconset sizes ─────────────────────────────────────────────
    const macSizes = [
        { file: "icon_16x16.png", size: 16 },
        { file: "icon_16x16@2x.png", size: 32 },
        { file: "icon_32x32.png", size: 32 },
        { file: "icon_32x32@2x.png", size: 64 },
        { file: "icon_128x128.png", size: 128 },
        { file: "icon_128x128@2x.png", size: 256 },
        { file: "icon_256x256.png", size: 256 },
        { file: "icon_256x256@2x.png", size: 512 },
        { file: "icon_512x512.png", size: 512 },
        { file: "icon_512x512@2x.png", size: 1024 },
    ];

    // console.log("Generating macOS iconset…");
    for (const { file, size } of macSizes) {
        const buf = await svgToPng(svg, size);
        fs.writeFileSync(path.join(ICONSET_DIR, file), buf);
        // console.log(`  ✓ ${file}`);
    }

    // ── .icns via iconutil ──────────────────────────────────────────────
    // console.log("Building icon.icns via iconutil…");
    execSync(
        `iconutil -c icns "${ICONSET_DIR}" -o "${path.join(BUILD_DIR, "icon.icns")}"`,
    );
    // console.log("  ✓ build/icon.icns");

    // ── Windows .ico (multi-size) ───────────────────────────────────────
    // console.log("Building icon.ico…");
    const icoSizes = [16, 24, 32, 48, 64, 128, 256];
    const icoBuffers = await Promise.all(icoSizes.map((s) => svgToPng(svg, s)));
    const icoBuffer = await pngToIco(icoBuffers);
    fs.writeFileSync(path.join(BUILD_DIR, "icon.ico"), icoBuffer);
    // console.log("  ✓ build/icon.ico");

    // console.log("\nDone. All icon assets written to build/");
})();
