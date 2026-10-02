/**
 * Level skies: a 640×480 picture generated from a few settings, drawn behind the level
 * and scrolled with parallax. Generation is deterministic (seeded) and the picture is
 * seamless horizontally, so it can be repeated while scrolling.
 */

export type SkyMode = 'landscape' | 'mosaic' | 'color';
export type SkyTime = 'morning' | 'afternoon' | 'evening' | 'night';
export type MosaicPattern = 'checker' | 'diamonds' | 'stripes' | 'dots';

export interface Sky {
    mode: SkyMode;
    time: SkyTime;
    /** Random seed: « nouveau tirage » changes it. */
    seed: number;
    mountains: boolean;
    hills: boolean;
    clouds: boolean;
    /** Sun by day, moon at night. */
    sunMoon: boolean;
    /** Only visible in the evening and at night. */
    stars: boolean;
    pattern: MosaicPattern;
    /** Colour of the « color » mode (`#rrggbb`). */
    color: string;
    /** Scroll speed relative to the level: 0 = fixed, 1 = moves with the level. */
    parallax: number;
}

export const SKY_WIDTH = 640;
export const SKY_HEIGHT = 480;

export const SKY_TIMES: { value: SkyTime; label: string }[] = [
    { value: 'morning', label: 'Matin' },
    { value: 'afternoon', label: 'Après-midi' },
    { value: 'evening', label: 'Soir' },
    { value: 'night', label: 'Nuit' },
];

export const MOSAIC_PATTERNS: { value: MosaicPattern; label: string }[] = [
    { value: 'checker', label: 'Damier' },
    { value: 'diamonds', label: 'Losanges' },
    { value: 'stripes', label: 'Rayures' },
    { value: 'dots', label: 'Pois' },
];

export function defaultSky(): Sky {
    return {
        mode: 'landscape',
        time: 'afternoon',
        seed: 1,
        mountains: true,
        hills: true,
        clouds: true,
        sunMoon: true,
        stars: true,
        pattern: 'checker',
        color: '#7ec8f0',
        parallax: 0.3,
    };
}

