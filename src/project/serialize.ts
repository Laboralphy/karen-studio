import { decodePixels, encodePixels } from './pixels';
import {
    ASSET_PIXELS,
    LEVEL_MAX_COLS,
    LEVEL_MAX_ROWS,
    PALETTE_SIZE,
    type Bob,
    type BobCollision,
    type KarenProject,
    type Level,
    type SpriteAsset,
} from './model';

/** Identifies a Karen Studio file. */
export const FILE_FORMAT = 'karen-studio';
/** Current file format version. Bump it and add a migration when the format changes. */
export const FILE_VERSION = 1;
/** File extension, without the dot. */
export const FILE_EXTENSION = 'karen';

/** Error with a message meant for the user (in French). */
export class ProjectFileError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ProjectFileError';
    }
}

/** On-disk shape of an asset: pixels are base64-encoded palette indices. */
interface FileBob extends Omit<Bob, 'pixels'> {
    pixels: string;
}
interface FileSprite extends Omit<SpriteAsset, 'pixels'> {
    pixels: string;
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
const MIGRATIONS: Record<number, (data: Record<string, unknown>) => Record<string, unknown>> = {};

/** Serialise a project to the `.karen` JSON text. */
export function saveProject(project: KarenProject): string {
    const file: FileProject = {
        format: FILE_FORMAT,
        version: FILE_VERSION,
        name: project.name,
        settings: { ...project.settings },
        palette: [...project.palette],
        bobs: project.bobs.map((b) => ({ ...b, pixels: encodePixels(b.pixels) })),
        sprites: project.sprites.map((s) => ({ ...s, pixels: encodePixels(s.pixels) })),
        levels: project.levels.map((l) => ({ ...l, tiles: [...l.tiles] })),
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
    const backgroundColor = checkString(f.settings.backgroundColor, 'couleur de fond');

    if (!Array.isArray(f.bobs) || !Array.isArray(f.sprites) || !Array.isArray(f.levels)) {
        fail('listes BOB / sprites / niveaux');
    }
    const bobs: Bob[] = f.bobs.map((b, i) => {
        if (!COLLISIONS.includes(b.collision)) {
            fail(`collision du BOB ${i + 1}`);
        }
        return {
            id: checkId(b.id, `BOB ${i + 1}`),
            name: checkString(b.name, `nom du BOB ${i + 1}`),
            collision: b.collision,
            pixels: decodePixels(checkString(b.pixels, `pixels du BOB ${i + 1}`), ASSET_PIXELS),
        };
    });
    const sprites: SpriteAsset[] = f.sprites.map((s, i) => ({
        id: checkId(s.id, `sprite ${i + 1}`),
        name: checkString(s.name, `nom du sprite ${i + 1}`),
        tag: checkString(s.tag, `tag du sprite ${i + 1}`),
        pixels: decodePixels(checkString(s.pixels, `pixels du sprite ${i + 1}`), ASSET_PIXELS),
    }));
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
        };
    });
    if (levels.length === 0) {
        fail('aucun niveau');
    }
    return {
        name: checkString(f.name, 'nom du projet'),
        settings: { tickRate, backgroundColor },
        palette: [...palette],
        bobs,
        sprites,
        levels,
        code: isObject(f.code) ? f.code : null,
    };
}
