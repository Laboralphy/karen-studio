<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { store, touch } from '../store/project';
import {
    ASSET_SIZE,
    EMPTY_TILE,
    LEVEL_MAX_COLS,
    LEVEL_MAX_ROWS,
    LEVEL_MIN_COLS,
    LEVEL_MIN_ROWS,
    nextId,
} from '@project/model';
import { createLevel, resizeLevel } from '@project/level';
import { assetCanvas } from '@project/render';

const levelId = ref(store.project.levels[0].id);
const level = computed(
    () => store.project.levels.find((l) => l.id === levelId.value) ?? store.project.levels[0]
);
/** BOB painted by the brush; `EMPTY_TILE` = eraser. */
const brush = ref<number>(store.project.bobs[0]?.id ?? EMPTY_TILE);
const zoom = ref(0.5);
const showGrid = ref(true);
const newCols = ref(level.value.cols);
const newRows = ref(level.value.rows);

const canvas = ref<HTMLCanvasElement | null>(null);
const tileSize = computed(() => ASSET_SIZE * zoom.value);

/** Rendered canvas of each BOB, rebuilt when BOB or the palette change. */
const bobImages = computed(
    () =>
        new Map(store.project.bobs.map((b) => [b.id, assetCanvas(b.pixels, store.project.palette)]))
);
/** Thumbnails for the brush palette. */
const bobThumbs = computed(() =>
    store.project.bobs.map((b) => ({
        id: b.id,
        name: b.name,
        url: bobImages.value.get(b.id)!.toDataURL(),
    }))
);

watch(
    () => store.generation,
    () => {
        levelId.value = store.project.levels[0].id;
        brush.value = store.project.bobs[0]?.id ?? EMPTY_TILE;
    }
);
watch(level, (l) => {
    newCols.value = l.cols;
    newRows.value = l.rows;
});

function drawTile(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    const l = level.value;
    const s = tileSize.value;
    ctx.fillStyle = store.project.settings.backgroundColor;
    ctx.fillRect(x * s, y * s, s, s);
    const image = bobImages.value.get(l.tiles[y * l.cols + x]);
    if (image) {
        ctx.drawImage(image, x * s, y * s, s, s);
    }
    if (showGrid.value) {
        ctx.strokeStyle = 'rgba(0,0,0,0.15)';
        ctx.strokeRect(x * s + 0.5, y * s + 0.5, s, s);
    }
}

let pending = false;
/** Redraw the whole level at the next animation frame (coalesces bursts of changes). */
function scheduleRedraw(): void {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
        pending = false;
        const ctx = canvas.value?.getContext('2d');
        if (!ctx) return;
        ctx.imageSmoothingEnabled = false;
        for (let y = 0; y < level.value.rows; y++) {
            for (let x = 0; x < level.value.cols; x++) {
                drawTile(ctx, x, y);
            }
        }
    });
}

watch(
    [level, bobImages, zoom, showGrid, () => store.project.settings.backgroundColor],
    scheduleRedraw,
    {
        flush: 'post',
    }
);
onMounted(scheduleRedraw);

let painting = false;

function paint(e: PointerEvent): void {
    const rect = canvas.value!.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / tileSize.value);
    const y = Math.floor((e.clientY - rect.top) / tileSize.value);
    const l = level.value;
    if (x < 0 || y < 0 || x >= l.cols || y >= l.rows) return;
    const i = y * l.cols + x;
    if (l.tiles[i] === brush.value) return;
    l.tiles[i] = brush.value;
    touch();
    const ctx = canvas.value!.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    drawTile(ctx, x, y);
}

function onDown(e: PointerEvent): void {
    canvas.value!.setPointerCapture(e.pointerId);
    painting = true;
    paint(e);
}

function onMove(e: PointerEvent): void {
    if (painting) paint(e);
}

function onUp(): void {
    painting = false;
}

function applySize(): void {
    const cols = Math.min(LEVEL_MAX_COLS, Math.max(LEVEL_MIN_COLS, Math.round(newCols.value)));
    const rows = Math.min(LEVEL_MAX_ROWS, Math.max(LEVEL_MIN_ROWS, Math.round(newRows.value)));
    const l = level.value;
    if (cols === l.cols && rows === l.rows) return;
    if (
        (cols < l.cols || rows < l.rows) &&
        !window.confirm('Réduire le niveau effacera les cases en dehors. Continuer ?')
    ) {
        return;
    }
    resizeLevel(l, cols, rows);
    newCols.value = cols;
    newRows.value = rows;
    touch();
    scheduleRedraw();
}