/** Keep known settings with valid values; missing or invalid ones get their default. */
export function normalizeSky(input: unknown): Sky {
    const sky = defaultSky();
    if (typeof input !== 'object' || input === null) return sky;
    const v = input as Record<string, unknown>;
    const pick = <T>(value: unknown, allowed: readonly T[], fallback: T): T =>
        allowed.includes(value as T) ? (value as T) : fallback;
    sky.mode = pick(v.mode, ['landscape', 'mosaic', 'color'] as const, sky.mode);
    sky.time = pick(
        v.time,
        SKY_TIMES.map((t) => t.value),
        sky.time
    );
    sky.pattern = pick(
        v.pattern,
        MOSAIC_PATTERNS.map((m) => m.value),
        sky.pattern
    );
    if (Number.isInteger(v.seed)) sky.seed = v.seed as number;
    for (const key of ['mountains', 'hills', 'clouds', 'sunMoon', 'stars'] as const) {
        if (typeof v[key] === 'boolean') sky[key] = v[key] as boolean;
    }
    if (typeof v.color === 'string' && /^#[0-9a-f]{6}$/i.test(v.color)) sky.color = v.color;
    if (typeof v.parallax === 'number' && Number.isFinite(v.parallax)) {
        sky.parallax = Math.min(1, Math.max(0, v.parallax));
    }
    return sky;
}

/** A sky of a single colour (used when migrating projects made before skies existed). */
export function colorSky(color: string): Sky {
    return { ...defaultSky(), mode: 'color', color };
}

/** Colours of each time of day. */
interface Palette {
    top: string;
    bottom: string;
    far: string;
    near: string;
    cloud: string;
    star: number;
}

const PALETTES: Record<SkyTime, Palette> = {
    morning: {
        top: '#78b4ea',
        bottom: '#ffd8b4',
        far: '#a7b4d8',
        near: '#6fa36a',
        cloud: '#fff6ee',
        star: 0,
    },
    afternoon: {
        top: '#2b6cc4',
        bottom: '#bfe3ff',
        far: '#7f9bd0',
        near: '#4e9a4a',
        cloud: '#ffffff',
        star: 0,
    },
    evening: {
        top: '#2a2350',
        bottom: '#ff9a5c',
        far: '#6b3f6e',
        near: '#3b2b4a',
        cloud: '#f2a0a8',
        star: 0.4,
    },
    night: {
        top: '#05071a',
        bottom: '#1e2c5e',
        far: '#1c2142',
        near: '#121a2c',
        cloud: '#4a5578',
        star: 1,
    },
};

/** Deterministic pseudo-random generator (mulberry32). */
export function seededRandom(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * Height of a ridge (mountains or hills) at every 4 px column, seamless over the width:
 * only sine waves whose period divides the width are summed.
 */
export function ridgeHeights(
    seed: number,
    base: number,
    amplitude: number,
    roughness: number,
    width = SKY_WIDTH
): number[] {
    const random = seededRandom(seed);
    const waves = [1, 2, 3, 5, 7, 11].map((k, i) => ({
        k,
        phase: random() * Math.PI * 2,
        weight: (random() * 0.5 + 0.5) / (1 + i * (1 - roughness) * 1.5),
    }));
    const total = waves.reduce((sum, w) => sum + w.weight, 0);
    const heights: number[] = [];
    for (let x = 0; x <= width; x += 4) {
        const t = (x / width) * Math.PI * 2;
        const v = waves.reduce((sum, w) => sum + w.weight * Math.sin(w.k * t + w.phase), 0) / total;
        heights.push(Math.round((base - v * amplitude) / 4) * 4); // stepped edge: pixel look
    }
    return heights;
}

const hex = (n: number) =>
    Math.round(Math.max(0, Math.min(255, n)))
        .toString(16)
        .padStart(2, '0');

/** Mix two `#rrggbb` colours (t = 0 → a, 1 → b). */
export function mixColor(a: string, b: string, t: number): string {
    const c = (s: string, i: number) => parseInt(s.slice(1 + i * 2, 3 + i * 2), 16);
    return `#${[0, 1, 2].map((i) => hex(c(a, i) + (c(b, i) - c(a, i)) * t)).join('')}`;
}

/** The dominant colour of a sky (for the level editor background). */
export function skyBaseColor(sky: Sky): string {
    if (sky.mode === 'color') return sky.color;
    const p = PALETTES[sky.time];
    return mixColor(p.top, p.bottom, 0.6);
}

/** Draw the sky into `ctx` (expected size: `SKY_WIDTH`×`SKY_HEIGHT`). */
export function drawSky(ctx: CanvasRenderingContext2D, sky: Sky): void {
    const W = SKY_WIDTH;
    const H = SKY_HEIGHT;
    const p = PALETTES[sky.time];

    if (sky.mode === 'color') {
        ctx.fillStyle = sky.color;
        ctx.fillRect(0, 0, W, H);
        return;
    }
    if (sky.mode === 'mosaic') {
        drawMosaic(
            ctx,
            sky.pattern,
            mixColor(p.top, p.bottom, 0.35),
            mixColor(p.top, p.bottom, 0.65)
        );
        return;
    }

    // Gradient in 16 flat bands, for a retro look.
    const BANDS = 16;
    for (let i = 0; i < BANDS; i++) {
        ctx.fillStyle = mixColor(p.top, p.bottom, i / (BANDS - 1));
        ctx.fillRect(0, Math.floor((i * H) / BANDS), W, Math.ceil(H / BANDS));
    }

    const random = seededRandom(sky.seed);

    if (sky.stars && p.star > 0) {
        const count = Math.round(140 * p.star);
        for (let i = 0; i < count; i++) {
            const big = random() < 0.1;
            ctx.fillStyle = random() < 0.5 ? '#ffffff' : '#c9d6ff';
            ctx.fillRect(
                Math.floor(random() * W),
                Math.floor(random() * H * 0.6),
                big ? 2 : 1,
                big ? 2 : 1
            );
        }
    }

    if (sky.sunMoon) {
        const x = 120 + Math.floor(random() * 400);
        const y = sky.time === 'afternoon' ? 70 : sky.time === 'night' ? 80 : 190;
        if (sky.time === 'night') {
            drawDisc(ctx, x, y, 26, '#f4f1d8');
            drawDisc(ctx, x + 12, y - 8, 22, p.top); // crescent
        } else {
            const sun = sky.time === 'evening' ? '#ffcf6b' : '#fff3b0';
            drawDisc(ctx, x, y, 34, sun);
        }
    }

    if (sky.clouds) {
        ctx.fillStyle = p.cloud;
        for (let i = 0; i < 6; i++) {
            const cx = Math.floor(random() * W);
            const cy = 40 + Math.floor(random() * 150);
            const parts = 3 + Math.floor(random() * 3);
            for (let j = 0; j < parts; j++) {
                const px = cx + j * 16 - parts * 8;
                const py = cy - (j % 2) * 8;
                // Also draw shifted by the width, so clouds crossing an edge stay seamless.
                for (const dx of [-W, 0, W]) {
                    ctx.fillRect(px + dx, py, 32, 14);
                }
            }
        }
    }

    if (sky.mountains) {
        drawRidge(ctx, ridgeHeights(sky.seed + 1, 300, 90, 0.9), p.far);
    }
    if (sky.hills) {
        drawRidge(ctx, ridgeHeights(sky.seed + 2, 400, 35, 0.2), p.near);
    }
}

/** Render a sky into a new canvas. */
export function renderSky(sky: Sky): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = SKY_WIDTH;
    canvas.height = SKY_HEIGHT;
    drawSky(canvas.getContext('2d')!, sky);
    return canvas;
}

/** Fill the area below a ridge (heights every 4 px). */
function drawRidge(ctx: CanvasRenderingContext2D, heights: number[], color: string): void {
    ctx.fillStyle = color;
    heights.forEach((h, i) => ctx.fillRect(i * 4, h, 4, SKY_HEIGHT - h));
}

/** A pixelated disc (rows of rectangles). */
function drawDisc(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    r: number,
    color: string
): void {
    ctx.fillStyle = color;
    for (let y = -r; y < r; y += 2) {
        const half = Math.floor(Math.sqrt(r * r - (y + 1) * (y + 1)) / 2) * 2;
        ctx.fillRect(cx - half, cy + y, half * 2, 2);
    }
}

/** A neutral tiled background in two tones (32 px tiles, so it repeats seamlessly). */
function drawMosaic(
    ctx: CanvasRenderingContext2D,
    pattern: MosaicPattern,
    a: string,
    b: string
): void {
    const T = 32;
    ctx.fillStyle = a;
    ctx.fillRect(0, 0, SKY_WIDTH, SKY_HEIGHT);
    ctx.fillStyle = b;
    for (let y = 0; y < SKY_HEIGHT; y += T) {
        for (let x = 0; x < SKY_WIDTH; x += T) {
            const odd = (x / T + y / T) % 2 === 1;
            switch (pattern) {
                case 'checker':
                    if (odd) ctx.fillRect(x, y, T, T);
                    break;
                case 'stripes':
                    ctx.fillRect(x, y, T, T / 4);
                    ctx.fillRect(x, y + T / 2, T, T / 4);
                    break;
                case 'dots':
                    ctx.fillRect(x + 12, y + 12, 8, 8);
                    break;
                case 'diamonds':
                    for (let i = 0; i < T / 2; i += 2) {
                        ctx.fillRect(x + T / 2 - i, y + i, i * 2, 2);
                        ctx.fillRect(x + T / 2 - i, y + T - i - 2, i * 2, 2);
                    }
                    break;
            }
        }
    }
}
