import type * as Blockly from 'blockly/core';
import { javascriptGenerator, Order, type JavascriptGenerator } from 'blockly/javascript';
import { SPRITE_EVENT_TYPES } from './definitions';

/**
 * Name of the runtime API object inside generated code.
 * Generated scripts only see this object (see `ScriptApi` in the runtime).
 */
export const API = '__k';

/** Parameters of sprite event scripts: the sprite concerned and, for collisions, the other one. */
const SELF = '__self';
const OTHER = '__other';

/** Loops that must pause (`yield`) at the end of every iteration, like Scratch. */
const LOOP_TYPES = [
    'controls_repeat',
    'controls_repeat_ext',
    'controls_whileUntil',
    'controls_for',
    'controls_forEach',
];

let registered = false;

/** Install the Karen code generators on Blockly's JavaScript generator (idempotent). */
export function registerKarenGenerators(): void {
    if (registered) {
        return;
    }
    registered = true;
    const gen = javascriptGenerator;
    gen.addReservedWords(`${API},${SELF},${OTHER}`);

    // A loop that never pauses (e.g. using « continue ») is stopped by the scheduler.
    gen.INFINITE_LOOP_TRAP = `${API}.guard();\n`;
    for (const type of LOOP_TYPES) {
        const original = gen.forBlock[type];
        gen.forBlock[type] = function (block, g) {
            const code = original.call(this, block, g) as string;
            const end = code.lastIndexOf('}');
            return `${code.slice(0, end)}${g.INDENT}yield;\n${code.slice(end)}`;
        };
    }

    const value = (b: Blockly.Block, g: JavascriptGenerator, name: string, fallback = '0') =>
        g.valueToCode(b, name, Order.NONE) || fallback;
    const sprite = (b: Blockly.Block, g: JavascriptGenerator) => value(b, g, 'SPRITE', 'null');
    const str = (s: string) => JSON.stringify(s);

    /** A hat block: its script is the chain of blocks below it, as a coroutine. */
    const hat = (
        b: Blockly.Block,
        g: JavascriptGenerator,
        call: string,
        label: string,
        params = ''
    ) => {
        const body = g.blockToCode(b.getNextBlock()) as string;
        return `${API}.${call}${str(label)}, function* (${params}) {\n${g.prefixLines(body, g.INDENT)}});\n`;
    };

    gen.forBlock['karen_on_start'] = (b, g) => hat(b, g, 'onStart(', 'quand le jeu démarre');
    gen.forBlock['karen_on_level_start'] = (b, g) =>
        hat(b, g, 'onLevelStart(', 'quand le niveau commence');
    gen.forBlock['karen_on_sprite_tile'] = (b, g) => {
        const tag = b.getFieldValue('TAG') as string;
        const label = `quand un sprite ${tag} touche un bloc solide`;
        return hat(b, g, `onSpriteTile(${str(tag)}, `, label, SELF);
    };
    gen.forBlock['karen_on_sprite_sprite'] = (b, g) => {
        const tag = b.getFieldValue('TAG') as string;
        const other = b.getFieldValue('OTHER') as string;
        const label = `quand un sprite ${tag} touche un sprite ${other}`;
        return hat(b, g, `onSpriteSprite(${str(tag)}, ${str(other)}, `, label, `${SELF}, ${OTHER}`);
    };
    /** « ce sprite » / « l'autre sprite »: only meaningful under a sprite event. */
    const eventSprite = (b: Blockly.Block, name: string, label: string, needsPair: boolean) => {
        const root = b.getRootBlock().type;
        const ok = needsPair ? root === 'karen_on_sprite_sprite' : SPRITE_EVENT_TYPES.has(root);
        return [ok ? name : `${API}.noEventSprite(${str(label)})`, Order.ATOMIC] as [string, Order];
    };
    gen.forBlock['karen_event_self'] = (b) => eventSprite(b, SELF, 'ce sprite', false);
    gen.forBlock['karen_event_other'] = (b) => eventSprite(b, OTHER, "l'autre sprite", true);
    gen.forBlock['karen_on_tick'] = (b, g) => hat(b, g, 'onTick(', 'à chaque tick');
    gen.forBlock['karen_on_key'] = (b, g) => {
        const key = Number(b.getFieldValue('KEY'));
        const state = b.getFieldValue('STATE') === 'up' ? 'up' : 'down';
        const keyLabel = b.getField('KEY')?.getText() ?? String(key);
        const label = `quand la touche ${keyLabel} est ${state === 'up' ? 'relâchée' : 'pressée'}`;
        return hat(b, g, `onKey(${key}, ${str(state)}, `, label);
    };

    gen.forBlock['karen_key_down'] = (b) => [
        `${API}.keyDown(${Number(b.getFieldValue('KEY'))})`,
        Order.FUNCTION_CALL,
    ];

    gen.forBlock['karen_sprite_create'] = (b, g) => [
        `${API}.createSprite(${Number(b.getFieldValue('SPRITE'))}, ${value(b, g, 'X')}, ${value(b, g, 'Y')})`,
        Order.FUNCTION_CALL,
    ];
    gen.forBlock['karen_sprite_set'] = (b, g) =>
        `${API}.setProp(${sprite(b, g)}, ${str(b.getFieldValue('PROP'))}, ${value(b, g, 'VALUE')});\n`;
    gen.forBlock['karen_sprite_change'] = (b, g) =>
        `${API}.changeProp(${sprite(b, g)}, ${str(b.getFieldValue('PROP'))}, ${value(b, g, 'VALUE')});\n`;
    gen.forBlock['karen_sprite_get'] = (b, g) => [
        `${API}.getProp(${sprite(b, g)}, ${str(b.getFieldValue('PROP'))})`,
        Order.FUNCTION_CALL,
    ];
    gen.forBlock['karen_sprite_move'] = (b, g) =>
        `${API}.moveSprite(${sprite(b, g)}, ${value(b, g, 'DX')}, ${value(b, g, 'DY')});\n`;
    gen.forBlock['karen_sprite_touching'] = (b, g) => [
        `${API}.touching(${sprite(b, g)}, ${str(b.getFieldValue('SIDE'))})`,
        Order.FUNCTION_CALL,
    ];
    gen.forBlock['karen_sprite_destroy'] = (b, g) => `${API}.destroySprite(${sprite(b, g)});\n`;

    gen.forBlock['karen_camera_follow'] = (b, g) => `${API}.cameraFollow(${sprite(b, g)});\n`;
    gen.forBlock['karen_camera_move'] = (b, g) =>
        `${API}.cameraMoveTo(${value(b, g, 'X')}, ${value(b, g, 'Y')});\n`;

    gen.forBlock['karen_wait'] = (b, g) => `yield ${API}.ticks(${value(b, g, 'SECONDS')});\n`;

    gen.forBlock['karen_math_minmax'] = (b, g) => [
        `Math.${b.getFieldValue('OP') === 'max' ? 'max' : 'min'}(${value(b, g, 'A')}, ${value(b, g, 'B')})`,
        Order.FUNCTION_CALL,
    ];

    // ── Registers ─────────────────────────────────────────────────────────────
    const key = (b: Blockly.Block, g: JavascriptGenerator) => value(b, g, 'KEY', '""');
    const dict = (b: Blockly.Block, g: JavascriptGenerator) => value(b, g, 'DICT', 'null');
    gen.forBlock['karen_dict_create'] = () => [`${API}.dictCreate()`, Order.FUNCTION_CALL];
    gen.forBlock['karen_dict_set'] = (b, g) =>
        `${API}.dictSet(${dict(b, g)}, ${key(b, g)}, ${value(b, g, 'VALUE')});\n`;
    gen.forBlock['karen_dict_change'] = (b, g) =>
        `${API}.dictChange(${dict(b, g)}, ${key(b, g)}, ${value(b, g, 'VALUE')});\n`;
    gen.forBlock['karen_dict_get'] = (b, g) => [
        `${API}.dictGet(${dict(b, g)}, ${key(b, g)})`,
        Order.FUNCTION_CALL,
    ];
    gen.forBlock['karen_dict_has'] = (b, g) => [
        `${API}.dictHas(${dict(b, g)}, ${key(b, g)})`,
        Order.FUNCTION_CALL,
    ];
    gen.forBlock['karen_dict_remove'] = (b, g) =>
        `${API}.dictRemove(${dict(b, g)}, ${key(b, g)});\n`;

    // ── Level ─────────────────────────────────────────────────────────────────
    gen.forBlock['karen_level_set_tile'] = (b, g) =>
        `${API}.setTile(${value(b, g, 'X')}, ${value(b, g, 'Y')}, ${Number(b.getFieldValue('BOB'))});\n`;
    gen.forBlock['karen_level_tile_is'] = (b, g) => [
        `${API}.tileIs(${value(b, g, 'X')}, ${value(b, g, 'Y')}, ${Number(b.getFieldValue('BOB'))})`,
        Order.FUNCTION_CALL,
    ];
    gen.forBlock['karen_level_cell_of'] = (b, g) => [
        `${API}.cellOf(${sprite(b, g)}, ${str(b.getFieldValue('AXIS'))})`,
        Order.FUNCTION_CALL,
    ];
    gen.forBlock['karen_level_goto'] = (b) =>
        `${API}.goToLevel(${Number(b.getFieldValue('LEVEL'))});\n`;

    // ── Functions: generator functions, so that they can pause too ───────────
    for (const type of ['procedures_defreturn', 'procedures_defnoreturn']) {
        const original = gen.forBlock[type];
        gen.forBlock[type] = function (block, g) {
            original.call(this, block, g); // stores the definition in g.definitions_
            const name = g.getProcedureName(block.getFieldValue('NAME'));
            const def = (g as unknown as { definitions_: Record<string, string> }).definitions_;
            def[`%${name}`] = def[`%${name}`].replace(/^function /m, 'function* ');
            return null;
        };
    }
    const callReturn = gen.forBlock['procedures_callreturn'];
    gen.forBlock['procedures_callreturn'] = function (block, g) {
        const [call] = callReturn.call(this, block, g) as [string, Order];
        return [`(yield* ${call})`, Order.ATOMIC];
    };
    gen.forBlock['procedures_callnoreturn'] = function (block, g) {
        const [call] = callReturn.call(this, block, g) as [string, Order];
        return `yield* ${call};\n`;
    };
}
