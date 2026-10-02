<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue';
import GamePanel from './components/GamePanel.vue';
import { TABS } from './tabs';
import { AUTOSAVE_MS, autosave, offerAutosaveRestore, redo, store, undo } from './store/project';

// Window title: project name, with a mark when there are unsaved changes.
watchEffect(() => {
    document.title = `${store.dirty ? '● ' : ''}${store.project.name} — Karen Studio`;
});

/**
 * Ctrl+Z / Ctrl+Y (or Ctrl+Shift+Z): undo / redo the project edits. Left to the browser in
 * text fields, to Blockly in the Code tab, and ignored while the game has the keyboard.
 */
window.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const key = e.key.toLowerCase();
    const isUndo = key === 'z' && !e.shiftKey;
    const isRedo = key === 'y' || (key === 'z' && e.shiftKey);
    if (!isUndo && !isRedo) return;
    const target = e.target as HTMLElement | null;
    if (
        activeId.value === 'code' ||
        target?.closest('input, textarea, select, [contenteditable], canvas[tabindex]')
    ) {
        return;
    }
    e.preventDefault();
    if (isUndo) undo();
    else redo();
});

// Crash recovery: offer the safety copy at start-up, then keep it up to date.
void offerAutosaveRestore();
setInterval(() => void autosave(), AUTOSAVE_MS);

// Unsaved changes: block closing; the main process then asks for confirmation.
window.addEventListener('beforeunload', (e) => {
    if (store.dirty) {
        e.preventDefault();
        e.returnValue = false;
    }
});

const activeId = ref(TABS[0].id);
const activeTab = computed(() => TABS.find((t) => t.id === activeId.value) ?? TABS[0]);
</script>

<template>
    <div class="layout">
        <main class="editor">
            <nav class="tabs">
                <button
                    v-for="tab in TABS"
                    :key="tab.id"
                    :class="{ active: tab.id === activeId }"
                    @click="activeId = tab.id"
                >
                    {{ tab.label }}
                </button>
                <span class="spacer" />
                <button
                    class="history"
                    :disabled="!store.canUndo || activeId === 'code'"
                    title="Annuler (Ctrl+Z)"
                    @click="undo"
                >
                    ↶ Annuler
                </button>
                <button
                    class="history"
                    :disabled="!store.canRedo || activeId === 'code'"
                    title="Rétablir (Ctrl+Y)"
                    @click="redo"
                >
                    ↷ Rétablir
                </button>
            </nav>
            <div class="tab-content">
                <!-- Les onglets restent montés (KeepAlive) pour conserver leur état. -->
                <KeepAlive>
                    <component :is="activeTab.component" :key="activeTab.id" />
                </KeepAlive>
            </div>
        </main>
        <GamePanel />
    </div>
</template>

<style scoped>
.layout {
    display: flex;
    height: 100%;
}

.editor {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
}

.tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 2px;
    padding: 8px 8px 0;
    background: var(--panel);
    border-bottom: 1px solid var(--border);
}

.tabs button {
    border-radius: 6px 6px 0 0;
    border-bottom: none;
    background: transparent;
}

.tabs .spacer {
    flex: 1;
}

.tabs button.history {
    border-radius: 6px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 6px;
    padding: 2px 10px;
    font-size: 13px;
}

.tabs button.active {
    background: var(--bg);
    color: var(--accent);
}

.tab-content {
    flex: 1;
    min-height: 0;
    overflow: auto;
}
</style>
