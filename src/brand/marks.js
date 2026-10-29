// Brand assets. The Rework Rescue logo is FINAL and locked: the PNG files in assets/brand/ are crops of the
// supplied artwork and must not be redrawn, recoloured or re-proportioned. A vector (SVG) production version
// will replace them later. Nothing here generates or alters the logo.

export const BRAND_COLORS = [
  ['sw-deep', 'Deep teal', '#0F3A3A', 'Primary. Headings, body text, dark sections.'],
  ['sw-teal', 'Teal green', '#2E7D72', 'Secondary. Buttons and links. White text on it passes AA.'],
  ['sw-mint', 'Mint green', '#78C2A4', 'Accent. Highlights and illustration. Not for small text on light backgrounds.'],
  ['sw-gold', 'Warm gold', '#E6C078', 'Highlight. Borders and fills. Use dark text on it.'],
  ['sw-ivory', 'Warm ivory', '#F8F7ED', 'Page background.'],
];

export const LOGO = {
  header: { file: 'logo-header.png', width: 717, height: 214 },
  headerDark: { file: 'logo-dark-header.png', width: 616, height: 179 },
  full: { file: 'logo.png', width: 717, height: 231 },
  fullDark: { file: 'logo-dark.png', width: 616, height: 203 },
  mark: { file: 'mark.png', width: 324, height: 214 },
};

/** Logo image for the header (light) or footer (dark). `up` is the relative path to the site root. */
export function logoImg(up, kind = 'header', { decorative = false, cls = 'brand-logo' } = {}) {
  const l = LOGO[kind];
  return `<img class="${cls}" src="${up}assets/brand/${l.file}" width="${l.width}" height="${l.height}" alt="${decorative ? '' : 'Rework Rescue: Less rework. More real work.'}">`;
}

/** Favicon and touch icon links (simple crops of the existing mark, not a redesign). */
export function faviconLinks(up) {
  return `<link rel="icon" type="image/png" sizes="32x32" href="${up}assets/brand/favicon-32.png">
  <link rel="icon" type="image/png" sizes="64x64" href="${up}assets/brand/favicon-64.png">
  <link rel="apple-touch-icon" href="${up}assets/brand/apple-touch-icon.png">`;
}
