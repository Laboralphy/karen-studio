import { describe, expect, it } from 'vitest';
import { FairyFlight } from '@fairy/FairyFlight';
import {
    resolveTileCollision,
    TILE_SEMI_SOLID,
    TILE_SOLID,
    type ITileGrid,
    type TileBox,
} from '@fairy/FairyTileCollision';

const T = 32;

/** Grid from rows of characters: '#' solid, '=' semi-solid, anything else air. */
function grid(rows: string[]): ITileGrid {
    return {
        getCols: () => rows[0].length,
        getRows: () => rows.length,
        getTileWidth: () => T,
        getTileHeight: () => T,
        getTileCode: (c, r) => {
            const ch = rows[r][c];
            return ch === '#' ? TILE_SOLID : ch === '=' ? TILE_SEMI_SOLID : 0;
        },
    };
}

/** Full 32×32 box anchored at the sprite's top-left corner. */
const BOX: TileBox = { left: 0, top: 0, right: 32, bottom: 32 };

/** Flight at `(x, y)` that wants to move by `(dx, dy)` this tick. */
function flight(x: number, y: number, dx: number, dy: number): FairyFlight {
    const f = new FairyFlight();
    f.vPosition.set(x, y);
    f.vSpeed.set(dx, dy);
    f.proceed();
    return f;
}

describe('resolveTileCollision', () => {
    const level = grid([
        '......', //
        '......',
        '......',
        '######',
    ]);

    it('pose le sprite sur le sol quand il tombe', () => {
        const f = flight(32, 60, 0, 10); // bas à 92, le sol commence à 96
        const c = resolveTileCollision(f, BOX, level);
        expect(c.bottom).toBe(true);
        expect(f.vNewPosition.y).toBe(64);
        expect(f.vNewSpeed.y).toBe(0);
    });

    it('détecte le sol à chaque tick quand le sprite repose dessus (gravité)', () => {
        const f = flight(32, 64, 0, 1);
        const c = resolveTileCollision(f, BOX, level);
        expect(c.bottom).toBe(true);
        expect(f.vNewPosition.y).toBe(64);
    });

    it('laisse passer un mouvement libre', () => {
        const f = flight(32, 0, 5, 5);
        const c = resolveTileCollision(f, BOX, level);
        expect(c).toEqual({ left: false, right: false, top: false, bottom: false });
        expect(f.vNewPosition.x).toBe(37);
        expect(f.vNewPosition.y).toBe(5);
    });

    it('arrête le sprite contre un mur à droite et à gauche', () => {
        const walls = grid(['#....#', '#....#']);
        const right = flight(120, 0, 10, 0);
        expect(resolveTileCollision(right, BOX, walls).right).toBe(true);
        expect(right.vNewPosition.x).toBe(128);
        expect(right.vNewSpeed.x).toBe(0);

        const left = flight(40, 0, -10, 0);
        expect(resolveTileCollision(left, BOX, walls).left).toBe(true);
        expect(left.vNewPosition.x).toBe(32);
    });

    it('arrête un saut sous un plafond', () => {
        const ceiling = grid(['####', '....', '....']);
        const f = flight(32, 40, 0, -12);
        const c = resolveTileCollision(f, BOX, ceiling);
        expect(c.top).toBe(true);
        expect(f.vNewPosition.y).toBe(32);
    });

    it('traverse une plateforme semi-solide par le dessous mais atterrit dessus', () => {
        const platform = grid(['....', '.==.', '....', '....']);
        const up = flight(32, 70, 0, -20);
        expect(resolveTileCollision(up, BOX, platform).top).toBe(false);
        expect(up.vNewPosition.y).toBe(50);

        const down = flight(32, 0, 0, 10);
        expect(resolveTileCollision(down, BOX, platform).bottom).toBe(true);
        expect(down.vNewPosition.y).toBe(0);
    });

    it('ne traverse pas un mur fin à grande vitesse', () => {
        const thin = grid(['...#......']);
        const f = flight(0, 0, 200, 0);
        expect(resolveTileCollision(f, BOX, thin).right).toBe(true);
        expect(f.vNewPosition.x).toBe(64);
    });

    it('glisse le long d’un mur en tombant (X puis Y)', () => {
        const wallAndFloor = grid(['...#', '...#', '####']);
        const f = flight(60, 20, 10, 20); // va vers le mur et vers le sol
        const c = resolveTileCollision(f, BOX, wallAndFloor);
        expect(c.right).toBe(true);
        expect(c.bottom).toBe(true);
        expect(f.vNewPosition.x).toBe(64);
        expect(f.vNewPosition.y).toBe(32);
    });

    it('ne bloque pas dans un coin quand le sprite passe juste à côté', () => {
        const pillar = grid(['....', '..#.', '....']);
        // Sprite au-dessus du pilier, aligné sur la colonne 1 : tombe sans toucher la colonne 2.
        const f = flight(32, 0, 0, 20);
        expect(resolveTileCollision(f, BOX, pillar).bottom).toBe(false);
    });

    it('applique la politique des bords : murs à gauche/droite, ouvert en bas', () => {
        const open = grid(['....']);
        const f = flight(0, 0, -5, 0);
        expect(resolveTileCollision(f, BOX, open).left).toBe(true);
        expect(f.vNewPosition.x).toBe(0);

        const fall = flight(0, 0, 0, 50);
        expect(resolveTileCollision(fall, BOX, open).bottom).toBe(false);
        expect(fall.vNewPosition.y).toBe(50);
    });

    it('respecte une boîte plus petite que le sprite', () => {
        const box: TileBox = { left: 8, top: 4, right: 24, bottom: 32 };
        const walls = grid(['....#', '....#']);
        const f = flight(100, 0, 10, 0); // bord droit de la boîte : 124 → 134, mur à 128
        expect(resolveTileCollision(f, box, walls).right).toBe(true);
        expect(f.vNewPosition.x).toBe(128 - 24);
    });
});
