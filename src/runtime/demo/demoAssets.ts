/**
 * Graphics of the J1 demo scene, generated in memory (no image files).
 * Everything is deterministic (seeded noise) so every « Démarrer » looks the same.
 */

export const TILE = 32;

/** Tile indices in the demo tileset. */
export const DemoTile = {
    Empty: 0,
    Grass: 1,
    Dirt: 2,
    Brick: 3,
    Platform: 4,
    Stone: 5,
} as const;

/** Small deterministic pseudo-random generator (mulberry32). */
function rng(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return [c, c.getContext('2d')!];
}

/** Sprinkle 2×2 pixels of the given colours over a rectangle. */
function speckle(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    colors: string[],
    count: number,
    rand: () => number
): void {
    for (let i = 0; i < count; i++) {
        ctx.fillStyle = colors[Math.floor(rand() * colors.length)];
        ctx.fillRect(x + Math.floor(rand() * (w - 2)), y + Math.floor(rand() * (h - 2)), 2, 2);
    }
}

/** Tileset: one row of 32×32 tiles, indexed by `DemoTile`. */
export function makeTileset(): HTMLCanvasElement {
    const [c, ctx] = canvas(TILE * 8, TILE);
    const rand = rng(42);

    // Dirt (also under the grass)
    for (const t of [DemoTile.Grass, DemoTile.Dirt]) {
        const x = t * TILE;
        ctx.fillStyle = '#8a5a2b';
        ctx.fillRect(x, 0, TILE, TILE);
        speckle(ctx, x, 0, TILE, TILE, ['#6e4520', '#a06d3a', '#5a3818'], 40, rand);
    }
    // Grass top
    {
        const x = DemoTile.Grass * TILE;
        ctx.fillStyle = '#3fa34d';
        ctx.fillRect(x, 0, TILE, 9);
        for (let i = 0; i < TILE; i += 2) {
            ctx.fillRect(x + i, 9, 2, 1 + Math.floor(rand() * 4));
        }
        speckle(ctx, x, 0, TILE, 8, ['#5cc96b', '#2e7d3a'], 14, rand);
    }
    // Brick
    {
        const x = DemoTile.Brick * TILE;
        ctx.fillStyle = '#c9c0b0';
        ctx.fillRect(x, 0, TILE, TILE);
        ctx.fillStyle = '#b4432f';
        for (let row = 0; row < 4; row++) {
            const offset = row % 2 === 0 ? 0 : -8;
            for (let col = offset; col < TILE; col += 16) {
                const bx = Math.max(col, 0);
                const bw = Math.min(col + 15, TILE) - bx;
                ctx.fillRect(x + bx, row * 8, bw, 7);
            }
        }
        speckle(ctx, x, 0, TILE, TILE, ['#93321f', '#d65a43'], 20, rand);
    }
    // Wooden platform (semi-solid: only the top part is drawn)
    {
        const x = DemoTile.Platform * TILE;
        ctx.fillStyle = '#a8742f';
        ctx.fillRect(x, 0, TILE, 10);
        ctx.fillStyle = '#7a5020';
        ctx.fillRect(x, 10, TILE, 2);
        ctx.fillRect(x + 15, 0, 2, 10);
        ctx.fillStyle = '#c8924a';
        ctx.fillRect(x, 0, TILE, 2);
    }
    // Stone block
    {
        const x = DemoTile.Stone * TILE;
        ctx.fillStyle = '#7d8590';
        ctx.fillRect(x, 0, TILE, TILE);
        speckle(ctx, x, 0, TILE, TILE, ['#6a717b', '#959da8'], 30, rand);
        ctx.fillStyle = '#a9b1bb';
        ctx.fillRect(x, 0, TILE, 2);
        ctx.fillRect(x, 0, 2, TILE);
        ctx.fillStyle = '#545a63';
        ctx.fillRect(x, TILE - 2, TILE, 2);
        ctx.fillRect(x + TILE - 2, 0, 2, TILE);
    }
    return c;
}

/**
 * Sky, 640×480, seamless horizontally (all waves have a period dividing the width)
 * so it can be repeated by a parallax layer.
 */
