import { PALETTE_SIZE } from './model';

/** DawnBringer's 32-colour palette: the heart of the default palette. */
const DB32 = [
    '#000000',
    '#222034',
    '#45283c',
    '#663931',
    '#8f563b',
    '#df7126',
    '#d9a066',
    '#eec39a',
    '#fbf236',
    '#99e550',
    '#6abe30',
    '#37946e',
    '#4b692f',
    '#524b24',
    '#323c39',
    '#3f3f74',
    '#306082',
    '#5b6ee1',
    '#639bff',
    '#5fcde4',
    '#cbdbfc',
    '#ffffff',
    '#9badb7',
    '#847e87',
    '#696a6a',
    '#595652',
    '#76428a',
    '#ac3232',
    '#d95763',
    '#d77bba',
    '#8f974a',
    '#8a6f30',
];

const hex = (n: number): string => Math.round(n).toString(16).padStart(2, '0');

/** Convert HSL (h in degrees, s and l in 0..1) to `#rrggbb`. */
function hsl(h: number, s: number, l: number): string {
    const a = s * Math.min(l, 1 - l);
    const f = (n: number): number => {
        const k = (n + h / 30) % 12;
        return 255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)));
    };
    return `#${hex(f(0))}${hex(f(8))}${hex(f(4))}`;
}

/**
 * Default project palette (256 colours):
 * - 0: transparent (stored as black);
 * - 1–32: DB32;
 * - 33–48: 16 greys from black to white;
 * - 49–255: 23 hues × 9 shades (dark to light).
 */
export function defaultPalette(): string[] {
    const palette = ['#000000', ...DB32];
    for (let i = 0; i < 16; i++) {
        const v = hex((i * 255) / 15);
        palette.push(`#${v}${v}${v}`);
    }
    for (let h = 0; h < 23; h++) {
        for (let shade = 0; shade < 9; shade++) {
            palette.push(hsl((h * 360) / 23, 0.75, 0.12 + shade * 0.095));
        }
    }
    if (palette.length !== PALETTE_SIZE) {
        throw new Error(`defaultPalette: ${palette.length} colours instead of ${PALETTE_SIZE}`);
    }
    return palette;
}

/** Index of the palette colour closest to `#rrggbb` (index 0, transparent, excluded). */
export function closestColor(palette: readonly string[], color: string): number {
    const rgb = (c: string): [number, number, number] => [
        parseInt(c.slice(1, 3), 16),
        parseInt(c.slice(3, 5), 16),
        parseInt(c.slice(5, 7), 16),
    ];
    const [r, g, b] = rgb(color);
    let best = 1;
    let bestDist = Infinity;
    for (let i = 1; i < palette.length; i++) {
        const [pr, pg, pb] = rgb(palette[i]);
        const d = (pr - r) ** 2 + (pg - g) ** 2 + (pb - b) ** 2;
        if (d < bestDist) {
            bestDist = d;
            best = i;
        }
    }
    return best;
}
