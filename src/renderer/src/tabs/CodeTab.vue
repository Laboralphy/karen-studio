<script setup lang="ts">
import { onActivated, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import * as Blockly from 'blockly/core';
import 'blockly/blocks';
import { initKarenBlockly } from '@blocks/compile';
import { setBlocksProject } from '@blocks/definitions';
import { TOOLBOX } from '../blockly/toolbox';
import { store, touch } from '../store/project';

initKarenBlockly();
setBlocksProject(() => store.project);

const theme = Blockly.Theme.defineTheme('karen', {
    name: 'karen',
    base: Blockly.Themes.Classic,
    startHats: true,
    componentStyles: {
        workspaceBackgroundColour: '#1e1f2b',
        toolboxBackgroundColour: '#282a3a',
        toolboxForegroundColour: '#e8e8f0',
        flyoutBackgroundColour: '#33364a',
        flyoutForegroundColour: '#e8e8f0',
        flyoutOpacity: 1,
        scrollbarColour: '#44485f',
        insertionMarkerColour: '#ffffff',
        insertionMarkerOpacity: 0.3,
    },
});

const host = ref<HTMLDivElement | null>(null);
let workspace: Blockly.WorkspaceSvg | null = null;
let resizeObserver: ResizeObserver | null = null;

/** Replace the workspace content with the project's code, without marking it modified. */
function loadFromProject(): void {
    if (!workspace) return;
    // Blockly fires its events asynchronously: disable them so loading is not an edit.
    Blockly.Events.disable();
    try {
        workspace.clear();
        if (store.project.code) {
            Blockly.serialization.workspaces.load(store.project.code, workspace);
        }
    } finally {
        Blockly.Events.enable();
    }
    workspace.clearUndo();
}

onMounted(() => {
    workspace = Blockly.inject(host.value!, {
        toolbox: TOOLBOX,
        renderer: 'zelos',
        theme,
        media: './blockly-media/',
        sounds: false,
        trashcan: true,
        grid: { spacing: 24, length: 2, colour: '#33364a', snap: true },
        zoom: { controls: true, wheel: true, startScale: 0.8, maxScale: 2, minScale: 0.3 },
        move: { scrollbars: true, drag: true, wheel: false },
    });
    loadFromProject();
    workspace.addChangeListener((event) => {
        if (event.isUiEvent || !workspace) return;
        store.project.code = Blockly.serialization.workspaces.save(workspace);
        touch();
    });
    resizeObserver = new ResizeObserver(() => workspace && Blockly.svgResize(workspace));
    resizeObserver.observe(host.value!);
});

// The tab was hidden (KeepAlive): Blockly must recompute its size when shown again.
onActivated(() => workspace && Blockly.svgResize(workspace));

// A new project was created or opened.
watch(() => store.generation, loadFromProject);

onBeforeUnmount(() => {
    resizeObserver?.disconnect();
    workspace?.dispose();
    workspace = null;
});
</script>

<template>
    <div ref="host" class="code-tab" />
</template>

<style scoped>
.code-tab {
    width: 100%;
    height: 100%;
}
</style>
