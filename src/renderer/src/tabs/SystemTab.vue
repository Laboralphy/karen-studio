<script setup lang="ts">
import { computed, ref } from 'vue';
import { createNewProject, openProjectFile, saveProjectFile, store, touch } from '../store/project';

const message = ref<{ text: string; error: boolean } | null>(null);
const fileName = computed(() => store.filePath?.split(/[\\/]/).pop() ?? 'pas encore enregistré');

async function run(action: () => Promise<boolean> | boolean, success: string): Promise<void> {
    message.value = null;
    try {
        if (await action()) {
            message.value = { text: success, error: false };
        }
    } catch (e) {
        message.value = { text: (e as Error).message, error: true };
    }
}

const onNew = () =>
    run(() => {
        const before = store.generation;
        createNewProject();
        return store.generation !== before;
    }, 'Nouveau projet créé.');
const onOpen = () => run(openProjectFile, 'Projet ouvert.');
const onSave = () => run(() => saveProjectFile(false), 'Projet enregistré.');
const onSaveAs = () => run(() => saveProjectFile(true), 'Projet enregistré.');
</script>

<template>
    <div class="system">
        <section>
            <h2>Projet</h2>
            <div class="buttons">
                <button @click="onNew">Nouveau</button>
                <button @click="onOpen">Ouvrir…</button>
                <button @click="onSave">Enregistrer</button>
                <button @click="onSaveAs">Enregistrer sous…</button>
            </div>
            <p class="file">
                Fichier : <strong>{{ fileName }}</strong>
                <span v-if="store.dirty" class="dirty">● modifications non enregistrées</span>
            </p>
            <p v-if="message" :class="message.error ? 'error' : 'ok'">{{ message.text }}</p>
        </section>
        <section>
            <h2>Réglages du jeu</h2>
            <label>Nom du jeu <input v-model="store.project.name" @input="touch" /></label>
            <label>
                Vitesse du jeu
                <select v-model.number="store.project.settings.tickRate" @change="touch">
                    <option :value="30">30 ticks par seconde (fluide)</option>
                    <option :value="20">20 ticks par seconde (rétro)</option>
                </select>
            </label>
        </section>
    </div>
</template>

<style scoped>
.system {
    padding: 16px 24px;
    display: flex;
    flex-direction: column;
    gap: 24px;
}

h2 {
    margin: 0 0 12px;
}

section {
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-width: 560px;
}

.buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

label {
    display: flex;
    align-items: center;
    gap: 8px;
}

input,
select {
    font: inherit;
    color: var(--text);
    background: var(--panel-2);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 4px 6px;
}

input[type='color'] {
    width: 48px;
    height: 28px;
    padding: 0 2px;
}

.file {
    margin: 0;
    color: var(--text-dim);
}

.dirty {
    margin-left: 8px;
    color: var(--accent);
}

.ok {
    margin: 0;
    color: #7bd88f;
}

.error {
    margin: 0;
    color: var(--danger);
}
</style>
