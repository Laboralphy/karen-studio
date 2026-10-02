import { COLORS } from '@blocks/definitions';

const num = (n: number) => ({ shadow: { type: 'math_number', fields: { NUM: n } } });
const text = (t: string) => ({ shadow: { type: 'text', fields: { TEXT: t } } });
const block = (type: string, extra: object = {}) => ({ kind: 'block', type, ...extra });
const label = (text: string) => ({ kind: 'label', text });

/** Toolbox of the Code tab: categories, as on Scratch. */
export const TOOLBOX = {
    kind: 'categoryToolbox',
    contents: [
        {
            kind: 'category',
            name: 'Événements',
            colour: COLORS.events,
            contents: [
                block('karen_on_start'),
                block('karen_on_level_start'),
                block('karen_on_tick'),
                block('karen_on_key'),
                block('karen_on_sound_end'),
                label('Événements de sprites'),
                block('karen_on_sprite_tile'),
                block('karen_on_sprite_sprite'),
                block('karen_event_self'),
                block('karen_event_other'),
            ],
        },
        {
            kind: 'category',
            name: 'Contrôle',
            colour: COLORS.control,
            contents: [
                block('karen_wait', { inputs: { SECONDS: num(1) } }),
                block('controls_repeat_ext', { inputs: { TIMES: num(10) } }),
                block('controls_whileUntil'),
                block('controls_if'),
                block('controls_if', { extraState: { hasElse: true } }),
            ],
        },
        {
            kind: 'category',
            name: 'Opérateurs',
            colour: COLORS.operators,
            contents: [
                block('math_number'),
                block('math_arithmetic', { inputs: { A: num(1), B: num(1) } }),
                block('math_random_int', { inputs: { FROM: num(1), TO: num(10) } }),
                block('karen_math_minmax', { inputs: { A: num(1), B: num(2) } }),
                block('math_constrain', {
                    inputs: { VALUE: num(50), LOW: num(0), HIGH: num(100) },
                }),
                block('math_round'),
                block('logic_compare'),
                block('logic_operation'),
                block('logic_negate'),
                block('logic_boolean'),
                block('text'),
                block('text_join'),
            ],
        },
        { kind: 'category', name: 'Variables', colour: '#e65c8a', custom: 'VARIABLE' },
        { kind: 'category', name: 'Fonctions', colour: '#9a5ce6', custom: 'PROCEDURE' },
        {
            kind: 'category',
            name: 'Tableaux',
            colour: COLORS.lists,
            contents: [
                block('lists_create_with', { extraState: { itemCount: 0 } }),
                block('lists_create_with'),
                block('lists_repeat', { inputs: { NUM: num(5) } }),
                block('lists_length'),
                block('lists_isEmpty'),
                block('lists_getIndex'),
                block('lists_setIndex'),
                block('lists_indexOf'),
            ],
        },
        {
            kind: 'category',
            name: 'Registres',
            colour: COLORS.dicts,
            contents: [
                block('karen_dict_create'),
                block('karen_dict_set', { inputs: { KEY: text('score'), VALUE: num(0) } }),
                block('karen_dict_change', { inputs: { KEY: text('score'), VALUE: num(1) } }),
                block('karen_dict_get', { inputs: { KEY: text('score') } }),
                block('karen_dict_has', { inputs: { KEY: text('score') } }),
                block('karen_dict_remove', { inputs: { KEY: text('score') } }),
            ],
        },
        {
            kind: 'category',
            name: 'Sprites',
            colour: COLORS.sprites,
            contents: [
                block('karen_sprite_create', { inputs: { X: num(64), Y: num(64) } }),
                block('karen_sprite_set', { inputs: { VALUE: num(0) } }),
                block('karen_sprite_change', { inputs: { VALUE: num(1) } }),
                block('karen_sprite_get'),
                block('karen_sprite_move', { inputs: { DX: num(10), DY: num(0) } }),
                block('karen_sprite_touching'),
                block('karen_sprite_destroy'),
            ],
        },
        {
            kind: 'category',
            name: 'Niveau',
            colour: COLORS.level,
            contents: [
                block('karen_level_set_tile', { inputs: { X: num(0), Y: num(0) } }),
                block('karen_level_tile_is', { inputs: { X: num(0), Y: num(0) } }),
                block('karen_level_cell_of'),
                block('karen_level_goto'),
            ],
        },
        {
            kind: 'category',
            name: 'Son',
            colour: COLORS.sound,
            contents: [
                block('karen_sound_play'),
                block('karen_sound_play_wait'),
                block('karen_sound_stop'),
                block('karen_sound_stop_all'),
            ],
        },
        {
            kind: 'category',
            name: 'Caméra',
            colour: COLORS.camera,
            contents: [
                block('karen_camera_follow'),
                block('karen_camera_move', { inputs: { X: num(0), Y: num(0) } }),
            ],
        },
        {
            kind: 'category',
            name: 'Clavier',
            colour: COLORS.keyboard,
            contents: [block('karen_key_down')],
        },
    ],
};
