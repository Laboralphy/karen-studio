<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue';
import GamePanel from './components/GamePanel.vue';
import { TABS } from './tabs';
import { store } from './store/project';

// Window title: project name, with a mark when there are unsaved changes.
watchEffect(() => {
    document.title = `${store.dirty ? '● ' : ''}${store.project.name} — Karen Studio`;
});

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
            </nav>
            <div class="tab-content">
                <!-- Les onglets restent montés (KeepAlive) pour conserver leur état. -->
                <KeepAlive>
                    <component
                        :is="activeTab.component"
                        :key="activeTab.id"
                        :title="activeTab.label"
                        :description="activeTab.description"
                    />
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
