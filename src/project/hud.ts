/**
 * Interface (HUD): texts shown above the game, anchored to one of 9 positions.
 * Their content is a Handlebars template: `{{score}}` shows the block variable « score ».
 */

export type HudAnchor =
    | 'top-left'
    | 'top'
    | 'top-right'
    | 'left'
    | 'center'
    | 'right'
    | 'bottom-left'
    | 'bottom'
    | 'bottom-right';

export type HudFont = 'press-start' | 'vt323' | 'silkscreen' | 'sans' | 'mono';

export interface HudText {
    /** Stable identifier (> 0), referenced by blocks. */
    id: number;
    /** Name shown in the blocks' menus. */
    name: string;
    /** Handlebars template, e.g. « Score : {{score}} ». */
    template: string;
    anchor: HudAnchor;
    /** Distance from the anchored edges, in screen pixels. */
    margin: number;
    font: HudFont;
    /** Font size in screen pixels. */
    size: number;
    color: string;
    /** Outline colour, or '' for none. */
    outline: string;
    bold: boolean;
    /** Visible when the game starts (blocks can show and hide it). */
    visible: boolean;
}

/** The 9 anchors, row by row (for a 3×3 picker). */
export const HUD_ANCHORS: HudAnchor[] = [
    'top-left',
    'top',
    'top-right',
    'left',
    'center',
    'right',
    'bottom-left',
    'bottom',
    'bottom-right',
];

/** Fonts: label and CSS `font-family` (the retro ones are bundled with the app). */
export const HUD_FONTS: { value: HudFont; label: string; css: string }[] = [
    { value: 'press-start', label: 'Rétro (Press Start 2P)', css: '"Press Start 2P", monospace' },
    { value: 'vt323', label: 'Terminal (VT323)', css: '"VT323", monospace' },
    { value: 'silkscreen', label: 'Pixel (Silkscreen)', css: '"Silkscreen", monospace' },
    { value: 'sans', label: 'Moderne', css: 'system-ui, sans-serif' },
    { value: 'mono', label: 'Machine à écrire', css: 'ui-monospace, monospace' },
];

export function defaultHudText(id: number): HudText {
    return {
        id,
        name: `texte ${id}`,
        template: 'Score : {{score}}',
        anchor: 'top-left',
        margin: 12,
        font: 'press-start',
        size: 16,
        color: '#ffffff',
        outline: '#000000',
        bold: false,
        visible: true,
    };
}

const COLOR = /^#[0-9a-f]{6}$/i;

/** Keep valid fields; missing or invalid ones get their default. */
export function normalizeHudText(input: Record<string, unknown>, id: number): HudText {
    const t = defaultHudText(id);
    if (typeof input.name === 'string') t.name = input.name;
    if (typeof input.template === 'string') t.template = input.template;
    if (HUD_ANCHORS.includes(input.anchor as HudAnchor)) t.anchor = input.anchor as HudAnchor;
    if (HUD_FONTS.some((f) => f.value === input.font)) t.font = input.font as HudFont;
    if (typeof input.margin === 'number' && Number.isFinite(input.margin)) {
        t.margin = Math.min(200, Math.max(0, Math.round(input.margin)));
    }
    if (typeof input.size === 'number' && Number.isFinite(input.size)) {
        t.size = Math.min(96, Math.max(6, Math.round(input.size)));
    }
    if (typeof input.color === 'string' && COLOR.test(input.color)) t.color = input.color;
    if (input.outline === '' || (typeof input.outline === 'string' && COLOR.test(input.outline))) {
        t.outline = input.outline;
    }
    if (typeof input.bold === 'boolean') t.bold = input.bold;
    if (typeof input.visible === 'boolean') t.visible = input.visible;
    return t;
}

/** Format a value for display: numbers lose useless decimals (0.1 + 0.2 → 0.3). */
export function displayValue(value: unknown): unknown {
    if (typeof value === 'number') {
        return Number.isInteger(value) ? value : Math.round(value * 100) / 100;
    }
    if (Array.isArray(value)) {
        return value.map(displayValue).join(', ');
    }
    return value;
}
