/**
 * Tiny builders for Blockly workspace JSON, to write test programs compactly.
 * Variable ids are the variable names.
 */

type Json = Record<string, unknown>;

/** A number literal input. */
export const num = (n: number): Json => ({ shadow: { type: 'math_number', fields: { NUM: n } } });
/** A text literal input. */
export const txt = (t: string): Json => ({ shadow: { type: 'text', fields: { TEXT: t } } });
/** Wrap a block as an input value. */
export const val = (block: Json): Json => ({ block });

/** A block with optional fields, inputs and extra state. */
export function blk(
    type: string,
    opts: { fields?: Json; inputs?: Json; extraState?: Json } = {}
): Json {
    return { type, ...opts };
}

/** Chain statement blocks with `next`; returns the first one (or undefined). */
export function chain(blocks: Json[]): Json | undefined {
    for (let i = blocks.length - 2; i >= 0; i--) {
        blocks[i] = { ...blocks[i], next: { block: blocks[i + 1] } };
    }
    return blocks[0];
}

/** A hat block followed by its script. */
export function hat(type: string, fields: Json, ...body: Json[]): Json {
    const first = chain(body);
    return { type, fields, ...(first ? { next: { block: first } } : {}) };
}

/** A statement input (C-shaped block body). */
export const stmts = (...body: Json[]): Json => ({ block: chain(body) });

export const getVar = (name: string): Json =>
    val({ type: 'variables_get', fields: { VAR: { id: name } } });
export const setVar = (name: string, value: Json): Json =>
    blk('variables_set', { fields: { VAR: { id: name } }, inputs: { VALUE: value } });

/** `if (cond) { body }`. */
export const ifThen = (cond: Json, ...body: Json[]): Json =>
    blk('controls_if', { inputs: { IF0: cond, DO0: stmts(...body) } });

/** `a OP b` comparison. */
export const compare = (a: Json, op: 'EQ' | 'NEQ' | 'LT' | 'GT', b: Json): Json =>
    val(blk('logic_compare', { fields: { OP: op }, inputs: { A: a, B: b } }));

/** A complete workspace. */
export function workspace(tops: Json[], variables: string[] = []): Json {
    return {
        blocks: { languageVersion: 0, blocks: tops },
        variables: variables.map((name) => ({ name, id: name })),
    };
}
