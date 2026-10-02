import Handlebars from 'handlebars';
import { HUD_FONTS, type HudAnchor, type HudText } from '../project/hud';

/** What the game needs from the interface layer (a silent one is used in tests). */
export interface HudOutput {
    /** Re-render every text with these values (only changed texts touch the page). */
    update(context: Record<string, unknown>): void;
    setVisible(id: number, visible: boolean): void;
    /** Replace a text's template (« changer le texte … en … »). */
    setTemplate(id: number, template: string): void;
}

/** An interface that shows nothing. */
export const NO_HUD: HudOutput = {
    update: () => {},
    setVisible: () => {},
    setTemplate: () => {},
};

/** The error of an invalid template (in French), or null if it is valid. */
export function templateError(template: string): string | null {
    try {
        Handlebars.parse(template);
        return null;
    } catch (e) {
        const first = String((e as Error).message).split('\n')[0];
        return `Gabarit invalide : ${first}`;
    }
}

/**
 * Compile a template. An invalid one is shown as plain text instead of failing,
 * so a typo in a text never stops the game.
 */
export function compileTemplate(template: string): (context: Record<string, unknown>) => string {
    if (templateError(template) !== null) {
        return () => template;
    }
    const render = Handlebars.compile(template, { noEscape: true });
    return (context) => {
        try {
            return render(context);
        } catch {
            return template;
        }
    };
}

/** CSS position of each anchor: [declarations, transform]. */
const ANCHOR_CSS: Record<HudAnchor, (m: string) => Partial<CSSStyleDeclaration>> = {
    'top-left': (m) => ({ left: m, top: m, textAlign: 'left' }),
    top: (m) => ({ left: '50%', top: m, transform: 'translateX(-50%)', textAlign: 'center' }),
    'top-right': (m) => ({ right: m, top: m, textAlign: 'right' }),
    left: (m) => ({ left: m, top: '50%', transform: 'translateY(-50%)', textAlign: 'left' }),
    center: () => ({
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        textAlign: 'center',
    }),
    right: (m) => ({ right: m, top: '50%', transform: 'translateY(-50%)', textAlign: 'right' }),
    'bottom-left': (m) => ({ left: m, bottom: m, textAlign: 'left' }),
    bottom: (m) => ({ left: '50%', bottom: m, transform: 'translateX(-50%)', textAlign: 'center' }),
    'bottom-right': (m) => ({ right: m, bottom: m, textAlign: 'right' }),
};

/** Apply a text's position and style to its element. */
export function applyHudStyle(el: HTMLElement, text: HudText): void {
    el.removeAttribute('style');
    const s = el.style;
    s.position = 'absolute';
    s.whiteSpace = 'pre';
    s.lineHeight = '1.25';
    s.pointerEvents = 'none';
    s.fontFamily = HUD_FONTS.find((f) => f.value === text.font)?.css ?? 'monospace';
    s.fontSize = `${text.size}px`;
    s.fontWeight = text.bold ? 'bold' : 'normal';
    s.color = text.color;
    if (text.outline) {
        // Hard pixel outline: the shadow repeated in 8 directions.
        const d = Math.max(1, Math.round(text.size / 12));
        const o = text.outline;
        s.textShadow = [
            [-d, -d],
            [0, -d],
            [d, -d],
            [-d, 0],
            [d, 0],
            [-d, d],
            [0, d],
            [d, d],
        ]
            .map(([x, y]) => `${x}px ${y}px 0 ${o}`)
            .join(', ');
    }
    Object.assign(s, ANCHOR_CSS[text.anchor](`${text.margin}px`));
}

interface Item {
    el: HTMLElement;
    render: (context: Record<string, unknown>) => string;
    shown: string | null;
}

/** The interface texts, as HTML elements inside `host` (a layer above the game canvas). */
export class HudLayer implements HudOutput {
    private readonly _items = new Map<number, Item>();

    constructor(
        private readonly _host: HTMLElement,
        texts: readonly HudText[]
    ) {
        _host.replaceChildren();
        for (const text of texts) {
            const el = document.createElement('div');
            el.className = 'hud-text';
            applyHudStyle(el, text);
            el.hidden = !text.visible;
            _host.append(el);
            this._items.set(text.id, { el, render: compileTemplate(text.template), shown: null });
        }
    }

    update(context: Record<string, unknown>): void {
        for (const item of this._items.values()) {
            const content = item.render(context);
            if (content !== item.shown) {
                item.el.textContent = content;
                item.shown = content;
            }
        }
    }

    setVisible(id: number, visible: boolean): void {
        const item = this._items.get(id);
        if (item) item.el.hidden = !visible;
    }

    setTemplate(id: number, template: string): void {
        const item = this._items.get(id);
        if (item) item.render = compileTemplate(template);
    }

    /** Remove the texts from the page. */
    destroy(): void {
        this._host.replaceChildren();
        this._items.clear();
    }
}
