/**
 * NES-style texture generator for BOB (after docs/nes-tile-generator).
 *
 * Each material draws a small grid of « tones » (0 = dark, 1 = base, 2 = light, and
 * sometimes 3) at a coarse resolution (8 or 16 pixels across), which is then scaled up
 * to 32×32 and coloured with three or four NES colours. Tiling materials wrap around
 * their edges, so they join seamlessly. There is nothing to tune: pick a material and
 * one of its variants (seeds).
 */
import { ASSET_SIZE, TRANSPARENT, type BobCollision, type Frame } from './model';
import { closestColor, NES_PALETTE } from './palette';
import { seededRandom } from './sky';

/** Tone value meaning « transparent pixel ». */
export const CLEAR = 255;

type Random = () => number;
type Tones = Uint8Array;

/** A drawing grid of `n`×`n` tones that wraps around its edges. */
class Grid {
    readonly g: Tones;

    constructor(
        readonly n: number,
        fill = 1
    ) {
        this.g = new Uint8Array(n * n).fill(fill);
    }

    private _i(x: number, y: number): number {
        const n = this.n;
        return mod(Math.round(y), n) * n + mod(Math.round(x), n);
    }

    set(x: number, y: number, v: number): void {
        this.g[this._i(x, y)] = v;
    }

    get(x: number, y: number): number {
        return this.g[this._i(x, y)];
    }

    /** Set a pixel only if it is inside the grid (no wrapping: for decorations). */
    put(x: number, y: number, v: number): void {
        if (x >= 0 && y >= 0 && x < this.n && y < this.n) {
            this.g[y * this.n + x] = v;
        }
    }
}

const mod = (a: number, n: number) => ((a % n) + n) % n;
const ri = (r: Random, a: number, b: number) => a + Math.floor(r() * (b - a + 1));

/** Turn some base pixels into dark or light ones. */
function speckle(G: Grid, r: Random, p: number): void {
    for (let i = 0; i < G.g.length; i++) {
        if (G.g[i] === 1 && r() < p) {
            G.g[i] = r() < 0.5 ? 0 : 2;
        }
    }
}

/** Smooth value noise over `c`×`c` cells, wrapping (seamless). Values in 0–1. */
function noise(n: number, r: Random, c: number): Float32Array {
    const L: number[] = [];
    for (let i = 0; i < c * c; i++) L.push(r());
    const out = new Float32Array(n * n);
    for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
            const gx = (x / n) * c;
            const gy = (y / n) * c;
            const x0 = Math.floor(gx);
            const y0 = Math.floor(gy);
            let tx = gx - x0;
            let ty = gy - y0;
            tx = tx * tx * (3 - 2 * tx);
            ty = ty * ty * (3 - 2 * ty);
            const X0 = x0 % c;
            const X1 = (x0 + 1) % c;
            const Y0 = y0 % c;
            const Y1 = (y0 + 1) % c;
            const a = L[Y0 * c + X0];
            const b = L[Y0 * c + X1];
            const cc = L[Y1 * c + X0];
            const dd = L[Y1 * c + X1];
            out[y * n + x] = (a * (1 - tx) + b * tx) * (1 - ty) + (cc * (1 - tx) + dd * tx) * ty;
        }
    }
    return out;
}

/** Fill a filled ellipse (no wrapping). */
function blob(G: Grid, cx: number, cy: number, rx: number, ry: number, v: number): void {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
            const e = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2;
            if (e <= 1) G.put(x, y, v);
        }
    }
}

/** Draw a dark outline around the non-transparent shape (for decorations). */
function outline(G: Grid): void {
    const n = G.n;
    const edge: number[] = [];
    for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
            if (G.g[y * n + x] === CLEAR) continue;
            const out = [
                [1, 0],
                [-1, 0],
                [0, 1],
                [0, -1],
            ].some(([dx, dy]) => {
                const nx = x + dx;
                const ny = y + dy;
                return nx < 0 || ny < 0 || nx >= n || ny >= n || G.g[ny * n + nx] === CLEAR;
            });
            if (out) edge.push(y * n + x);
        }
    }
    for (const i of edge) G.g[i] = 0;
}

/** Detail level used by the recipes ported from the workshop (fixed: no setting). */
const D = 0.5;

