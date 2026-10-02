import { decodePixels, encodePixels } from './pixels';
import { normalizeSoundParams } from './sound';
import { colorSky, normalizeSky } from './sky';
import { normalizeHudText } from './hud';
import {
    ASSET_PIXELS,
    LEVEL_MAX_COLS,
    LEVEL_MAX_ROWS,
    PALETTE_SIZE,
    type Bob,
    type BobCollision,
    type KarenProject,
    type Level,
    type Marker,
    type SoundAsset,
    type SpriteAnimation,
    type SpriteAsset,
} from './model';

/** Identifies a Karen Studio file. */
export const FILE_FORMAT = 'karen-studio';
/** Current file format version. Bump it and add a migration when the format changes. */
export const FILE_VERSION = 5;
/** File extension, without the dot. */
export const FILE_EXTENSION = 'karen';

/** Error with a message meant for the user (in French). */
export class ProjectFileError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ProjectFileError';
    }
}

/** On-disk shape of an asset: each image is base64-encoded palette indices. */
interface FileBob extends Omit<Bob, 'frames'> {
    frames: string[];
}
interface FileSprite extends Omit<SpriteAsset, 'frames'> {
    frames: string[];
}

interface FileProject extends Omit<KarenProject, 'bobs' | 'sprites'> {
    format: typeof FILE_FORMAT;
    version: number;
    bobs: FileBob[];
    sprites: FileSprite[];
}

/**
 * Migrations from version N to N+1, indexed by N.
 * Each one receives the raw parsed JSON of version N and returns version N+1.
 */
const MIGRATIONS: Record<number, (data: Record<string, unknown>) => Record<string, unknown>> = {
    // v2: sound effects.
    1: (data) => ({ ...data, version: 2, sounds: [] }),
    // v3: one sky per level, replacing the project's background colour.
    2: (data) => {
        const settings = (data.settings ?? {}) as Record<string, unknown>;
        const { backgroundColor, ...rest } = settings;
        const color = typeof backgroundColor === 'string' ? backgroundColor : '#7ec8f0';
        const levels = Array.isArray(data.levels) ? data.levels : [];
        return {
            ...data,
            version: 3,
            settings: rest,
            levels: levels.map((l) => ({ ...(l as object), sky: colorSky(color) })),
        };
    },
    // v4: several images per BOB / sprite, sprite animations, level markers.
    3: (data) => {
        const list = (v: unknown) => (Array.isArray(v) ? (v as Record<string, unknown>[]) : []);
        return {
            ...data,
            version: 4,
            bobs: list(data.bobs).map(({ pixels, ...b }) => ({
                ...b,
                frames: [pixels],
                frameDuration: 8,
            })),
            sprites: list(data.sprites).map(({ pixels, ...s }) => ({
                ...s,
                frames: [pixels],
                animations: [],
            })),
            levels: list(data.levels).map((l) => ({ ...l, markers: [] })),
        };
    },
    // v5: interface texts.
    4: (data) => ({ ...data, version: 5, hud: [] }),
};

/** Serialise a project to the `.karen` JSON text. */
export function saveProject(project: KarenProject): string {
    const file: FileProject = {
        format: FILE_FORMAT,
        version: FILE_VERSION,
        name: project.name,
        settings: { ...project.settings },
        palette: [...project.palette],
        bobs: project.bobs.map((b) => ({ ...b, frames: b.frames.map(encodePixels) })),
        sprites: project.sprites.map((s) => ({
            ...s,
            frames: s.frames.map(encodePixels),
            animations: s.animations.map((a) => ({ ...a, frames: [...a.frames] })),
        })),
        sounds: project.sounds.map((s) => ({ ...s, params: { ...s.params } })),
        levels: project.levels.map((l) => ({
            ...l,
            tiles: [...l.tiles],
            sky: { ...l.sky },
            markers: l.markers.map((m) => ({ ...m })),
        })),
        hud: project.hud.map((t) => ({ ...t })),
        code: project.code,
    };
    return JSON.stringify(file);
}

/** Parse a `.karen` JSON text; throws `ProjectFileError` with a readable message. */
export function loadProject(text: string): KarenProject {
    let data: Record<string, unknown>;
    try {
        data = JSON.parse(text) as Record<string, unknown>;
    } catch {
        throw new ProjectFileError("Ce fichier n'est pas un projet Karen Studio (JSON illisible).");
    }
    if (!isObject(data) || data.format !== FILE_FORMAT) {
        throw new ProjectFileError("Ce fichier n'est pas un projet Karen Studio.");
    }
    let version = data.version;
    if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
        throw new ProjectFileError('Version de fichier invalide.');
    }
    if (version > FILE_VERSION) {
        throw new ProjectFileError(
            'Ce projet a été créé avec une version plus récente de Karen Studio. ' +
                'Mets le logiciel à jour pour l’ouvrir.'
        );
    }
    while (version < FILE_VERSION) {
        data = MIGRATIONS[version](data);
        version++;
    }
    try {
        return validate(data as unknown as FileProject);
    } catch (e) {
        if (e instanceof ProjectFileError) {
            throw e;
        }
        throw new ProjectFileError(`Projet endommagé : ${(e as Error).message}`);
    }
}

function isObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function fail(message: string): never {
    throw new ProjectFileError(`Projet endommagé : ${message}`);
}

function checkId(v: unknown, what: string): number {
    if (typeof v !== 'number' || !Number.isInteger(v) || v <= 0) {
        fail(`identifiant invalide (${what})`);
    }
    return v;
}

function checkString(v: unknown, what: string): string {
    if (typeof v !== 'string') {
        fail(`texte attendu (${what})`);
    }
    return v;
}

