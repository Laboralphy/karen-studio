<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { store, touch } from '../store/project';
import {
    MOSAIC_PATTERNS,
    renderSky,
    SKY_HEIGHT,
    SKY_TIMES,
    SKY_WIDTH,
    type SkyMode,
} from '@project/sky';

const MODES: { value: SkyMode; label: string }[] = [
    { value: 'landscape', label: 'Paysage' },
    { value: 'mosaic', label: 'Mosaïque' },
    { value: 'color', label: 'Couleur unie' },
];
const ELEMENTS = [
    { key: 'mountains', label: 'Montagnes' },
    { key: 'hills', label: 'Collines' },
    { key: 'clouds', label: 'Nuages' },
    { key: 'sunMoon', label: 'Soleil / lune' },
    { key: 'stars', label: 'Étoiles (soir et nuit)' },
] as const;

const levelId = ref(store.project.levels[0].id);
const level = computed(
    () => store.project.levels.find((l) => l.id === levelId.value) ?? store.project.levels[0]
);
const sky = computed(() => level.value.sky);

const canvas = ref<HTMLCanvasElement | null>(null);
const scrolling = ref(false);
let image: HTMLCanvasElement | null = null;
let offset = 0;
let frame = 0;

watch(
    () => store.generation,
    () => (levelId.value = store.project.levels[0].id)
);

function draw(): void {
    const ctx = canvas.value?.getContext('2d');
    if (!ctx || !image) return;
    // Two copies side by side: shows that the sky repeats without a seam.
    const x = -Math.floor(offset % SKY_WIDTH);
    ctx.drawImage(image, x, 0);
    ctx.drawImage(image, x + SKY_WIDTH, 0);
}

function rebuild(): void {
    image = renderSky(sky.value);
    draw();
}

/** Scroll the preview as if the camera moved right at 4 px per frame. */
function animate(): void {
    offset += 4 * sky.value.parallax;
    draw();
    frame = scrolling.value ? requestAnimationFrame(animate) : 0;
}

watch(() => JSON.stringify(sky.value), rebuild);
watch(scrolling, (on) => {
    if (on && !frame) {
        frame = requestAnimationFrame(animate);
    }
});
onMounted(rebuild);
onBeforeUnmount(() => cancelAnimationFrame(frame));

function reroll(): void {
    sky.value.seed = Math.floor(Math.random() * 1_000_000);
    touch();
}
</script>

<template>
    <div class="sky-tab">
        <div class="controls">
            <label>
                Niveau
                <select v-model="levelId">
                    <option v-for="l in store.project.levels" :key="l.id" :value="l.id">
                        {{ l.name }}
                    </option>
                </select>
            </label>

            <div class="group">
                <button
                    v-for="m in MODES"
                    :key="m.value"
                    :class="{ active: sky.mode === m.value }"
                    @click="((sky.mode = m.value), touch())"
                >
                    {{ m.label }}
                </button>
            </div>

            <div v-if="sky.mode !== 'color'" class="group">
                <span class="label">Moment :</span>
                <button
                    v-for="t in SKY_TIMES"
                    :key="t.value"
                    :class="{ active: sky.time === t.value }"
                    @click="((sky.time = t.value), touch())"
                >
                    {{ t.label }}
                </button>
            </div>

            <div v-if="sky.mode === 'landscape'" class="group">
                <label v-for="e in ELEMENTS" :key="e.key" class="check">
                    <input v-model="sky[e.key]" type="checkbox" @change="touch" />
                    {{ e.label }}
                </label>
                <button @click="reroll">Nouveau tirage</button>
            </div>

            <label v-if="sky.mode === 'mosaic'">
                Motif
                <select v-model="sky.pattern" @change="touch">
                    <option v-for="m in MOSAIC_PATTERNS" :key="m.value" :value="m.value">
                        {{ m.label }}
                    </option>
                </select>
            </label>

            <label v-if="sky.mode === 'color'">
                Couleur
                <input v-model="sky.color" type="color" @input="touch" />
            </label>

            <label v-if="sky.mode !== 'color'" class="parallax">
                Défilement
                <input
                    v-model.number="sky.parallax"
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    @input="touch"
                />
                <output>{{
                    sky.parallax === 0 ? 'fixe' : `${Math.round(sky.parallax * 100)} %`
                }}</output>
                <label class="check"><input v-model="scrolling" type="checkbox" /> aperçu</label>
            </label>
            <p v-if="sky.mode !== 'color'" class="hint">
                Le ciel défile moins vite que le niveau pour donner de la profondeur (0 % =
                immobile, 100 % = aussi vite que le niveau).
            </p>
        </div>
        <canvas ref="canvas" :width="SKY_WIDTH" :height="SKY_HEIGHT" class="preview" />
    </div>
</template>

<style scoped>
.sky-tab {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
}

.controls {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.group {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
}

.group button.active {
    border-color: var(--accent);
    background: var(--border);
}

.label {
    color: var(--text-dim);
    font-size: 13px;
}

label {
    display: flex;
    align-items: center;
    gap: 8px;
}

.check {
    gap: 4px;
    margin-right: 6px;
}

.parallax input[type='range'] {
    width: 200px;
}

.parallax output {
    width: 40px;
    color: var(--text-dim);
    font-size: 13px;
}

.hint {
    margin: 0;
    color: var(--text-dim);
    font-size: 13px;
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

input[type='range'],
input[type='checkbox'] {
    padding: 0;
}

input[type='color'] {
    width: 48px;
    height: 28px;
    padding: 0 2px;
}

.preview {
    width: 100%;
    max-width: 640px;
    image-rendering: pixelated;
    border: 1px solid var(--border);
}
</style>