// ── Recipes from the « Atelier de tuiles NES » ───────────────────────────────

function stone(n: number, r: Random): Tones {
    const G = new Grid(n);
    const rh = n === 8 ? 4 : 8;
    for (let k = 0; k < n / rh; k++) {
        let widths: number[];
        if (n === 8) widths = [8];
        else if (r() < 0.5) {
            const w1 = ri(r, Math.round(n * 0.35), Math.round(n * 0.65));
            widths = [w1, n - w1];
        } else {
            const w1 = ri(r, Math.round(n * 0.25), Math.round(n * 0.4));
            const w2 = ri(r, Math.round(n * 0.25), Math.round(n * 0.4));
            widths = [w1, w2, n - w1 - w2];
        }
        let x0 = ri(r, 0, n - 1);
        for (const w of widths) {
            for (let ly = 0; ly < rh; ly++) {
                for (let lx = 0; lx < w; lx++) {
                    const v = ly === 0 || lx === 0 ? 0 : ly === 1 || lx === 1 ? 2 : 1;
                    G.set(x0 + lx, k * rh + ly, v);
                }
            }
            x0 += w;
        }
    }
    speckle(G, r, 0.02 + 0.1 * D);
    for (let c = 0, cn = ri(r, 1, 2); c < cn; c++) {
        let x = ri(r, 2, n - 3);
        let y = ri(r, 1, n - 2);
        for (let i = 0, len = ri(r, 3, 6); i < len; i++) {
            if (G.get(x, y) === 1) G.set(x, y, 0);
            x += r() < 0.6 ? 1 : 0;
            y += 1;
        }
    }
    return G.g;
}

/** Voronoi stones; `cells` per side, `gap` mortar width. */
function cells(n: number, r: Random, perSide: number, thr: number, speck: number): Tones {
    const G = new Grid(n);
    const cs = n / perSide;
    const sites: [number, number][] = [];
    for (let iy = 0; iy < perSide; iy++) {
        for (let ix = 0; ix < perSide; ix++) {
            sites.push([(ix + 0.2 + 0.6 * r()) * cs, (iy + 0.2 + 0.6 * r()) * cs]);
        }
    }
    for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
            let d1 = 1e9;
            let d2 = 1e9;
            let bx = 0;
            let by = 0;
            for (const [sx, sy] of sites) {
                let dx = x + 0.5 - sx;
                let dy = y + 0.5 - sy;
                if (dx > n / 2) dx -= n;
                if (dx < -n / 2) dx += n;
                if (dy > n / 2) dy -= n;
                if (dy < -n / 2) dy += n;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < d1) {
                    d2 = d1;
                    d1 = dist;
                    bx = dx;
                    by = dy;
                } else if (dist < d2) d2 = dist;
            }
            const gap = d2 - d1;
            G.g[y * n + x] = gap < thr ? 0 : gap < thr + 1.5 && bx + by < 0 ? 2 : 1;
        }
    }
    speckle(G, r, speck);
    return G.g;
}

const cobble = (n: number, r: Random) =>
    cells(n, r, n === 8 ? 2 : n === 16 ? 3 : 4, n === 16 ? 1.2 : 1.6, 0.04);

function brick(n: number, r: Random): Tones {
    const G = new Grid(n);
    const bh = n === 32 ? 8 : 4;
    const bw = n / 2;
    for (let y = 0; y < n; y++) {
        const off = (Math.floor(y / bh) % 2) * (bw / 2);
        for (let x = 0; x < n; x++) {
            const lx = mod(x - off, bw);
            const ly = y % bh;
            G.set(x, y, ly === 0 || lx === 0 ? 0 : ly === 1 ? 2 : 1);
        }
    }
    speckle(G, r, 0.01 + 0.08 * D);
    return G.g;
}

