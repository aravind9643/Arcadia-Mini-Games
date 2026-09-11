/**
 * Flags drawn as inline SVG rather than fetched images, so the game works
 * offline and renders identically everywhere. Limited to designs that are
 * simple bands, crosses or discs — reproducing ornate coats of arms would
 * be misleading rather than helpful.
 */
export type Flag = { country: string; svg: string }

/** viewBox is 30x20 for every flag. */
const V = 'viewBox="0 0 30 20"'

const bandsV = (a: string, b: string, c: string) =>
  `<svg ${V}><rect width="10" height="20" fill="${a}"/><rect x="10" width="10" height="20" fill="${b}"/><rect x="20" width="10" height="20" fill="${c}"/></svg>`

const bandsH = (a: string, b: string, c: string) =>
  `<svg ${V}><rect width="30" height="6.67" fill="${a}"/><rect y="6.67" width="30" height="6.67" fill="${b}"/><rect y="13.33" width="30" height="6.67" fill="${c}"/></svg>`

const halvesH = (a: string, b: string) =>
  `<svg ${V}><rect width="30" height="10" fill="${a}"/><rect y="10" width="30" height="10" fill="${b}"/></svg>`

/** Nordic cross: offset toward the hoist, as on the real flags. */
const nordic = (bg: string, cross: string, inner?: string) =>
  `<svg ${V}><rect width="30" height="20" fill="${bg}"/>` +
  `<rect x="9" width="4" height="20" fill="${cross}"/><rect y="8" width="30" height="4" fill="${cross}"/>` +
  (inner
    ? `<rect x="10" width="2" height="20" fill="${inner}"/><rect y="9" width="30" height="2" fill="${inner}"/>`
    : '') +
  `</svg>`

