<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import AssetList from '../components/AssetList.vue';
import PixelEditor from '../components/PixelEditor.vue';
import PaletteGrid from '../components/PaletteGrid.vue';
import FrameStrip from '../components/FrameStrip.vue';
import AnimPreview from '../components/AnimPreview.vue';
import { plainCopy, store, touch } from '../store/project';
import { nextId, type Frame, type SpriteAnimation } from '@project/model';
import { blankPixels } from '@project/pixels';

const selectedId = ref<number | null>(store.project.sprites[0]?.id ?? null);
const frameIndex = ref(0);
const color = ref(30);
const sprite = computed(() => store.project.sprites.find((s) => s.id === selectedId.value) ?? null);

watch(
    () => store.generation,
    () => (selectedId.value = store.project.sprites[0]?.id ?? null)
);
watch(selectedId, () => (frameIndex.value = 0));
// An undo can remove the image being edited.
watch(
    () => sprite.value?.frames.length ?? 1,
    (n) => (frameIndex.value = Math.min(frameIndex.value, n - 1))
);

function add(): void {
    const id = nextId(store.project.sprites);
    store.project.sprites.push({
        id,
        name: `Sprite ${id}`,
        tag: '',
        frames: [blankPixels()],
        animations: [],
    });
    selectedId.value = id;
    touch();
}

function duplicate(): void {
    if (!sprite.value) return;
    const id = nextId(store.project.sprites);
    store.project.sprites.push({
        ...plainCopy(sprite.value),
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
        sprite.value.frames[frameIndex.value] = pixels;
        touch();
    }
}

/**
 * Replace the images. Animation image numbers are remapped when an image moves, and
 * dropped when it is removed.
 */
function setFrames(frames: Frame[]): void {
    const s = sprite.value;
    if (!s) return;
    const newIndex = (old: number) => frames.indexOf(s.frames[old]);
    for (const a of s.animations) {
        const remapped = a.frames.map(newIndex).filter((i) => i >= 0);
        a.frames = remapped.length > 0 ? remapped : [0];
    }
    s.frames = frames;
    touch();
}

function editPalette(index: number, value: string): void {
    store.project.palette[index] = value;
    touch();
}

// ── Animations ───────────────────────────────────────────────────────────────

function addAnimation(): void {
    const s = sprite.value;
    if (!s) return;
    s.animations.push({
        name: `animation ${s.animations.length + 1}`,
        frames: s.frames.map((_, i) => i),
        frameDuration: 6,
        loop: true,
    });
    touch();
}

function removeAnimation(a: SpriteAnimation): void {
    const s = sprite.value;
    if (s && window.confirm(`Supprimer l'animation « ${a.name} » ?`)) {
        s.animations.splice(s.animations.indexOf(a), 1);
        touch();
    }
}

/** Image numbers as typed by the user (1-based, separated by spaces or commas). */
const framesText = (a: SpriteAnimation) => a.frames.map((i) => i + 1).join(' ');

function setFramesText(a: SpriteAnimation, text: string): void {
    const count = sprite.value?.frames.length ?? 1;
    const frames = text
        .split(/[\s,;]+/)
        .map((t) => parseInt(t, 10) - 1)
        .filter((i) => Number.isInteger(i) && i >= 0 && i < count);
    a.frames = frames.length > 0 ? frames : [0];
    touch();
}

function setDuration(a: SpriteAnimation, value: number): void {
    a.frameDuration = Math.min(60, Math.max(1, Math.round(value) || 1));
    touch();
}

const animFrames = (a: SpriteAnimation) => a.frames.map((i) => sprite.value!.frames[i]);
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
                <label title="Sert aux événements « quand un sprite … touche … »">
                    Tag <input v-model="sprite.tag" placeholder="ex. ennemi" @input="touch" />
                </label>
            </div>
            <FrameStrip
                v-model="frameIndex"
                :frames="sprite.frames"
                :palette="store.project.palette"
                @update:frames="setFrames"
            />
            <div class="drawing">
                <PixelEditor
                    v-model:color="color"
                    :pixels="sprite.frames[frameIndex]"
                    :palette="store.project.palette"
                    @update:pixels="setPixels"
                />
                <PaletteGrid v-model="color" :palette="store.project.palette" @edit="editPalette" />
            </div>
            <p class="hint">
                Dessine le sprite tourné vers la droite : le bloc « tourner vers la gauche » le
                retourne. La couleur « transparent » (damier) laisse voir le décor.
            </p>

            <section class="animations">
                <h3>Animations</h3>
                <p v-if="sprite.animations.length === 0" class="hint">
                    Sans animation, le sprite affiche sa première image. La première animation de la
                    liste démarre quand le sprite est créé.
                </p>
                <div v-for="(a, i) in sprite.animations" :key="i" class="animation">
                    <AnimPreview
                        :frames="animFrames(a)"
                        :palette="store.project.palette"
                        :duration="a.frameDuration"
                        :loop="a.loop"
                        :scale="2"
                    />
                    <div class="fields">
                        <label>Nom <input v-model="a.name" class="name" @change="touch" /></label>
                        <label>
                            Images
                            <input
                                :value="framesText(a)"
                                class="frames"
                                title="Numéros des images dans l'ordre, par exemple : 1 2 3 2"
                                @change="
                                    setFramesText(a, ($event.target as HTMLInputElement).value)
                                "
                            />
                        </label>
                        <label>
                            Une image tous les
                            <input
                                :value="a.frameDuration"
                                type="number"
                                min="1"
                                max="60"
                                class="small"
                                @change="
                                    setDuration(
                                        a,
                                        Number(($event.target as HTMLInputElement).value)
                                    )
                                "
                            />
                            ticks
                        </label>
                        <label
                            ><input v-model="a.loop" type="checkbox" @change="touch" /> en
                            boucle</label
                        >
                        <button @click="removeAnimation(a)">Supprimer</button>
                    </div>
                </div>
                <button @click="addAnimation">Nouvelle animation</button>
            </section>
        </div>
        <p v-else class="empty">Aucun sprite : clique sur « Ajouter » pour en créer un.</p>
    </div>
</template>

<style scoped src="./workbench.css"></style>
<style scoped>
.animations {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

h3 {
    margin: 8px 0 0;
}

.animation {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    padding: 8px;
    border: 1px solid var(--border);
    border-radius: 6px;
}

.fields {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
}

.fields label {
    display: flex;
    align-items: center;
    gap: 4px;
}

.name {
    width: 110px;
}

.frames {
    width: 100px;
}

.small {
    width: 56px;
}

input[type='checkbox'] {
    padding: 0;
}
</style>