function wood(n: number, r: Random): Tones {
    const G = new Grid(n);
    const pw = n === 8 ? 4 : n / 4;
    const rem = 0.2 + 0.5 * D;
    for (let x = 0; x < n; x++) {
        const lx = x % pw;
        if (lx === 0) {
            for (let y = 0; y < n; y++) G.set(x, y, 0);
            continue;
        }
        let y = -ri(r, 0, 5);
        while (y < n) {
            const len = ri(r, 2, 7);
            const v = r() < 1 - rem ? 1 : r() < 0.5 ? 0 : 2;
            for (let i = 0; i < len; i++) if (y + i >= 0) G.set(x, y + i, v);
            y += len;
        }
        if (lx === 1) for (let y2 = 0; y2 < n; y2++) if (r() < 0.75) G.set(x, y2, 2);
    }
    const p = ri(r, 0, n / pw - 1);
    const kx = p * pw + Math.floor(pw / 2);
    const ky = ri(r, 4, n - 5);
    for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            const e = dx * dx + (dy / 2) ** 2;
            if (e <= 1) G.set(kx + dx, ky + dy, e > 0.45 ? 0 : 2);
        }
    }
    return G.g;
}

function dirt(n: number, r: Random): Tones {
    const G = new Grid(n);
    for (let i = 0, cnt = Math.round(n * n * (0.05 + 0.15 * D)); i < cnt; i++) {
        const x = ri(r, 0, n - 1);
        const y = ri(r, 0, n - 1);
        const v = r() < 0.55 ? 0 : 2;
        G.set(x, y, v);
        if (r() < 0.4) {
            if (r() < 0.5) G.set(x + 1, y, v);
            else G.set(x, y + 1, v);
        }
    }
    for (let j = 0, pc = Math.round((n / 16) * (1 + D * 3)); j < pc; j++) {
        const px = ri(r, 0, n - 1);
        const py = ri(r, 0, n - 1);
        G.set(px, py, 2);
        G.set(px + 1, py, 2);
        G.set(px, py + 1, 2);
        G.set(px + 1, py + 1, 0);
        G.set(px + 2, py + 1, 0);
        G.set(px + 1, py + 2, 0);
    }
    return G.g;
}

function grass(n: number, r: Random): Tones {
    const G = new Grid(n);
    for (let i = 0, cnt = Math.max(2, Math.round(n * n * (0.02 + 0.05 * D))); i < cnt; i++) {
        const x = ri(r, 0, n - 1);
        const y = ri(r, 0, n - 1);
        const len = n >= 16 ? ri(r, 2, 3) : 2;
        const dir = r() < 0.5 ? -1 : 1;
        for (let j = 0; j < len; j++) G.set(x, y - j, 0);
        G.set(x + dir, y - len, 2);
        if (len === 3 && r() < 0.5) G.set(x + dir, y - len + 1, 2);
    }
    for (let s = 0, sp = Math.round(n * n * 0.015 * (1 + D * 2)); s < sp; s++) {
        G.set(ri(r, 0, n - 1), ri(r, 0, n - 1), 2);
    }
    return G.g;
}

function metal(n: number, r: Random): Tones {
    const G = new Grid(n);
    const ps = n === 32 ? 16 : n;
    for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
            const lx = x % ps;
            const ly = y % ps;
            G.set(x, y, lx === ps - 1 || ly === ps - 1 ? 0 : lx === 0 || ly === 0 ? 2 : 1);
        }
    }
    for (let oy = 0; oy < n; oy += ps) {
        for (let ox = 0; ox < n; ox += ps) {
            for (let ly = 2; ly <= ps - 3; ly++) {
                if (r() < 0.25 + 0.4 * D) {
                    const len = ri(r, 2, ps >= 16 ? 7 : 4);
                    const x0 = ri(r, 2, ps - 3 - len + 1);
                    const v = r() < 0.65 ? 2 : 0;
                    for (let i = 0; i < len; i++) {
                        if (G.get(ox + x0 + i, oy + ly) === 1) G.set(ox + x0 + i, oy + ly, v);
                    }
                }
            }
            const m = ps >= 16 ? 3 : 2;
            for (const [px, py] of [
                [m, m],
                [ps - 1 - m, m],
                [m, ps - 1 - m],
                [ps - 1 - m, ps - 1 - m],
            ]) {
                G.set(ox + px, oy + py, 2);
                G.set(ox + px + 1, oy + py + 1, 0);
            }
        }
    }
    return G.g;
}