function addLevel(): void {
    const id = nextId(store.project.levels);
    store.project.levels.push(createLevel(id, `Niveau ${id}`, 60, 15));
    levelId.value = id;
    touch();
}

function renameLevel(): void {
    const name = window.prompt('Nom du niveau :', level.value.name);
    if (name) {
        level.value.name = name;
        touch();
    }
}

function removeLevel(): void {
    const levels = store.project.levels;
    if (levels.length <= 1) {
        window.alert('Un projet a toujours au moins un niveau.');
        return;
    }
    if (!window.confirm(`Supprimer « ${level.value.name} » ?`)) return;
    levels.splice(levels.indexOf(level.value), 1);
    levelId.value = levels[0].id;
    touch();
}
</script>

<template>
    <div class="level-tab">
        <div class="toolbar">
            <label>
                Niveau
                <select v-model="levelId">
                    <option v-for="(l, i) in store.project.levels" :key="l.id" :value="l.id">
                        {{ l.name }}{{ i === 0 ? ' (départ)' : '' }}
                    </option>
                </select>
            </label>
            <button @click="addLevel">Nouveau</button>
            <button @click="renameLevel">Renommer</button>
            <button @click="removeLevel">Supprimer</button>
            <span class="sep" />
            <label
                >Largeur
                <input
                    v-model.number="newCols"
                    type="number"
                    :min="LEVEL_MIN_COLS"
                    :max="LEVEL_MAX_COLS"
            /></label>
            <label
                >Hauteur
                <input
                    v-model.number="newRows"
                    type="number"
                    :min="LEVEL_MIN_ROWS"
                    :max="LEVEL_MAX_ROWS"
            /></label>
            <button @click="applySize">Appliquer</button>
            <span class="sep" />
            <label>
                Zoom
                <select v-model.number="zoom">
                    <option :value="0.25">25 %</option>
                    <option :value="0.5">50 %</option>
                    <option :value="1">100 %</option>
                </select>
            </label>
            <label><input v-model="showGrid" type="checkbox" /> grille</label>
        </div>
        <div class="brushes">
            <button
                class="brush eraser"
                :class="{ selected: brush === EMPTY_TILE }"
                title="Gomme"
                @click="brush = EMPTY_TILE"
            >
                Gomme
            </button>
            <button
                v-for="b in bobThumbs"
                :key="b.id"
                class="brush"
                :class="{ selected: brush === b.id }"
                :title="b.name"
                @click="brush = b.id"
            >
                <img :src="b.url" :alt="b.name" />
            </button>
        </div>
        <p class="hint">
            {{ level.cols }} × {{ level.rows }} cases ({{ level.cols * ASSET_SIZE }} ×
            {{ level.rows * ASSET_SIZE }} pixels). L'écran du jeu montre 20 × 15 cases. Le jeu
            démarre sur le premier niveau de la liste.
        </p>
        <div class="viewport">
            <canvas
                ref="canvas"
                :width="level.cols * tileSize"
                :height="level.rows * tileSize"
                @pointerdown="onDown"
                @pointermove="onMove"
                @pointerup="onUp"
                @pointercancel="onUp"
            />
        </div>
    </div>
</template>

<style scoped>
.level-tab {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    height: 100%;
}

.toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
}

.toolbar label {
    display: flex;
    align-items: center;
    gap: 4px;
}

.toolbar input[type='number'] {
    width: 64px;
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

.sep {
    width: 12px;
}

.brushes {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
}

.brush.eraser {
    width: auto;
    padding: 2px 10px;
}

.brush {
    width: 40px;
    height: 40px;
    padding: 2px;
}

.brush img {
    width: 32px;
    height: 32px;
    image-rendering: pixelated;
}

.brush.selected {
    border-color: var(--accent);
    background: var(--border);
}

.hint {
    margin: 0;
    color: var(--text-dim);
    font-size: 13px;
}

.viewport {
    flex: 1;
    min-height: 0;
    overflow: auto;
    border: 1px solid var(--border);
}

canvas {
    display: block;
    image-rendering: pixelated;
    cursor: crosshair;
    touch-action: none;
}
</style>
