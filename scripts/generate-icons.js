// code-guard: intentional-duplicate - Node's `path` module and short local names fuzzy-match UI identifiers; no logic is duplicated.
// Renders the app icons and splash image from the brand SVGs in assets/brand/ (logo.svg = src/ui/logo-full.tsx,
// logo-mark.svg = src/ui/logo.tsx, logo-monochrome.svg = line art for Android themed icons).
//
// The renderer (@resvg/resvg-js) is NOT an app dependency. Install it anywhere temporary and point NODE_PATH at it:
//   npm i --prefix <tmp> @resvg/resvg-js@2.6.2
//   NODE_PATH=<tmp>/node_modules node scripts/generate-icons.js
//
// Android adaptive icon: 1024×1024 layers; only the centre circle (66/108 of the side) is always visible, so the
// logo's farthest point (rope ends, ~129 viewBox units from the centre) is kept inside that circle.
const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

const root = path.join(__dirname, '..');
const PAPER = '#FBF5E6'; // = app.json android.adaptiveIcon.backgroundColor and splash backgroundColor
const VIEWBOX = { x: -12, y: 0, w: 264, h: 240 };
const LOGO_RADIUS = 129; // farthest painted point from the logo centre (120,120), in viewBox units

const inner = (file) => {
  const svg = fs.readFileSync(path.join(root, 'assets/brand', file), 'utf8');
  return svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
};

/** An SVG canvas size×size with the logo (logoWidth px wide) centred; optional solid background. */
const canvas = ({ size, height = size, logo, logoWidth, background }) => {
  const logoHeight = (logoWidth * VIEWBOX.h) / VIEWBOX.w;
  const x = (size - logoWidth) / 2;
  const y = (height - logoHeight) / 2;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${height}" viewBox="0 0 ${size} ${height}">`,
    background ? `<rect width="${size}" height="${height}" fill="${background}"/>` : '',
    `<svg x="${x}" y="${y}" width="${logoWidth}" height="${logoHeight}" viewBox="${VIEWBOX.x} ${VIEWBOX.y} ${VIEWBOX.w} ${VIEWBOX.h}">${inner(logo)}</svg>`,
    '</svg>',
  ].join('');
};

const write = (out, svg) => {
  const png = new Resvg(svg, { fitTo: { mode: 'original' } }).render().asPng();
  fs.writeFileSync(path.join(root, 'assets/images', out), png);
  console.log(`${out}: ${png.length} B`);
};

// Logo width that keeps the logo inside the adaptive-icon safe circle (diameter 66/108 of 1024 px).
const SAFE_RADIUS = (1024 * 66) / 108 / 2;
const adaptiveLogoWidth = Math.floor((SAFE_RADIUS / LOGO_RADIUS) * VIEWBOX.w * 0.96);

write('icon.png', canvas({ size: 1024, logo: 'logo.svg', logoWidth: 800, background: PAPER }));
write('android-icon-foreground.png', canvas({ size: 1024, logo: 'logo.svg', logoWidth: adaptiveLogoWidth }));
write('android-icon-background.png', `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="${PAPER}"/></svg>`);
write('android-icon-monochrome.png', canvas({ size: 1024, logo: 'logo-monochrome.svg', logoWidth: adaptiveLogoWidth }));
write('splash-icon.png', canvas({ size: 1024, height: Math.round((1024 * VIEWBOX.h) / VIEWBOX.w), logo: 'logo.svg', logoWidth: 1024 }));
write('favicon.png', canvas({ size: 48, logo: 'logo-mark.svg', logoWidth: 46 }));
console.log(`adaptive logo width: ${adaptiveLogoWidth} px (safe radius ${SAFE_RADIUS.toFixed(0)} px)`);