function water(n: number, r: Random): Tones {
    const G = new Grid(n);
    const nb = Math.max(2, n / 8);
    const bh = n / nb;
    const f = r() < 0.5 ? 1 : 2;
    const amp = n >= 16 ? 1.6 : 0.6;
    for (let k = 0; k < nb; k++) {
        const ph = r() * Math.PI * 2;
        for (let x = 0; x < n; x++) {
            const off = Math.round(Math.sin((2 * Math.PI * f * x) / n + ph) * amp);
            G.set(x, k * bh + 1 + off, 2);
            G.set(x, k * bh + 1 + off + Math.floor(bh / 2), 0);
        }
    }
    for (let i = 0, foam = Math.round(n * 0.6 * D); i < foam; i++) {
        const fx = ri(r, 0, n - 1);
        const fy = ri(r, 0, n - 1);
        if (G.get(fx, fy) === 1) G.set(fx, fy, 2);
    }
    return G.g;
}

function sand(n: number, r: Random): Tones {
    const G = new Grid(n);
    const nb = n === 32 ? 3 : 2;
    const f = r() < 0.5 ? 1 : 2;
    const amp = n >= 16 ? 1.5 : 0.6;
    for (let k = 0; k < nb; k++) {
        const base = Math.floor((k * n) / nb) + ri(r, 1, 3);
        const ph = r() * Math.PI * 2;
        for (let x = 0; x < n; x++) {
            const y = base + Math.round(Math.sin((2 * Math.PI * f * x) / n + ph) * amp);
            if (r() < 0.8) G.set(x, y, 0);
            if (r() < 0.5) G.set(x, y - 1, 2);
        }
    }
    speckle(G, r, 0.03 + 0.1 * D);
    return G.g;
}

function lava(n: number, r: Random): Tones {
    const G = new Grid(n);
    const c = n === 8 ? 2 : 4;
    const a = noise(n, r, c);
    const b = noise(n, r, c * 2);
    for (let i = 0; i < n * n; i++) {
        const v = 0.62 * a[i] + 0.38 * b[i];
        G.g[i] = v < 0.4 ? 0 : v > 0.64 - 0.12 * D ? 2 : 1;
    }
    return G.g;
}

function ice(n: number, r: Random): Tones {
    const G = new Grid(n);
    for (let i = 0, gl = Math.max(2, Math.round((n / 5) * (0.6 + D))); i < gl; i++) {
        const x = ri(r, 0, n - 1);
        const y = ri(r, 0, n - 1);
        for (let j = 0, len = n >= 16 ? ri(r, 2, 4) : 2; j < len; j++) G.set(x + j, y - j, 2);
    }
    for (let c = 0; c < 1 + Math.round(D * 2); c++) {
        let cx = ri(r, 0, n - 1);
        let cy = ri(r, 0, n - 1);
        for (let s = 0, cl = ri(r, 5, 10); s < cl; s++) {
            if (G.get(cx, cy) !== 2) G.set(cx, cy, 0);
            cx += r() < 0.65 ? 1 : 0;
            cy += r() < 0.65 ? 1 : 0;
        }
    }
    for (let q = 0, sp = Math.round(n * n * 0.02 * (1 + D)); q < sp; q++) {
        const sx = ri(r, 0, n - 1);
        const sy = ri(r, 0, n - 1);
        if (G.get(sx, sy) === 1) G.set(sx, sy, 2);
    }
    return G.g;
}

function brambles(n: number, r: Random): Tones {
    const G = new Grid(n);
    const dirs = [
        [1, 0],
        [1, 1],
        [0, 1],
        [-1, 1],
        [-1, 0],
        [-1, -1],
        [0, -1],
        [1, -1],
    ];
    const w =
        n === 32 ? 3 + Math.round(D * 3) : n === 16 ? 2 + Math.round(D * 2) : 1 + Math.round(D);
    for (let i = 0; i < w; i++) {
        let x = ri(r, 0, n - 1);
        let y = ri(r, 0, n - 1);
        let di = ri(r, 0, 7);
        for (let s = 0, len = ri(r, Math.round(n * 0.5), Math.round(n * 0.9)); s < len; s++) {
            G.set(x, y, 0);
            if (r() < 0.3) di = mod(di + (r() < 0.5 ? -1 : 1), 8);
            x += dirs[di][0];
            y += dirs[di][1];
            if (r() < 0.1) {
                const sx = x + ri(r, -1, 1);
                const sy = y + ri(r, -1, 1);
                if (G.get(sx, sy) === 1) G.set(sx, sy, 2);
            }
        }
    }
    for (let q = 0, sp = Math.round(n * n * 0.01 * (1 + D * 2)); q < sp; q++) {
        const px = ri(r, 0, n - 1);
        const py = ri(r, 0, n - 1);
        if (G.get(px, py) === 1) G.set(px, py, 2);
    }
    return G.g;
}

