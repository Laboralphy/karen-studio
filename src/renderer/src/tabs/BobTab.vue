<script setup lang="ts">
import { computed, ref, toRaw, watch } from 'vue';
import AssetList from '../components/AssetList.vue';
import PixelEditor from '../components/PixelEditor.vue';
import PaletteGrid from '../components/PaletteGrid.vue';
import { store, touch } from '../store/project';
import { nextId, type BobCollision } from '@project/model';
import { blankPixels } from '@project/pixels';
import { removeBobFromLevels } from '@project/level';

const COLLISIONS: { value: BobCollision; label: string }[] = [
    { value: 'solid', label: 'Solide (bloque les sprites)' },
    { value: 'platform', label: 'Plateforme (on peut sauter à travers par-dessous)' },
    { value: 'air', label: 'Décor (les sprites passent devant)' },
];

const selectedId = ref<number | null>(store.project.bobs[0]?.id ?? null);
const color = ref(11);
const bob = computed(() => store.project.bobs.find((b) => b.id === selectedId.value) ?? null);

// A new or opened project: select its first BOB.
watch(
    () => store.generation,
    () => (selectedId.value = store.project.bobs[0]?.id ?? null)
);

function add(): void {
    const id = nextId(store.project.bobs);
    store.project.bobs.push({ id, name: `BOB ${id}`, collision: 'solid', pixels: blankPixels() });
    selectedId.value = id;
    touch();
}

function duplicate(): void {
    if (!bob.value) return;
    const id = nextId(store.project.bobs);
    store.project.bobs.push({
        ...structuredClone(toRaw(bob.value)),
        id,
        name: `${bob.value.name} (copie)`,
    });
    selectedId.value = id;
    touch();
}

function remove(): void {
    const current = bob.value;
    if (!current) return;
    const used = store.project.levels.some((l) => l.tiles.includes(current.id));
    const question = used
        ? `« ${current.name} » est utilisé dans un niveau. Le supprimer quand même ? Les cases deviendront vides.`
        : `Supprimer « ${current.name} » ?`;
    if (!window.confirm(question)) return;
    const index = store.project.bobs.indexOf(current);
    store.project.bobs.splice(index, 1);
    removeBobFromLevels(store.project.levels, current.id);
    selectedId.value =
        store.project.bobs[Math.min(index, store.project.bobs.length - 1)]?.id ?? null;
    touch();
}

function setPixels(pixels: number[]): void {
    if (bob.value) {
        bob.value.pixels = pixels;
        touch();
    }
}

function editPalette(index: number, value: string): void {
    store.project.palette[index] = value;
    touch();
}
</script>

<template>
    <div class="workbench">
        <AssetList
            v-model="selectedId"
            :items="store.project.bobs"
            :palette="store.project.palette"
            @add="add"
            @duplicate="duplicate"
            @remove="remove"
        />
        <div v-if="bob" class="editor">
            <div class="props">
                <label>Nom <input v-model="bob.name" @input="touch" /></label>
                <label>
                    Type
                    <select v-model="bob.collision" @change="touch">
                        <option v-for="c in COLLISIONS" :key="c.value" :value="c.value">
                            {{ c.label }}
                        </option>
                    </select>
                </label>
            </div>
            <div class="drawing">
                <PixelEditor
                    v-model:color="color"
                    :pixels="bob.pixels"
                    :palette="store.project.palette"
                    @update:pixels="setPixels"
                />
                <PaletteGrid v-model="color" :palette="store.project.palette" @edit="editPalette" />
            </div>
        </div>
        <p v-else class="empty">Aucun BOB : clique sur « Ajouter » pour en créer un.</p>
    </div>
</template>

<style scoped src="./workbench.css"></style>