export const FLAGS: Flag[] = [
  { country: 'France', svg: bandsV('#0055a4', '#ffffff', '#ef4135') },
  { country: 'Italy', svg: bandsV('#009246', '#ffffff', '#ce2b37') },
  { country: 'Ireland', svg: bandsV('#169b62', '#ffffff', '#ff883e') },
  { country: 'Belgium', svg: bandsV('#000000', '#fdda24', '#ef3340') },
  { country: 'Romania', svg: bandsV('#002b7f', '#fcd116', '#ce1126') },
  { country: 'Nigeria', svg: bandsV('#008751', '#ffffff', '#008751') },
  { country: 'Peru', svg: bandsV('#d91023', '#ffffff', '#d91023') },
  { country: 'Germany', svg: bandsH('#000000', '#dd0000', '#ffce00') },
  { country: 'Netherlands', svg: bandsH('#ae1c28', '#ffffff', '#21468b') },
  { country: 'Russia', svg: bandsH('#ffffff', '#0039a6', '#d52b1e') },
  { country: 'Austria', svg: bandsH('#ed2939', '#ffffff', '#ed2939') },
  { country: 'Hungary', svg: bandsH('#ce2939', '#ffffff', '#477050') },
  { country: 'Bulgaria', svg: bandsH('#ffffff', '#00966e', '#d62612') },
  { country: 'Colombia', svg: `<svg ${V}><rect width="30" height="10" fill="#fcd116"/><rect y="10" width="30" height="5" fill="#003893"/><rect y="15" width="30" height="5" fill="#ce1126"/></svg>` },
  { country: 'Poland', svg: halvesH('#ffffff', '#dc143c') },
  { country: 'Indonesia', svg: halvesH('#ce1126', '#ffffff') },
  { country: 'Ukraine', svg: halvesH('#0057b7', '#ffd700') },
  { country: 'Sweden', svg: nordic('#006aa7', '#fecc00') },
  { country: 'Denmark', svg: nordic('#c8102e', '#ffffff') },
  { country: 'Finland', svg: nordic('#ffffff', '#003580') },
  { country: 'Norway', svg: nordic('#ba0c2f', '#ffffff', '#00205b') },
  { country: 'Iceland', svg: nordic('#02529c', '#ffffff', '#dc1e35') },
  {
    country: 'Japan',
    svg: `<svg ${V}><rect width="30" height="20" fill="#ffffff"/><circle cx="15" cy="10" r="6" fill="#bc002d"/></svg>`,
  },
  {
    country: 'Bangladesh',
    svg: `<svg ${V}><rect width="30" height="20" fill="#006a4e"/><circle cx="13.5" cy="10" r="6" fill="#f42a41"/></svg>`,
  },
  {
    country: 'Palau',
    svg: `<svg ${V}><rect width="30" height="20" fill="#4aadd6"/><circle cx="13" cy="10" r="5.5" fill="#ffde00"/></svg>`,
  },
  {
    country: 'Switzerland',
    svg: `<svg ${V}><rect width="30" height="20" fill="#d52b1e"/><rect x="13" y="4" width="4" height="12" fill="#fff"/><rect x="9" y="8" width="12" height="4" fill="#fff"/></svg>`,
  },
  {
    country: 'Canada',
    svg: `<svg ${V}><rect width="30" height="20" fill="#fff"/><rect width="7.5" height="20" fill="#d52b1e"/><rect x="22.5" width="7.5" height="20" fill="#d52b1e"/><path d="M15 5.2l1.1 2.3 2.4-.6-.8 2.4 1.9 1.3-2.3.9.3 2.5-2.1-1.3-1.3 1.9-.3-2.4-2.4.4 1.2-2.2-2-1.4 2.3-.9-.5-2.4 2.3.9z" fill="#d52b1e"/></svg>`,
  },
  {
    country: 'Greece',
    svg: `<svg ${V}><rect width="30" height="20" fill="#fff"/>${[0, 2, 4, 6, 8]
      .map((i) => `<rect y="${i * 2.22}" width="30" height="2.22" fill="#0d5eaf"/>`)
      .join('')}<rect width="12.2" height="11.1" fill="#0d5eaf"/><rect x="4.9" width="2.4" height="11.1" fill="#fff"/><rect y="4.35" width="12.2" height="2.4" fill="#fff"/></svg>`,
  },
  {
    country: 'Brazil',
    svg: `<svg ${V}><rect width="30" height="20" fill="#009c3b"/><path d="M15 2.5 27.5 10 15 17.5 2.5 10Z" fill="#ffdf00"/><circle cx="15" cy="10" r="4.4" fill="#002776"/></svg>`,
  },
  {
    country: 'Portugal',
    svg: `<svg ${V}><rect width="30" height="20" fill="#da291c"/><rect width="12" height="20" fill="#046a38"/><circle cx="12" cy="10" r="4" fill="#ffe900"/><circle cx="12" cy="10" r="2.6" fill="#da291c"/></svg>`,
  },
  {
    country: 'Spain',
    svg: `<svg ${V}><rect width="30" height="20" fill="#c60b1e"/><rect y="5" width="30" height="10" fill="#ffc400"/></svg>`,
  },
  {
    country: 'Argentina',
    svg: `<svg ${V}><rect width="30" height="20" fill="#fff"/><rect width="30" height="6.67" fill="#74acdf"/><rect y="13.33" width="30" height="6.67" fill="#74acdf"/><circle cx="15" cy="10" r="2.6" fill="#f6b40e"/></svg>`,
  },
  {
    country: 'Thailand',
    svg: `<svg ${V}><rect width="30" height="20" fill="#a51931"/><rect y="3.33" width="30" height="13.34" fill="#f4f5f8"/><rect y="6.67" width="30" height="6.66" fill="#2d2a4a"/></svg>`,
  },
  {
    country: 'Vietnam',
    svg: `<svg ${V}><rect width="30" height="20" fill="#da251d"/><path d="M15 5.5l1.5 4.6h4.8l-3.9 2.8 1.5 4.6-3.9-2.9-3.9 2.9 1.5-4.6-3.9-2.8h4.8z" fill="#ff0"/></svg>`,
  },
  {
    country: 'Jamaica',
    svg: `<svg ${V}><rect width="30" height="20" fill="#009b3a"/><path d="M0 0 30 20M30 0 0 20" stroke="#fed100" stroke-width="4"/><path d="M0 0 12 10 0 20Z" fill="#000"/><path d="M30 0 18 10 30 20Z" fill="#000"/></svg>`,
  },
  {
    country: 'Czechia',
    svg: `<svg ${V}><rect width="30" height="10" fill="#fff"/><rect y="10" width="30" height="10" fill="#d7141a"/><path d="M0 0 15 10 0 20Z" fill="#11457e"/></svg>`,
  },
  {
    country: 'Turkey',
    svg: `<svg ${V}><rect width="30" height="20" fill="#e30a17"/><circle cx="12" cy="10" r="5" fill="#fff"/><circle cx="13.6" cy="10" r="4" fill="#e30a17"/><path d="M17.6 10l3.4-1.1-2.1 2.9V7.2l2.1 2.9z" fill="#fff"/></svg>`,
  },
  {
    country: 'Australia',
    svg: `<svg ${V}><rect width="30" height="20" fill="#00008b"/><rect width="15" height="10" fill="#00247d"/><path d="M0 0 15 10M15 0 0 10" stroke="#fff" stroke-width="2"/><path d="M7.5 0v10M0 5h15" stroke="#fff" stroke-width="3"/><path d="M7.5 0v10M0 5h15" stroke="#cf142b" stroke-width="1.6"/><circle cx="22" cy="13" r="1.4" fill="#fff"/><circle cx="7.5" cy="15" r="1.6" fill="#fff"/></svg>`,
  },
  {
    country: 'South Korea',
    svg: `<svg ${V}><rect width="30" height="20" fill="#fff"/><circle cx="15" cy="10" r="4.4" fill="#cd2e3a"/><path d="M10.6 10a4.4 4.4 0 0 1 8.8 0 2.2 2.2 0 0 1-4.4 0 2.2 2.2 0 0 0-4.4 0Z" fill="#0047a0"/></svg>`,
  },
  {
    country: 'Morocco',
    svg: `<svg ${V}><rect width="30" height="20" fill="#c1272d"/><path d="M15 5.6l1.4 4.4h4.6l-3.7 2.7 1.4 4.4-3.7-2.7-3.7 2.7 1.4-4.4-3.7-2.7h4.6z" fill="none" stroke="#006233" stroke-width="1"/></svg>`,
  },
]

export const randomFlags = (n: number): Flag[] => {
  const pool = [...FLAGS]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, n)
}

/** Three plausible wrong answers plus the right one, shuffled. */
export function optionsFor(answer: Flag): string[] {
  const others = FLAGS.filter((f) => f.country !== answer.country)
  const picks: string[] = []
  while (picks.length < 3 && others.length) {
    const i = Math.floor(Math.random() * others.length)
    picks.push(others.splice(i, 1)[0].country)
  }
  const all = [...picks, answer.country]
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[all[i], all[j]] = [all[j], all[i]]
  }
  return all
}