// ── New recipes ──────────────────────────────────────────────────────────────

/** Dirt topped with a grass edge (tones: 0–2 dirt, 3 grass, 4 light grass). */
function grassTop(n: number, r: Random): Tones {
    const G = new Grid(n);
    G.g.set(dirt(n, r));
    const heights: number[] = [];
    let h = ri(r, 3, 5);
    for (let x = 0; x < n; x++) {
        if (r() < 0.35) h = Math.max(3, Math.min(6, h + (r() < 0.5 ? -1 : 1)));
        heights.push(h);
    }
    for (let x = 0; x < n; x++) {
        for (let y = 0; y < heights[x]; y++) G.set(x, y, y === 0 || r() < 0.12 ? 4 : 3);
        G.set(x, heights[x], 0); // shadow under the grass
        if (r() < 0.3) G.set(x, heights[x] + 1, 3); // hanging blade
    }
    return G.g;
}

/** Rough rock face: layered noise and cracks. */
function rock(n: number, r: Random): Tones {
    const G = new Grid(n);
    const a = noise(n, r, 3);
    const b = noise(n, r, 8);
    for (let i = 0; i < n * n; i++) {
        const v = 0.55 * a[i] + 0.45 * b[i];
        G.g[i] = v < 0.38 ? 0 : v > 0.62 ? 2 : 1;
    }
    for (let c = 0; c < 2; c++) {
        let x = ri(r, 0, n - 1);
        let y = ri(r, 0, n - 1);
        for (let s = 0; s < n * 0.6; s++) {
            G.set(x, y, 0);
            x += ri(r, -1, 1);
            y += 1;
        }
    }
    return G.g;
}

/** Pebbles on soil. */
function pebbles(n: number, r: Random): Tones {
    const G = new Grid(n);
    speckle(G, r, 0.06);
    for (let i = 0, cnt = Math.round((n * n) / 22); i < cnt; i++) {
        const x = ri(r, 0, n - 1);
        const y = ri(r, 0, n - 1);
        const w = ri(r, 2, 3);
        for (let dx = 0; dx < w; dx++) {
            G.set(x + dx, y, 2);
            G.set(x + dx, y + 1, dx === 0 ? 2 : 3);
        }
        G.set(x + w, y + 1, 0);
        for (let dx = 0; dx < w; dx++) G.set(x + dx + 1, y + 2, 0);
    }
    return G.g;
}

/** A leafy bush on a transparent background. */
function bush(n: number, r: Random): Tones {
    const G = new Grid(n, CLEAR);
    const parts = ri(r, 3, 4);
    for (let i = 0; i < parts; i++) {
        const cx = n * (0.2 + (0.6 * (i + 0.5)) / parts) + ri(r, -1, 1);
        blob(G, cx, n - n * 0.3 - r() * n * 0.15, n * 0.22 + r() * 2, n * 0.22 + r() * 2, 1);
    }
    blob(G, n / 2, n * 0.75, n * 0.45, n * 0.25, 1);
    for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
            if (G.g[y * n + x] !== 1) continue;
            const above = y === 0 || G.g[(y - 1) * n + x] === CLEAR;
            if (above || r() < 0.08) G.g[y * n + x] = 2;
            else if (r() < 0.12) G.g[y * n + x] = 0;
        }
    }
    outline(G);
    return G.g;
}

/** Tree bark, vertical grooves. */
function trunk(n: number, r: Random): Tones {
    const G = new Grid(n);
    for (let x = 0; x < n; x++) {
        if (r() < 0.3) {
            const y = ri(r, 0, n - 1);
            for (let s = 0, len = ri(r, n / 2, n); s < len; s++) {
                G.set(x, y + s, 0);
                if (r() < 0.6) G.set(x - 1, y + s, 2);
            }
        }
    }
    if (r() < 0.7) {
        const kx = ri(r, 2, n - 3);
        const ky = ri(r, 2, n - 3);
        blob(G, kx + 0.5, ky + 0.5, 2, 2.5, 0);
        blob(G, kx + 0.5, ky + 0.5, 1, 1.5, 2);
    }
    return G.g;
}