export function makeSky(): HTMLCanvasElement {
    const W = 640;
    const H = 480;
    const [c, ctx] = canvas(W, H);

    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#2b6cc4');
    grad.addColorStop(1, '#bfe3ff');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#fff6c2';
    ctx.beginPath();
    ctx.arc(480, 90, 34, 0, Math.PI * 2);
    ctx.fill();

    const ridge = (base: number, amp: number, phase: number, color: string): void => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(0, H);
        for (let x = 0; x <= W; x += 4) {
            const k = (x / W) * Math.PI * 2;
            const y =
                base -
                amp * (0.6 * Math.sin(2 * k + phase) + 0.3 * Math.sin(5 * k + phase * 2)) -
                amp * 0.15 * Math.sin(11 * k);
            ctx.lineTo(x, Math.round(y / 4) * 4); // stepped edge for the pixel look
        }
        ctx.lineTo(W, H);
        ctx.closePath();
        ctx.fill();
    };
    ridge(330, 60, 0.4, '#8fa9d6');
    ridge(390, 45, 2.1, '#5f7fb8');

    const rand = rng(7);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    for (let i = 0; i < 5; i++) {
        const cx = 60 + i * 125 + rand() * 30;
        const cy = 60 + rand() * 120;
        for (let j = 0; j < 4; j++) {
            ctx.fillRect(Math.round(cx + j * 14 - 20), Math.round(cy - (j % 2) * 8), 34, 14);
        }
    }
    return c;
}

/** Player sheet, 6 frames: idle → / walk → ×2 / idle ← / walk ← ×2. */
export function makePlayerSheet(): HTMLCanvasElement {
    const [c, ctx] = canvas(TILE * 6, TILE);
    const drawFrame = (frame: number, step: number, facingLeft: boolean): void => {
        ctx.save();
        ctx.translate(frame * TILE, 0);
        if (facingLeft) {
            ctx.translate(TILE, 0);
            ctx.scale(-1, 1);
        }
        // Hair + head
        ctx.fillStyle = '#5a2d0c';
        ctx.fillRect(9, 2, 14, 6);
        ctx.fillRect(7, 4, 4, 12);
        ctx.fillStyle = '#f2c79a';
        ctx.fillRect(11, 6, 12, 9);
        ctx.fillStyle = '#1b1b2f';
        ctx.fillRect(19, 9, 2, 2);
        // Body
        ctx.fillStyle = '#e0457b';
        ctx.fillRect(10, 15, 13, 9);
        ctx.fillStyle = '#f2c79a';
        ctx.fillRect(step === 1 ? 22 : 21, 17, 3, 5);
        // Legs
        ctx.fillStyle = '#2e3a8c';
        if (step === 0) {
            ctx.fillRect(12, 24, 4, 8);
            ctx.fillRect(18, 24, 4, 8);
        } else if (step === 1) {
            ctx.fillRect(10, 24, 4, 7);
            ctx.fillRect(19, 24, 4, 8);
        } else {
            ctx.fillRect(13, 24, 4, 8);
            ctx.fillRect(16, 24, 4, 7);
        }
        ctx.restore();
    };
    drawFrame(0, 0, false);
    drawFrame(1, 1, false);
    drawFrame(2, 2, false);
    drawFrame(3, 0, true);
    drawFrame(4, 1, true);
    drawFrame(5, 2, true);
    return c;
}

/** Slime sheet, 2 frames (normal, squashed). */
export function makeSlimeSheet(): HTMLCanvasElement {
    const [c, ctx] = canvas(TILE * 2, TILE);
    const body = (x: number, top: number): void => {
        ctx.fillStyle = '#6bd16b';
        ctx.fillRect(x + 6, top + 2, 20, 32 - top - 2);
        ctx.fillRect(x + 4, top + 6, 24, 32 - top - 6);
        ctx.fillStyle = '#3e9b3e';
        ctx.fillRect(x + 4, 29, 24, 3);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + 10, top + 7, 4, 5);
        ctx.fillRect(x + 18, top + 7, 4, 5);
        ctx.fillStyle = '#1b1b2f';
        ctx.fillRect(x + 12, top + 9, 2, 3);
        ctx.fillRect(x + 20, top + 9, 2, 3);
    };
    body(0, 12);
    body(TILE, 16);
    return c;
}
