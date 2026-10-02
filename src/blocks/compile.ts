import * as Blockly from 'blockly/core';
import 'blockly/blocks';
import { javascriptGenerator } from 'blockly/javascript';
import * as Fr from 'blockly/msg/fr';
import { defineKarenBlocks, HAT_TYPES, PROCEDURE_TYPES, setBlocksProject } from './definitions';
import { registerKarenGenerators } from './generators';
import type { KarenProject } from '../project/model';

/**
 * Make sure the French messages, blocks and generators are registered.
 * Blockly's standard blocks cannot be built without their messages.
 */
export function initKarenBlockly(): void {
    Blockly.setLocale(Fr as unknown as Record<string, string>);
    defineKarenBlocks();
    registerKarenGenerators();
}

/**
 * Compile the project's Blockly workspace into JavaScript.
 * Only scripts starting with an event block, and function definitions, are compiled;
 * loose blocks are ignored.
 * The result is the body of a function taking the script API object (`__k`), which
 * registers the event handlers (generator functions) and declares the variables.
 */
export function compileProject(
    project: Pick<KarenProject, 'code' | 'sprites' | 'bobs' | 'levels' | 'sounds'>
): string {
    initKarenBlockly();
    if (!project.code) {
        return '';
    }
    // Dropdown values are validated against the menus: they must list this project's items.
    // The editor's own getter is restored afterwards.
    const previous = setBlocksProject(() => project);
    const workspace = new Blockly.Workspace();
    try {
        Blockly.serialization.workspaces.load(project.code, workspace);
        javascriptGenerator.init(workspace);
        const scripts = workspace
            .getTopBlocks(true)
            .filter(
                (block) =>
                    (HAT_TYPES.has(block.type) || PROCEDURE_TYPES.has(block.type)) &&
                    block.isEnabled()
            )
            .map((block) => javascriptGenerator.blockToCode(block, true) as string);
        return javascriptGenerator.finish(scripts.join('\n'));
    } finally {
        workspace.dispose();
        setBlocksProject(previous);
    }
}