/** Dense foliage. */
function leaves(n: number, r: Random): Tones {
    const G = new Grid(n);
    const a = noise(n, r, 4);
    for (let i = 0; i < n * n; i++) G.g[i] = a[i] < 0.35 ? 0 : 1;
    for (let i = 0, cnt = Math.round((n * n) / 7); i < cnt; i++) {
        const x = ri(r, 0, n - 1);
        const y = ri(r, 0, n - 1);
        G.set(x, y, 2);
        G.set(x + 1, y, 2);
        G.set(x + 1, y + 1, 0);
    }
    return G.g;
}

/** Snow: white with soft blue drifts. */
function snow(n: number, r: Random): Tones {
    const G = new Grid(n, 2);
    const f = r() < 0.5 ? 1 : 2;
    for (let k = 0; k < 2; k++) {
        const base = Math.floor((k * n) / 2) + ri(r, 2, 5);
        const ph = r() * Math.PI * 2;
        for (let x = 0; x < n; x++) {
            const y = base + Math.round(Math.sin((2 * Math.PI * f * x) / n + ph) * 1.5);
            G.set(x, y, 1);
            if (r() < 0.4) G.set(x, y + 1, 1);
        }
    }
    for (let i = 0, cnt = Math.round(n * 0.8); i < cnt; i++) {
        G.set(ri(r, 0, n - 1), ri(r, 0, n - 1), r() < 0.5 ? 0 : 1);
    }
    return G.g;
}

/** Glyphs for the mystery block, on a 6×8 grid ('#' = drawn). */
const GLYPHS = [
    ['.####.', '##..##', '....##', '...##.', '..##..', '..##..', '......', '..##..'],
    ['..##..', '..##..', '..##..', '..##..', '..##..', '......', '..##..', '..##..'],
    ['..##..', '..##..', '######', '.####.', '.####.', '##..##', '#....#', '......'],
];

/** « ? » block with rivets (the seed picks ?, ! or ★). */
function mystery(n: number, r: Random): Tones {
    const G = new Grid(n);
    for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
            if (x === 0 || y === 0 || x === n - 1 || y === n - 1) G.set(x, y, 0);
            else if (x === 1 || y === 1) G.set(x, y, 2);
            else if (x === n - 2 || y === n - 2) G.set(x, y, 3);
        }
    }
    for (const [px, py] of [
        [2, 2],
        [n - 3, 2],
        [2, n - 3],
        [n - 3, n - 3],
    ]) {
        G.set(px, py, 0);
    }
    const glyph = GLYPHS[Math.floor(r() * GLYPHS.length)];
    const ox = Math.floor((n - 6) / 2);
    const oy = Math.floor((n - 8) / 2);
    glyph.forEach((row, gy) =>
        [...row].forEach((ch, gx) => {
            if (ch === '#') {
                G.set(ox + gx + 1, oy + gy + 1, 0); // drop shadow
                G.set(ox + gx, oy + gy, 2);
            }
        })
    );
    return G.g;
}

/** A wooden ladder on a transparent background (repeats vertically). */
function ladder(n: number): Tones {
    const G = new Grid(n, CLEAR);
    const left = Math.round(n * 0.2);
    const right = n - 1 - left;
    for (let y = 0; y < n; y++) {
        for (const x of [left, right]) {
            G.set(x - 1, y, 2);
            G.set(x, y, 1);
            G.set(x + 1, y, 0);
        }
        if (y % 4 === 1) {
            for (let x = left + 2; x <= right - 2; x++) {
                G.set(x, y, 1);
                G.set(x, y + 1, 0);
            }
        }
    }
    return G.g;
}

/** A vertical pipe (repeats vertically). */
function pipe(n: number): Tones {
    const G = new Grid(n);
    for (let x = 0; x < n; x++) {
        const t = x / (n - 1);
        const v =
            x === 0 || x === n - 1
                ? 0
                : t < 0.2
                  ? 2
                  : t < 0.3
                    ? 1
                    : t < 0.38
                      ? 2
                      : t < 0.75
                        ? 1
                        : 0;
        for (let y = 0; y < n; y++) G.set(x, y, v);
    }
    return G.g;
}

