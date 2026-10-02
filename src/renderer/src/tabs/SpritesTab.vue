<script setup lang="ts">
import { computed, ref, toRaw, watch } from 'vue';
import AssetList from '../components/AssetList.vue';
import PixelEditor from '../components/PixelEditor.vue';
import PaletteGrid from '../components/PaletteGrid.vue';
import { store, touch } from '../store/project';
import { nextId } from '@project/model';
import { blankPixels } from '@project/pixels';

const selectedId = ref<number | null>(store.project.sprites[0]?.id ?? null);
const color = ref(30);
const sprite = computed(() => store.project.sprites.find((s) => s.id === selectedId.value) ?? null);

watch(
    () => store.generation,
    () => (selectedId.value = store.project.sprites[0]?.id ?? null)
);

function add(): void {
    const id = nextId(store.project.sprites);
    store.project.sprites.push({ id, name: `Sprite ${id}`, tag: '', pixels: blankPixels() });
    selectedId.value = id;
    touch();
}

function duplicate(): void {
    if (!sprite.value) return;
    const id = nextId(store.project.sprites);
    store.project.sprites.push({
        ...structuredClone(toRaw(sprite.value)),
        id,
        name: `${sprite.value.name} (copie)`,
    });
    selectedId.value = id;
    touch();
}

function remove(): void {
    const current = sprite.value;
    if (
        !current ||
        !window.confirm(
            `Supprimer « ${current.name} » ? Les blocs qui le créent ne marcheront plus.`
        )
    ) {
        return;
    }
    const index = store.project.sprites.indexOf(current);
    store.project.sprites.splice(index, 1);
    selectedId.value =
        store.project.sprites[Math.min(index, store.project.sprites.length - 1)]?.id ?? null;
    touch();
}

function setPixels(pixels: number[]): void {
    if (sprite.value) {
        sprite.value.pixels = pixels;
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
            :items="store.project.sprites"
            :palette="store.project.palette"
            @add="add"
            @duplicate="duplicate"
            @remove="remove"
        />
        <div v-if="sprite" class="editor">
            <div class="props">
                <label>Nom <input v-model="sprite.name" @input="touch" /></label>
                <label title="Sert aux événements « sprite de tag … touche … »">
                    Tag <input v-model="sprite.tag" placeholder="ex. ennemi" @input="touch" />
                </label>
            </div>
            <div class="drawing">
                <PixelEditor
                    v-model:color="color"
                    :pixels="sprite.pixels"
                    :palette="store.project.palette"
                    @update:pixels="setPixels"
                />
                <PaletteGrid v-model="color" :palette="store.project.palette" @edit="editPalette" />
            </div>
            <p class="hint">
                La couleur « transparent » (case en damier) laisse voir le décor derrière le sprite.
            </p>
        </div>
        <p v-else class="empty">Aucun sprite : clique sur « Ajouter » pour en créer un.</p>
    </div>
</template>

<style scoped src="./workbench.css"></style>
