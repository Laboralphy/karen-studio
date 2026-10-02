<script setup lang="ts">
import { computed, ref } from 'vue';
import { assetCanvas } from '@project/render';
import { generateTexture, MATERIALS, type Material } from '@project/textures';
import type { Frame } from '@project/model';
import AnimPreview from './AnimPreview.vue';

const props = defineProps<{ palette: string[]; canReplace: boolean }>();
const emit = defineEmits<{
    /** Put the texture into the selected BOB. */
    replace: [frames: Frame[], material: Material];
    /** Make a new BOB with the texture. */
    create: [frames: Frame[], material: Material];
}>();

const material = ref<Material>(MATERIALS[0]);
/** First seed of the variant series (series of 8). */
const base = ref(0);
const seed = ref(0);

const url = (frames: Frame[]) => assetCanvas(frames[0], props.palette).toDataURL();

/** One sample per material, for the material buttons. */
const samples = computed(() => MATERIALS.map((m) => url(generateTexture(m, 3, props.palette))));
const variants = computed(() =>
    Array.from({ length: 8 }, (_, i) => {
        const s = base.value + i;
        return { seed: s, url: url(generateTexture(material.value, s, props.palette)) };
    })
);
const frames = computed(() => generateTexture(material.value, seed.value, props.palette));
const current = computed(() => url(frames.value));

function pick(m: Material): void {
    material.value = m;
    seed.value = base.value;
}

function moreVariants(): void {
    base.value = Math.floor(Math.random() * 10_000) * 8;
    seed.value = base.value;
}
</script>

<template>
    <div class="generator">
        <div class="materials">
            <button
                v-for="(m, i) in MATERIALS"
                :key="m.id"
                class="material"
                :class="{ selected: m === material }"
                @click="pick(m)"
            >
                <img :src="samples[i]" alt="" />
                <span>{{ m.name }}</span>
            </button>
        </div>
        <div class="variants">
            <span class="label">Variantes :</span>
            <button
                v-for="v in variants"
                :key="v.seed"
                class="variant"
                :class="{ selected: v.seed === seed }"
                @click="seed = v.seed"
            >
                <img :src="v.url" alt="" />
            </button>
            <button @click="moreVariants">Autres variantes</button>
        </div>
        <div class="result">
            <div
                class="mosaic"
                :style="{ backgroundImage: `url(${current})` }"
                title="Raccord 3 × 3"
            />
            <AnimPreview
                v-if="frames.length > 1"
                :frames="frames"
                :palette="palette"
                :duration="8"
            />
            <div class="apply">
                <p>
                    <strong>{{ material.name }}</strong>
                    <span v-if="frames.length > 1"> — animé ({{ frames.length }} images)</span>
                </p>
                <button class="primary" @click="emit('create', frames, material)">
                    Nouveau BOB
                </button>
                <button :disabled="!canReplace" @click="emit('replace', frames, material)">
                    Remplacer le BOB choisi
                </button>
            </div>
        </div>
    </div>
</template>

<style scoped>
.generator {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.materials {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(76px, 1fr));
    gap: 4px;
}

.material {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 4px 2px;
    font-size: 11px;
    line-height: 1.1;
}

.material img,
.variant img {
    width: 32px;
    height: 32px;
    image-rendering: pixelated;
    background: repeating-conic-gradient(#3a3d52 0 25%, #2e3044 0 50%) 0 0 / 8px 8px;
}

.material.selected,
.variant.selected {
    border-color: var(--accent);
    background: var(--border);
}

.variants {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
}

.variant {
    padding: 2px;
}

.label {
    color: var(--text-dim);
    font-size: 13px;
}

.result {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 12px;
}

.mosaic {
    width: 192px;
    height: 192px;
    background-size: 64px 64px;
    background-repeat: repeat;
    image-rendering: pixelated;
    border: 1px solid var(--border);
}

.apply {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.apply p {
    margin: 0;
}

.primary {
    border-color: var(--accent);
}
</style>