/** A puffy cloud on a transparent background. */
function cloud(n: number, r: Random): Tones {
    const G = new Grid(n, CLEAR);
    const parts = ri(r, 3, 4);
    for (let i = 0; i < parts; i++) {
        const cx = n * (0.15 + (0.7 * (i + 0.5)) / parts);
        blob(G, cx, n * 0.5 + ri(r, -2, 1), n * 0.18 + r() * 2, n * 0.2 + r() * 2, 2);
    }
    blob(G, n / 2, n * 0.62, n * 0.42, n * 0.16, 2);
    for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
            const i = y * n + x;
            const below = y === n - 1 || G.g[i + n] === CLEAR;
            if (G.g[i] === 2 && (below || y > n * 0.66)) G.g[i] = 1;
        }
    }
    outline(G);
    return G.g;
}

/** Crystal facets: big diamonds split into light and dark halves. */
function crystal(n: number, r: Random): Tones {
    const G = new Grid(n);
    const s = n / 2;
    const shift = ri(r, 0, s - 1);
    for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
            const lx = mod(x + shift, s) - s / 2 + 0.5;
            const ly = mod(y, s) - s / 2 + 0.5;
            const inside = Math.abs(lx) + Math.abs(ly) < s / 2 - 0.5;
            const edge = Math.abs(Math.abs(lx) + Math.abs(ly) - (s / 2 - 0.5)) < 1;
            G.set(x, y, edge ? 0 : inside ? (lx < 0 ? 2 : 1) : ly < 0 ? 1 : 0);
        }
    }
    for (let i = 0; i < 3; i++) G.set(ri(r, 0, n - 1), ri(r, 0, n - 1), 3);
    return G.g;
}

// ── Materials ────────────────────────────────────────────────────────────────

export interface Material {
    id: string;
    name: string;
    /** NES palette entries for each tone (0 = darkest). */
    nes: number[];
    /** Suggested BOB type. */
    collision: BobCollision;
    /** Drawing resolution (8 or 16 pixels across, scaled up to 32). */
    grain: number;
    /** Number of images for animated materials (they scroll). */
    frames?: number;
    draw: (n: number, r: Random) => Tones;
}

