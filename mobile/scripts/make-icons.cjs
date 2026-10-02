// Renders the app icon (1024, opaque) and splash mark from SVG: one glowing amber dot on the night background.
// Uses sharp from the sibling backend folder (not an app dependency): node scripts/make-icons.cjs
const path = require("path");
const sharp = require(path.join(__dirname, "../../backend/node_modules/sharp"));

const BG = "#0A0A0D";
const ACCENT = "#FFB224";

const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${ACCENT}" stop-opacity="0.55"/>
      <stop offset="35%" stop-color="${ACCENT}" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="${ACCENT}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1024" height="1024" fill="${BG}"/>
  <circle cx="512" cy="512" r="420" fill="url(#glow)"/>
  <circle cx="512" cy="512" r="118" fill="${ACCENT}"/>
</svg>`;

const splash = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${ACCENT}" stop-opacity="0.5"/>
      <stop offset="40%" stop-color="${ACCENT}" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="${ACCENT}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <circle cx="256" cy="256" r="240" fill="url(#glow)"/>
  <circle cx="256" cy="256" r="64" fill="${ACCENT}"/>
</svg>`;

(async () => {
  const out = path.join(__dirname, "../assets/images");
  await sharp(Buffer.from(icon)).flatten({ background: BG }).removeAlpha().png().toFile(path.join(out, "icon.png"));
  await sharp(Buffer.from(splash)).png().toFile(path.join(out, "splash-icon.png"));
  console.log("icons written");
})();