const COLLISIONS: readonly BobCollision[] = ['air', 'solid', 'platform'];

/** At least one base64 image. */
function checkFrames(v: unknown, what: string): number[][] {
    if (!Array.isArray(v) || v.length === 0) {
        fail(what);
    }
    return v.map((f) => decodePixels(checkString(f, what), ASSET_PIXELS));
}

/** Ticks per image: a whole number from 1 to 60 (default 8). */
function checkDuration(v: unknown): number {
    return Number.isInteger(v) && (v as number) >= 1 ? Math.min(60, v as number) : 8;
}

/** Animations whose image indices exist; invalid indices are dropped. */
function checkAnimations(v: unknown, frameCount: number, what: string): SpriteAnimation[] {
    if (!Array.isArray(v)) {
        fail(what);
    }
    return v.map((a: Record<string, unknown>) => {
        const frames = Array.isArray(a.frames)
            ? a.frames.filter((f): f is number => Number.isInteger(f) && f >= 0 && f < frameCount)
            : [];
        return {
            name: checkString(a.name, what),
            frames: frames.length > 0 ? frames : [0],
            frameDuration: checkDuration(a.frameDuration),
            loop: a.loop !== false,
        };
    });
}

/** Markers inside the level; the others are dropped. */
function checkMarkers(v: unknown, cols: number, rows: number): Marker[] {
    if (!Array.isArray(v)) {
        return [];
    }
    return v
        .filter(
            (m: Record<string, unknown>) =>
                Number.isInteger(m.id) &&
                typeof m.tag === 'string' &&
                Number.isInteger(m.col) &&
                Number.isInteger(m.row) &&
                (m.col as number) >= 0 &&
                (m.row as number) >= 0 &&
                (m.col as number) < cols &&
                (m.row as number) < rows
        )
        .map((m: Record<string, unknown>) => ({
            id: m.id as number,
            tag: m.tag as string,
            col: m.col as number,
            row: m.row as number,
        }));
}

function validate(f: FileProject): KarenProject {
    const palette = f.palette;
    if (
        !Array.isArray(palette) ||
        palette.length !== PALETTE_SIZE ||
        !palette.every((c) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c))
    ) {
        fail('palette');
    }
    if (!isObject(f.settings)) {
        fail('réglages');
    }
    const tickRate = f.settings.tickRate === 20 ? 20 : 30;

    if (
        !Array.isArray(f.bobs) ||
        !Array.isArray(f.sprites) ||
        !Array.isArray(f.sounds) ||
        !Array.isArray(f.levels)
    ) {
        fail('listes BOB / sprites / sons / niveaux');
    }
    const bobs: Bob[] = f.bobs.map((b, i) => {
        if (!COLLISIONS.includes(b.collision)) {
            fail(`collision du BOB ${i + 1}`);
        }
        return {
            id: checkId(b.id, `BOB ${i + 1}`),
            name: checkString(b.name, `nom du BOB ${i + 1}`),
            collision: b.collision,
            frames: checkFrames(b.frames, `images du BOB ${i + 1}`),
            frameDuration: checkDuration(b.frameDuration),
        };
    });
    const sprites: SpriteAsset[] = f.sprites.map((s, i) => {
        const frames = checkFrames(s.frames, `images du sprite ${i + 1}`);
        return {
            id: checkId(s.id, `sprite ${i + 1}`),
            name: checkString(s.name, `nom du sprite ${i + 1}`),
            tag: checkString(s.tag, `tag du sprite ${i + 1}`),
            frames,
            animations: checkAnimations(
                s.animations,
                frames.length,
                `animations du sprite ${i + 1}`
            ),
        };
    });
    const sounds: SoundAsset[] = f.sounds.map((s, i) => {
        if (!isObject(s.params)) {
            fail(`réglages du son ${i + 1}`);
        }
        return {
            id: checkId(s.id, `son ${i + 1}`),
            name: checkString(s.name, `nom du son ${i + 1}`),
            params: normalizeSoundParams(s.params),
        };
    });
    const bobIds = new Set(bobs.map((b) => b.id));
    const levels: Level[] = f.levels.map((l, i) => {
        const cols = l.cols;
        const rows = l.rows;
        if (
            !Number.isInteger(cols) ||
            !Number.isInteger(rows) ||
            cols < 1 ||
            rows < 1 ||
            cols > LEVEL_MAX_COLS ||
            rows > LEVEL_MAX_ROWS
        ) {
            fail(`taille du niveau ${i + 1}`);
        }
        if (!Array.isArray(l.tiles) || l.tiles.length !== cols * rows) {
            fail(`cases du niveau ${i + 1}`);
        }
        return {
            id: checkId(l.id, `niveau ${i + 1}`),
            name: checkString(l.name, `nom du niveau ${i + 1}`),
            cols,
            rows,
            // A tile pointing to a missing BOB becomes empty rather than failing the load.
            tiles: l.tiles.map((t) => (bobIds.has(t) ? t : 0)),
            sky: normalizeSky(l.sky),
            markers: checkMarkers(l.markers, cols, rows),
        };
    });
    if (levels.length === 0) {
        fail('aucun niveau');
    }
    if (!Array.isArray(f.hud)) {
        fail("textes d'interface");
    }
    const hud = f.hud.map((t, i) =>
        normalizeHudText(t as unknown as Record<string, unknown>, checkId(t.id, `texte ${i + 1}`))
    );
    return {
        name: checkString(f.name, 'nom du projet'),
        settings: { tickRate },
        palette: [...palette],
        bobs,
        sprites,
        sounds,
        hud,
        levels,
        code: isObject(f.code) ? f.code : null,
    };
}