export const MATERIALS: Material[] = [
    {
        id: 'stone',
        name: 'Pierre',
        nes: [0x00, 0x10, 0x20],
        collision: 'solid',
        grain: 16,
        draw: stone,
    },
    {
        id: 'cobble',
        name: 'Pavés',
        nes: [0x0f, 0x00, 0x10],
        collision: 'solid',
        grain: 16,
        draw: cobble,
    },
    {
        id: 'brick',
        name: 'Brique',
        nes: [0x0f, 0x16, 0x26],
        collision: 'solid',
        grain: 16,
        draw: brick,
    },
    {
        id: 'wood',
        name: 'Bois',
        nes: [0x08, 0x17, 0x27],
        collision: 'solid',
        grain: 16,
        draw: wood,
    },
    {
        id: 'dirt',
        name: 'Terre',
        nes: [0x08, 0x07, 0x17],
        collision: 'solid',
        grain: 16,
        draw: dirt,
    },
    {
        id: 'grassTop',
        name: 'Terre + herbe',
        nes: [0x08, 0x07, 0x17, 0x1a, 0x2a],
        collision: 'solid',
        grain: 16,
        draw: grassTop,
    },
    {
        id: 'grass',
        name: 'Herbe',
        nes: [0x0b, 0x1a, 0x2a],
        collision: 'solid',
        grain: 16,
        draw: grass,
    },
    {
        id: 'rock',
        name: 'Rocher',
        nes: [0x0f, 0x00, 0x10],
        collision: 'solid',
        grain: 16,
        draw: rock,
    },
    {
        id: 'pebbles',
        name: 'Cailloux',
        nes: [0x07, 0x17, 0x10, 0x00],
        collision: 'solid',
        grain: 16,
        draw: pebbles,
    },
    {
        id: 'sand',
        name: 'Sable',
        nes: [0x18, 0x28, 0x38],
        collision: 'solid',
        grain: 16,
        draw: sand,
    },
    {
        id: 'snow',
        name: 'Neige',
        nes: [0x10, 0x31, 0x30],
        collision: 'solid',
        grain: 16,
        draw: snow,
    },
    { id: 'ice', name: 'Glace', nes: [0x11, 0x21, 0x30], collision: 'solid', grain: 16, draw: ice },
    {
        id: 'metal',
        name: 'Métal',
        nes: [0x00, 0x10, 0x31],
        collision: 'solid',
        grain: 16,
        draw: metal,
    },
    {
        id: 'mystery',
        name: 'Bloc mystère',
        nes: [0x07, 0x27, 0x38, 0x17],
        collision: 'solid',
        grain: 16,
        draw: mystery,
    },
    {
        id: 'trunk',
        name: 'Tronc',
        nes: [0x07, 0x17, 0x27],
        collision: 'solid',
        grain: 16,
        draw: trunk,
    },
    {
        id: 'leaves',
        name: 'Feuillage',
        nes: [0x09, 0x19, 0x29],
        collision: 'solid',
        grain: 16,
        draw: leaves,
    },
    {
        id: 'crystal',
        name: 'Cristal',
        nes: [0x04, 0x14, 0x34, 0x30],
        collision: 'solid',
        grain: 16,
        draw: crystal,
    },
    {
        id: 'water',
        name: 'Eau',
        nes: [0x02, 0x11, 0x31],
        collision: 'air',
        grain: 16,
        frames: 4,
        draw: water,
    },
    {
        id: 'lava',
        name: 'Lave',
        nes: [0x06, 0x16, 0x28],
        collision: 'air',
        grain: 16,
        frames: 4,
        draw: lava,
    },
    {
        id: 'brambles',
        name: 'Ronces',
        nes: [0x0f, 0x04, 0x29],
        collision: 'air',
        grain: 16,
        draw: brambles,
    },
    {
        id: 'bush',
        name: 'Buisson',
        nes: [0x0a, 0x1a, 0x2a],
        collision: 'air',
        grain: 16,
        draw: bush,
    },
    {
        id: 'cloud',
        name: 'Nuage',
        nes: [0x21, 0x31, 0x30],
        collision: 'platform',
        grain: 16,
        draw: cloud,
    },
    {
        id: 'ladder',
        name: 'Échelle',
        nes: [0x07, 0x17, 0x27],
        collision: 'air',
        grain: 16,
        draw: ladder,
    },
    {
        id: 'pipe',
        name: 'Tuyau',
        nes: [0x09, 0x1a, 0x2a],
        collision: 'solid',
        grain: 16,
        draw: pipe,
    },
];

/** The coarse tone grid of a material for a seed (same seed → same grid). */
export function materialTones(material: Material, seed: number): Tones {
    const index = MATERIALS.indexOf(material);
    const random = seededRandom((seed + 1) * 7919 + index * 104729);
    return material.draw(material.grain, random);
}

/** Scale a tone grid to 32×32 and colour it with palette indices. */
function toFrame(tones: Tones, n: number, colors: number[]): Frame {
    const frame = new Array<number>(ASSET_SIZE * ASSET_SIZE);
    for (let y = 0; y < ASSET_SIZE; y++) {
        for (let x = 0; x < ASSET_SIZE; x++) {
            const t =
                tones[Math.floor((y * n) / ASSET_SIZE) * n + Math.floor((x * n) / ASSET_SIZE)];
            frame[y * ASSET_SIZE + x] =
                t === CLEAR ? TRANSPARENT : colors[Math.min(t, colors.length - 1)];
        }
    }
    return frame;
}

/** Shift a tone grid horizontally by `dx` (wrapping), for animated materials. */
function shift(tones: Tones, n: number, dx: number): Tones {
    const out = new Uint8Array(tones.length);
    for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) out[y * n + x] = tones[y * n + mod(x - dx, n)];
    }
    return out;
}

/**
 * Generate the images of a material in the colours of `palette` (closest match to the
 * NES colours). Animated materials give several images that scroll by a few pixels.
 */
export function generateTexture(
    material: Material,
    seed: number,
    palette: readonly string[]
): Frame[] {
    const n = material.grain;
    const tones = materialTones(material, seed);
    const colors = material.nes.map((i) => closestColor(palette, NES_PALETTE[i]));
    const count = material.frames ?? 1;
    return Array.from({ length: count }, (_, f) =>
        toFrame(shift(tones, n, (f * n) / count), n, colors)
    );
}
