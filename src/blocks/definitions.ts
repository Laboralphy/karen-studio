import * as Blockly from 'blockly/core';
import { KEY_OPTIONS } from './keys';
import type { KarenProject } from '../project/model';

/** The parts of a project the dynamic dropdowns (sprites, tags, BOB, levels) read. */
export type BlocksProject = Pick<KarenProject, 'sprites' | 'bobs' | 'levels' | 'sounds'>;

let currentProject: () => BlocksProject = () => ({ sprites: [], bobs: [], levels: [], sounds: [] });

/**
 * Tell the blocks where to read the current project from (for their dropdown menus).
 * Returns the previous getter, so that a temporary change can be undone.
 */
export function setBlocksProject(getter: () => BlocksProject): () => BlocksProject {
    const previous = currentProject;
    currentProject = getter;
    return previous;
}

type Options = [string, string][];

/** Dropdown options from the current project, with a placeholder when the list is empty. */
function dynamic(list: (p: BlocksProject) => Options, empty: string): () => Options {
    return () => {
        const options = list(currentProject());
        return options.length > 0 ? options : [[empty, '0']];
    };
}

/** Sprite models: [name, id]. */
export const spriteOptions = dynamic(
    (p) => p.sprites.map((s) => [s.name, String(s.id)]),
    '(aucun sprite)'
);
/** Distinct sprite tags: [tag, tag]. */
export const tagOptions = dynamic(
    (p) => [...new Set(p.sprites.map((s) => s.tag.trim()).filter((t) => t))].map((t) => [t, t]),
    '(aucun tag)'
);
/** BOB, plus « vide »: [name, id]. */
export const bobOptions = (): Options => [
    ['(vide)', '0'],
    ...currentProject().bobs.map((b): [string, string] => [b.name, String(b.id)]),
];
/** Sounds: [name, id]. */
export const soundOptions = dynamic(
    (p) => p.sounds.map((s) => [s.name, String(s.id)]),
    '(aucun son)'
);
/** Levels: [name, id]. */
export const levelOptions = dynamic(
    (p) => p.levels.map((l) => [l.name, String(l.id)]),
    '(aucun niveau)'
);

/** Sprite properties readable / writable by blocks: [label, API name]. */
export const SPRITE_PROPS: [string, string][] = [
    ['position x', 'x'],
    ['position y', 'y'],
    ['vitesse x', 'vx'],
    ['vitesse y', 'vy'],
    ['gravité', 'gravity'],
];

/** Sides a sprite can touch: [label, API name]. */
export const TOUCH_SIDES: [string, string][] = [
    ['le sol', 'bottom'],
    ['le plafond', 'top'],
    ['un mur à gauche', 'left'],
    ['un mur à droite', 'right'],
    ['un bloc solide', 'any'],
];

/** Block types that start a script. */
export const HAT_TYPES = new Set([
    'karen_on_start',
    'karen_on_level_start',
    'karen_on_tick',
    'karen_on_key',
    'karen_on_sprite_tile',
    'karen_on_sprite_sprite',
    'karen_on_sound_end',
]);
/** Hats whose scripts receive « ce sprite » (and « l'autre sprite » for the second one). */
export const SPRITE_EVENT_TYPES = new Set(['karen_on_sprite_tile', 'karen_on_sprite_sprite']);
/** Function definitions: compiled too, since event scripts call them. */
export const PROCEDURE_TYPES = new Set(['procedures_defnoreturn', 'procedures_defreturn']);

/** Colours of the block categories, also used by the toolbox. */
export const COLORS = {
    events: '#e6a52e',
    sprites: '#4c8fe6',
    camera: '#8a5cd6',
    keyboard: '#2fae9c',
    control: '#e08a2e',
    operators: '#5cb85c',
    lists: '#d65c3d',
    dicts: '#b5527a',
    level: '#8a6d3b',
    sound: '#c94fd6',
};

let defined = false;

