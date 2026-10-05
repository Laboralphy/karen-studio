<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import AssetList from '../components/AssetList.vue';
import PixelEditor from '../components/PixelEditor.vue';
import PaletteGrid from '../components/PaletteGrid.vue';
import FrameStrip from '../components/FrameStrip.vue';
import AnimPreview from '../components/AnimPreview.vue';
import TextureGenerator from '../components/TextureGenerator.vue';
import { plainCopy, store, touch } from '../store/project';
import { nextId, type BobCollision, type Frame } from '@project/model';
import { blankPixels, editAllFrames, type PixelEdit } from '@project/pixels';
import { removeBobFromLevels } from '@project/level';
import type { Material } from '@project/textures';

const COLLISIONS: { value: BobCollision; label: string }[] = [
    { value: 'solid', label: 'Solide (bloque les sprites)' },
    { value: 'platform', label: 'Plateforme (on peut sauter à travers par-dessous)' },
    { value: 'air', label: 'Décor (les sprites passent devant)' },
];

const selectedId = ref<number | null>(store.project.bobs[0]?.id ?? null);
const frameIndex = ref(0);
const color = ref(11);
const mode = ref<'draw' | 'generate'>('draw');
const bob = computed(() => store.project.bobs.find((b) => b.id === selectedId.value) ?? null);

// A new or opened project: select its first BOB.
watch(
    () => store.generation,
    () => (selectedId.value = store.project.bobs[0]?.id ?? null)
);
watch(selectedId, () => (frameIndex.value = 0));
// An undo can remove the image being edited.
watch(
    () => bob.value?.frames.length ?? 1,
    (n) => (frameIndex.value = Math.min(frameIndex.value, n - 1))
);

function addBob(name: string, frames: Frame[], collision: BobCollision): void {
    const id = nextId(store.project.bobs);
    store.project.bobs.push({ id, name, collision, frames, frameDuration: 8 });
    selectedId.value = id;
    touch();
}

const add = () => addBob(`BOB ${nextId(store.project.bobs)}`, [blankPixels()], 'solid');

function duplicate(): void {
    if (!bob.value) return;
    const copy = plainCopy(bob.value);
    addBob(`${copy.name} (copie)`, copy.frames, copy.collision);
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

/** « Dessiner sur toutes les images »: each edit is applied to every image. */
const drawAll = ref(false);

function setPixels(pixels: number[], edit: PixelEdit): void {
    const current = bob.value;
    if (!current) return;
    if (drawAll.value && current.frames.length > 1) {
        current.frames = editAllFrames(current.frames, frameIndex.value, pixels, edit);
    } else {
        current.frames[frameIndex.value] = pixels;
    }
    touch();
}

function setFrames(frames: Frame[]): void {
    if (bob.value) {
        bob.value.frames = frames;
        touch();
    }
}

function setDuration(value: number): void {
    if (bob.value) {
        bob.value.frameDuration = Math.min(60, Math.max(1, Math.round(value) || 1));
        touch();
    }
}

function editPalette(index: number, value: string): void {
    store.project.palette[index] = value;
    touch();
}

function createFromTexture(frames: Frame[], material: Material): void {
    addBob(material.name, frames, material.collision);
    mode.value = 'draw';
}

function replaceWithTexture(frames: Frame[], material: Material): void {
    const current = bob.value;
    if (!current) return;
    current.frames = frames;
    current.collision = material.collision;
    frameIndex.value = 0;
    touch();
    mode.value = 'draw';
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
        <div class="editor">
            <div class="modes">
                <button :class="{ active: mode === 'draw' }" @click="mode = 'draw'">
                    Dessiner
                </button>
                <button :class="{ active: mode === 'generate' }" @click="mode = 'generate'">
                    Générer une texture
                </button>
            </div>

            <TextureGenerator
                v-if="mode === 'generate'"
                :palette="store.project.palette"
                :can-replace="bob !== null"
                @create="createFromTexture"
                @replace="replaceWithTexture"
            />

            <template v-else-if="bob">
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
                <FrameStrip
                    v-model="frameIndex"
                    :frames="bob.frames"
                    :palette="store.project.palette"
                    @update:frames="setFrames"
                />
                <label
                    v-if="bob.frames.length > 1"
                    class="all-frames-toggle"
                    :class="{ on: drawAll }"
                    title="Chaque pixel dessiné est ajouté au même endroit sur toutes les images"
                >
                    <input v-model="drawAll" type="checkbox" />
                    Dessiner sur toutes les images
                </label>
                <div v-if="bob.frames.length > 1" class="props">
                    <AnimPreview
                        :frames="bob.frames"
                        :palette="store.project.palette"
                        :duration="bob.frameDuration"
                        :scale="2"
                    />
                    <label>
                        Une image tous les
                        <input
                            :value="bob.frameDuration"
                            type="number"
                            min="1"
                            max="60"
                            class="small"
                            @change="setDuration(Number(($event.target as HTMLInputElement).value))"
                        />
                        ticks
                    </label>
                </div>
                <div class="drawing">
                    <PixelEditor
                        v-model:color="color"
                        :pixels="bob.frames[frameIndex]"
                        :all-frames="drawAll && bob.frames.length > 1"
                        :palette="store.project.palette"
                        @update:pixels="setPixels"
                    />
                    <PaletteGrid
                        v-model="color"
                        :palette="store.project.palette"
                        @edit="editPalette"
                    />
                </div>
            </template>
            <p v-else class="empty">Aucun BOB : clique sur « Ajouter » ou génère une texture.</p>
        </div>
    </div>
</template>

<style scoped src="./workbench.css"></style>
<style scoped>
.modes {
    display: flex;
    gap: 4px;
}

.modes button.active {
    border-color: var(--accent);
    background: var(--border);
}

.small {
    width: 56px;
}
</style>