/** Register the Karen blocks with Blockly (idempotent). */
export function defineKarenBlocks(): void {
    if (defined) {
        return;
    }
    defined = true;

    Blockly.common.defineBlocksWithJsonArray([
        // ── Events ────────────────────────────────────────────────────────────
        {
            type: 'karen_on_start',
            message0: 'quand le jeu démarre',
            nextStatement: null,
            colour: COLORS.events,
            tooltip: 'Exécute les blocs en dessous une fois, au démarrage du jeu.',
        },
        {
            type: 'karen_on_level_start',
            message0: 'quand le niveau commence',
            nextStatement: null,
            colour: COLORS.events,
            tooltip:
                'Exécute les blocs en dessous au début de chaque niveau (le premier compris). ' +
                'C’est le bon endroit pour créer les sprites du niveau.',
        },
        {
            type: 'karen_on_tick',
            message0: 'à chaque tick',
            nextStatement: null,
            colour: COLORS.events,
            tooltip:
                'Exécute les blocs en dessous à chaque tick du jeu (20 ou 30 fois par seconde). ' +
                "Si le script précédent n'est pas fini, le tick est sauté.",
        },
        {
            type: 'karen_on_key',
            message0: 'quand la touche %1 est %2',
            args0: [
                { type: 'field_dropdown', name: 'KEY', options: KEY_OPTIONS },
                {
                    type: 'field_dropdown',
                    name: 'STATE',
                    options: [
                        ['pressée', 'down'],
                        ['relâchée', 'up'],
                    ],
                },
            ],
            nextStatement: null,
            colour: COLORS.events,
            tooltip: 'Exécute les blocs en dessous quand la touche est pressée ou relâchée.',
        },
        {
            type: 'karen_event_self',
            message0: 'ce sprite',
            output: 'Sprite',
            colour: COLORS.events,
            tooltip: 'Le sprite concerné par l’événement « quand un sprite … touche … ».',
        },
        {
            type: 'karen_event_other',
            message0: "l'autre sprite",
            output: 'Sprite',
            colour: COLORS.events,
            tooltip: 'Le sprite touché, dans l’événement « quand un sprite … touche un sprite … ».',
        },
        // ── Keyboard ──────────────────────────────────────────────────────────
        {
            type: 'karen_key_down',
            message0: 'touche %1 enfoncée ?',
            args0: [{ type: 'field_dropdown', name: 'KEY', options: KEY_OPTIONS }],
            output: 'Boolean',
            colour: COLORS.keyboard,
            tooltip: 'Vrai tant que la touche est enfoncée.',
        },
        // ── Sprites ───────────────────────────────────────────────────────────
        {
            type: 'karen_sprite_set',
            message0: 'mettre %1 de %2 à %3',
            args0: [
                { type: 'field_dropdown', name: 'PROP', options: SPRITE_PROPS },
                { type: 'input_value', name: 'SPRITE' },
                { type: 'input_value', name: 'VALUE', check: 'Number' },
            ],
            inputsInline: true,
            previousStatement: null,
            nextStatement: null,
            colour: COLORS.sprites,
            tooltip: 'Change une propriété du sprite (position, vitesse, gravité).',
        },
        {
            type: 'karen_sprite_change',
            message0: 'ajouter %3 à %1 de %2',
            args0: [
                { type: 'field_dropdown', name: 'PROP', options: SPRITE_PROPS },
                { type: 'input_value', name: 'SPRITE' },
                { type: 'input_value', name: 'VALUE', check: 'Number' },
            ],
            inputsInline: true,
            previousStatement: null,
            nextStatement: null,
            colour: COLORS.sprites,
            tooltip: 'Ajoute une valeur (positive ou négative) à une propriété du sprite.',
        },
        {
            type: 'karen_sprite_get',
            message0: '%1 de %2',
            args0: [
                { type: 'field_dropdown', name: 'PROP', options: SPRITE_PROPS },
                { type: 'input_value', name: 'SPRITE' },
            ],
            inputsInline: true,
            output: 'Number',
            colour: COLORS.sprites,
            tooltip: 'Donne une propriété du sprite.',
        },
        {
            type: 'karen_sprite_move',
            message0: 'déplacer %1 de x %2 y %3',
            args0: [
                { type: 'input_value', name: 'SPRITE' },
                { type: 'input_value', name: 'DX', check: 'Number' },
                { type: 'input_value', name: 'DY', check: 'Number' },
            ],
            inputsInline: true,
            previousStatement: null,
            nextStatement: null,
            colour: COLORS.sprites,
            tooltip: 'Téléporte le sprite de quelques pixels (sans tenir compte des murs).',
        },
        {
            type: 'karen_sprite_touching',
            message0: '%1 touche %2 ?',
            args0: [
                { type: 'input_value', name: 'SPRITE' },
                { type: 'field_dropdown', name: 'SIDE', options: TOUCH_SIDES },
            ],
            inputsInline: true,
            output: 'Boolean',
            colour: COLORS.sprites,
            tooltip: 'Vrai si le sprite a été arrêté par un bloc de ce côté pendant ce tick.',
        },
        {
            type: 'karen_sprite_destroy',
            message0: 'détruire %1',
            args0: [{ type: 'input_value', name: 'SPRITE' }],
            previousStatement: null,
            nextStatement: null,
            colour: COLORS.sprites,
            tooltip: 'Retire le sprite du jeu.',
        },
        // ── Camera ────────────────────────────────────────────────────────────
        {
            type: 'karen_camera_follow',
            message0: 'la caméra suit %1',
            args0: [{ type: 'input_value', name: 'SPRITE' }],
            previousStatement: null,
            nextStatement: null,
            colour: COLORS.camera,
            tooltip: 'La caméra se déplace pour garder ce sprite à l’écran.',
        },
        {
            type: 'karen_camera_move',
            message0: 'placer la caméra en x %1 y %2',
            args0: [
                { type: 'input_value', name: 'X', check: 'Number' },
                { type: 'input_value', name: 'Y', check: 'Number' },
            ],
            inputsInline: true,
            previousStatement: null,
            nextStatement: null,
            colour: COLORS.camera,
            tooltip: 'Place le coin haut-gauche de l’écran à cette position du niveau.',
        },
        // ── Control ───────────────────────────────────────────────────────────
        {
            type: 'karen_wait',
            message0: 'attendre %1 secondes',
            args0: [{ type: 'input_value', name: 'SECONDS', check: 'Number' }],
            inputsInline: true,
            previousStatement: null,
            nextStatement: null,
            colour: COLORS.control,
            tooltip: 'Met ce script en pause ; le reste du jeu continue.',
        },
        // ── Operators ─────────────────────────────────────────────────────────
        {
            type: 'karen_math_minmax',
            message0: '%1 de %2 et %3',
            args0: [
                {
                    type: 'field_dropdown',
                    name: 'OP',
                    options: [
                        ['minimum', 'min'],
                        ['maximum', 'max'],
                    ],
                },
                { type: 'input_value', name: 'A', check: 'Number' },
                { type: 'input_value', name: 'B', check: 'Number' },
            ],
            inputsInline: true,
            output: 'Number',
            colour: COLORS.operators,
            tooltip: 'Le plus petit (minimum) ou le plus grand (maximum) des deux nombres.',
        },
        // ── Sound ─────────────────────────────────────────────────────────────
        {
            type: 'karen_sound_stop_all',
            message0: 'arrêter tous les sons',
            previousStatement: null,
            nextStatement: null,
            colour: COLORS.sound,
            tooltip: 'Arrête tous les sons en train de jouer.',
        },
        // ── Registers (Record<string, number>) ───────────────────────────────
        {
            type: 'karen_dict_create',
            message0: 'nouveau registre vide',
            output: 'Registre',
            colour: COLORS.dicts,
            tooltip:
                'Un registre range des nombres sous des noms (clés), par exemple « pièces » → 12. ' +
                'À ranger dans une variable.',
        },
        {
            type: 'karen_dict_set',
            message0: 'mettre l’élément %1 du registre %2 à %3',
            args0: [
                { type: 'input_value', name: 'KEY' },
                { type: 'input_value', name: 'DICT' },
                { type: 'input_value', name: 'VALUE', check: 'Number' },
            ],
            inputsInline: true,
            previousStatement: null,
            nextStatement: null,
            colour: COLORS.dicts,
            tooltip: 'Range un nombre sous ce nom dans le registre.',
        },
        {
            type: 'karen_dict_change',
            message0: 'ajouter %3 à l’élément %1 du registre %2',
            args0: [
                { type: 'input_value', name: 'KEY' },
                { type: 'input_value', name: 'DICT' },
                { type: 'input_value', name: 'VALUE', check: 'Number' },
            ],
            inputsInline: true,
            previousStatement: null,
            nextStatement: null,
            colour: COLORS.dicts,
            tooltip: 'Ajoute un nombre à l’élément (un élément absent vaut 0).',
        },
        {
            type: 'karen_dict_get',
            message0: 'élément %1 du registre %2',
            args0: [
                { type: 'input_value', name: 'KEY' },
                { type: 'input_value', name: 'DICT' },
            ],
            inputsInline: true,
            output: 'Number',
            colour: COLORS.dicts,
            tooltip: 'Le nombre rangé sous ce nom (0 s’il n’y en a pas).',
        },
        {
            type: 'karen_dict_has',
            message0: 'le registre %1 contient %2 ?',
            args0: [
                { type: 'input_value', name: 'DICT' },
                { type: 'input_value', name: 'KEY' },
            ],
            inputsInline: true,
            output: 'Boolean',
            colour: COLORS.dicts,
            tooltip: 'Vrai si un nombre est rangé sous ce nom.',
        },
        {
            type: 'karen_dict_remove',
            message0: 'retirer l’élément %1 du registre %2',
            args0: [
                { type: 'input_value', name: 'KEY' },
                { type: 'input_value', name: 'DICT' },
            ],
            inputsInline: true,
            previousStatement: null,
            nextStatement: null,
            colour: COLORS.dicts,
            tooltip: 'Retire ce nom (et son nombre) du registre.',
        },
        // ── Level ─────────────────────────────────────────────────────────────
        {
            type: 'karen_level_cell_of',
            message0: '%1 de la case sous %2',
            args0: [
                {
                    type: 'field_dropdown',
                    name: 'AXIS',
                    options: [
                        ['colonne', 'col'],
                        ['ligne', 'row'],
                    ],
                },
                { type: 'input_value', name: 'SPRITE' },
            ],
            inputsInline: true,
            output: 'Number',
            colour: COLORS.level,
            tooltip:
                'La colonne ou la ligne de la case où se trouve le centre du sprite ' +
                '(les cases font 32 pixels, la première est la 0).',
        },
    ]);

    // Blocks whose menus depend on the project (dynamic dropdowns) are defined in JS.
    Blockly.Blocks['karen_sprite_create'] = {
        init(this: Blockly.Block) {
            this.appendDummyInput()
                .appendField('créer le sprite')
                .appendField(new Blockly.FieldDropdown(spriteOptions), 'SPRITE');
            this.appendValueInput('X').setCheck('Number').appendField('en x');
            this.appendValueInput('Y').setCheck('Number').appendField('y');
            this.setInputsInline(true);
            this.setOutput(true, 'Sprite');
            this.setColour(COLORS.sprites);
            this.setTooltip(
                'Crée un nouveau sprite dans le niveau et le donne (à ranger dans une variable).'
            );
        },
    };

    Blockly.Blocks['karen_on_sprite_tile'] = {
        init(this: Blockly.Block) {
            this.appendDummyInput()
                .appendField('quand un sprite')
                .appendField(new Blockly.FieldDropdown(tagOptions), 'TAG')
                .appendField('touche un bloc solide');
            this.setNextStatement(true);
            this.setColour(COLORS.events);
            this.setTooltip(
                'Pour chaque sprite de ce tag arrêté par un bloc pendant ce tick. ' +
                    'Utilise « ce sprite » pour parler de lui.'
            );
        },
    };

    Blockly.Blocks['karen_on_sprite_sprite'] = {
        init(this: Blockly.Block) {
            this.appendDummyInput()
                .appendField('quand un sprite')
                .appendField(new Blockly.FieldDropdown(tagOptions), 'TAG')
                .appendField('touche un sprite')
                .appendField(new Blockly.FieldDropdown(tagOptions), 'OTHER');
            this.setNextStatement(true);
            this.setColour(COLORS.events);
            this.setTooltip(
                'Pour chaque paire de sprites de ces tags qui se touchent. ' +
                    'Utilise « ce sprite » et « l’autre sprite ».'
            );
        },
    };

    Blockly.Blocks['karen_level_set_tile'] = {
        init(this: Blockly.Block) {
            this.appendDummyInput().appendField('mettre la case');
            this.appendValueInput('X').setCheck('Number').appendField('colonne');
            this.appendValueInput('Y').setCheck('Number').appendField('ligne');
            this.appendDummyInput()
                .appendField('à')
                .appendField(new Blockly.FieldDropdown(bobOptions), 'BOB');
            this.setInputsInline(true);
            this.setPreviousStatement(true);
            this.setNextStatement(true);
            this.setColour(COLORS.level);
            this.setTooltip('Remplace une case du niveau par un BOB (ou la vide).');
        },
    };

    Blockly.Blocks['karen_level_tile_is'] = {
        init(this: Blockly.Block) {
            this.appendDummyInput().appendField('la case');
            this.appendValueInput('X').setCheck('Number').appendField('colonne');
            this.appendValueInput('Y').setCheck('Number').appendField('ligne');
            this.appendDummyInput()
                .appendField('est')
                .appendField(new Blockly.FieldDropdown(bobOptions), 'BOB')
                .appendField('?');
            this.setInputsInline(true);
            this.setOutput(true, 'Boolean');
            this.setColour(COLORS.level);
            this.setTooltip('Vrai si cette case du niveau contient ce BOB.');
        },
    };

    Blockly.Blocks['karen_level_goto'] = {
        init(this: Blockly.Block) {
            this.appendDummyInput()
                .appendField('aller au niveau')
                .appendField(new Blockly.FieldDropdown(levelOptions), 'LEVEL');
            this.setPreviousStatement(true);
            this.setNextStatement(true);
            this.setColour(COLORS.level);
            this.setTooltip(
                'Change de niveau à la fin du tick : tous les sprites disparaissent, ' +
                    'puis « quand le niveau commence » est exécuté. Les variables sont gardées.'
            );
        },
    };

    /** A statement block made of a label and the sound dropdown. */
    const soundStatement = (type: string, before: string, after: string, tooltip: string) => {
        Blockly.Blocks[type] = {
            init(this: Blockly.Block) {
                const input = this.appendDummyInput()
                    .appendField(before)
                    .appendField(new Blockly.FieldDropdown(soundOptions), 'SOUND');
                if (after) {
                    input.appendField(after);
                }
                this.setPreviousStatement(true);
                this.setNextStatement(true);
                this.setColour(COLORS.sound);
                this.setTooltip(tooltip);
            },
        };
    };
    soundStatement(
        'karen_sound_play',
        'jouer le son',
        '',
        'Joue le son ; le script continue tout de suite.'
    );
    soundStatement(
        'karen_sound_play_wait',
        'jouer le son',
        "jusqu'au bout",
        'Joue le son et attend qu’il soit fini avant de continuer.'
    );
    soundStatement(
        'karen_sound_stop',
        'arrêter le son',
        '',
        'Arrête ce son s’il est en train de jouer.'
    );

    Blockly.Blocks['karen_on_sound_end'] = {
        init(this: Blockly.Block) {
            this.appendDummyInput()
                .appendField('quand le son')
                .appendField(new Blockly.FieldDropdown(soundOptions), 'SOUND')
                .appendField('est terminé');
            this.setNextStatement(true);
            this.setColour(COLORS.events);
            this.setTooltip(
                'Exécute les blocs en dessous quand ce son finit de jouer (pas quand il est arrêté).'
            );
        },
    };
}
