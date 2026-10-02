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
import {
    createLevel,
    fillRect,
    floodFillTiles,
    markerAt,
    placeMarker,
    resizeLevel,
} from '@project/level';
import { assetCanvas } from '@project/render';
import { skyBaseColor } from '@project/sky';

type Tool = 'brush' | 'rect' | 'fill' | 'picker' | 'marker';
const TOOLS: { id: Tool; label: string; title: string }[] = [
    { id: 'brush', label: 'Pinceau', title: 'Peindre case par case' },
    { id: 'rect', label: 'Rectangle', title: 'Remplir un rectangle (glisser)' },
    { id: 'fill', label: 'Remplir', title: 'Remplir une zone de cases identiques' },
    { id: 'picker', label: 'Pipette', title: "Prendre le BOB d'une case" },
    { id: 'marker', label: 'Marqueur', title: 'Poser ou retirer un marqueur' },
];

const levelId = ref(store.project.levels[0].id);
const level = computed(
    () => store.project.levels.find((l) => l.id === levelId.value) ?? store.project.levels[0]
);
const tool = ref<Tool>('brush');
/** BOB painted by the tools; `EMPTY_TILE` = eraser. */
const brush = ref<number>(store.project.bobs[0]?.id ?? EMPTY_TILE);
/** Tag given to new markers. */
const markerTag = ref('départ');
const zoom = ref(0.5);
const showGrid = ref(true);
const newCols = ref(level.value.cols);
const newRows = ref(level.value.rows);

const canvas = ref<HTMLCanvasElement | null>(null);
/** Transparent layer above the level: markers and the rectangle preview. */
const overlay = ref<HTMLCanvasElement | null>(null);
const tileSize = computed(() => ASSET_SIZE * zoom.value);

/** Rendered first image of each BOB, rebuilt when BOB or the palette change. */
const bobImages = computed(
    () =>
        new Map(
            store.project.bobs.map((b) => [b.id, assetCanvas(b.frames[0], store.project.palette)])
        )
);
/** Thumbnails for the brush palette. */
const bobThumbs = computed(() =>
    store.project.bobs.map((b) => ({
        id: b.id,
        name: b.name,
        url: bobImages.value.get(b.id)!.toDataURL(),
    }))
);
/** Tags already used by markers, suggested in the tag field. */
const knownTags = computed(() => [
    ...new Set(store.project.levels.flatMap((l) => l.markers.map((m) => m.tag))),
]);

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
    ctx.fillStyle = skyBaseColor(l.sky);
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

/** Rectangle being dragged with the rectangle tool: [col0, row0, col1, row1]. */
let dragRect: [number, number, number, number] | null = null;

/** Draw the markers (flag + tag) and the rectangle preview. */
function drawOverlay(): void {
    const ctx = overlay.value?.getContext('2d');
    if (!ctx) return;
    const s = tileSize.value;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    if (dragRect) {
        const [c0, r0, c1, r1] = dragRect;
        ctx.fillStyle = 'rgba(255, 179, 71, 0.35)';
        ctx.strokeStyle = '#ffb347';
        const x = Math.min(c0, c1) * s;
        const y = Math.min(r0, r1) * s;
        const w = (Math.abs(c1 - c0) + 1) * s;
        const h = (Math.abs(r1 - r0) + 1) * s;
        ctx.fillRect(x, y, w, h);
        ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    }
    ctx.font = 'bold 11px sans-serif';
    for (const m of level.value.markers) {
        const x = m.col * s;
        const y = m.row * s;
        ctx.strokeStyle = '#ff4fa3';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, y + 1, s - 2, s - 2);
        // Flag
        ctx.fillStyle = '#ff4fa3';
        ctx.fillRect(x + 3, y + 3, 2, s - 6);
        ctx.beginPath();
        ctx.moveTo(x + 5, y + 3);
        ctx.lineTo(x + 5 + s * 0.45, y + 3 + s * 0.15);
        ctx.lineTo(x + 5, y + 3 + s * 0.3);
        ctx.fill();
        // Tag, above the cell (below it on the top row, which has nothing above)
        const w = ctx.measureText(m.tag).width + 6;
        const ty = m.row === 0 ? y + s + 1 : y - 15;
        ctx.fillStyle = 'rgba(30, 31, 43, 0.85)';
        ctx.fillRect(x, ty, w, 14);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(m.tag, x + 3, ty + 11);
    }
    ctx.lineWidth = 1;
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
        drawOverlay();
    });
}

watch([level, bobImages, zoom, showGrid, () => skyBaseColor(level.value.sky)], scheduleRedraw, {
    flush: 'post',
});
watch(() => JSON.stringify(level.value.markers), drawOverlay, { flush: 'post' });
onMounted(scheduleRedraw);

/** Cell under the pointer, or null outside the level. */
function cellAt(e: PointerEvent): [number, number] | null {
    const rect = overlay.value!.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / tileSize.value);
    const y = Math.floor((e.clientY - rect.top) / tileSize.value);
    const l = level.value;
    return x >= 0 && y >= 0 && x < l.cols && y < l.rows ? [x, y] : null;
}

function paintCell(x: number, y: number): void {
    const l = level.value;
    const i = y * l.cols + x;
    if (l.tiles[i] === brush.value) return;
    l.tiles[i] = brush.value;
    touch();
    const ctx = canvas.value!.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    drawTile(ctx, x, y);
}

let painting = false;

function onDown(e: PointerEvent): void {
    const cell = cellAt(e);
    if (!cell) return;
    const [x, y] = cell;
    const l = level.value;
    switch (tool.value) {
        case 'brush':
            overlay.value!.setPointerCapture(e.pointerId);
            painting = true;
            paintCell(x, y);
            break;
        case 'rect':
            overlay.value!.setPointerCapture(e.pointerId);
            dragRect = [x, y, x, y];
            drawOverlay();
            break;
        case 'fill':
            floodFillTiles(l, x, y, brush.value);
            touch();
            scheduleRedraw();
            break;
        case 'picker':
            brush.value = l.tiles[y * l.cols + x];
            tool.value = 'brush';
            break;
        case 'marker': {
            const existing = markerAt(l, x, y);
            if (existing && existing.tag === markerTag.value.trim()) {
                l.markers = l.markers.filter((m) => m !== existing);
            } else if (markerTag.value.trim()) {
                placeMarker(l, x, y, markerTag.value.trim());
            }
            touch();
            break;
        }
    }
}

function onMove(e: PointerEvent): void {
    const cell = cellAt(e);
    if (!cell) return;
    if (painting) {
        paintCell(cell[0], cell[1]);
    } else if (dragRect) {
        dragRect[2] = cell[0];
        dragRect[3] = cell[1];
        drawOverlay();
    }
}

function onUp(): void {
    painting = false;
    if (dragRect) {
        const [c0, r0, c1, r1] = dragRect;
        dragRect = null;
        fillRect(level.value, c0, r0, c1, r1, brush.value);
        touch();
        scheduleRedraw();
    }
}

function applySize(): void {
    const cols = Math.min(LEVEL_MAX_COLS, Math.max(LEVEL_MIN_COLS, Math.round(newCols.value)));
    const rows = Math.min(LEVEL_MAX_ROWS, Math.max(LEVEL_MIN_ROWS, Math.round(newRows.value)));
    const l = level.value;
    if (cols === l.cols && rows === l.rows) return;
    if (
        (cols < l.cols || rows < l.rows) &&
        !window.confirm(
            'Réduire le niveau effacera les cases (et marqueurs) en dehors. Continuer ?'
        )
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
        <div class="tools">
            <button
                v-for="t in TOOLS"
                :key="t.id"
                :class="{ active: tool === t.id }"
                :title="t.title"
                @click="tool = t.id"
            >
                {{ t.label }}
            </button>
            <label v-if="tool === 'marker'" class="marker-tag">
                Tag du marqueur
                <input v-model="markerTag" list="marker-tags" placeholder="ex. départ" />
                <datalist id="marker-tags">
                    <option v-for="t in knownTags" :key="t" :value="t" />
                </datalist>
            </label>
        </div>
        <div v-if="tool !== 'marker'" class="brushes">
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
            <template v-if="tool === 'marker'">
                Clique sur une case pour y poser un marqueur ; clique à nouveau pour le retirer. Les
                marqueurs sont invisibles dans le jeu.
            </template>
        </p>
        <div class="viewport">
            <div class="stack">
                <canvas
                    ref="canvas"
                    :width="level.cols * tileSize"
                    :height="level.rows * tileSize"
                />
                <canvas
                    ref="overlay"
                    class="overlay"
                    :width="level.cols * tileSize"
                    :height="level.rows * tileSize"
                    @pointerdown="onDown"
                    @pointermove="onMove"
                    @pointerup="onUp"
                    @pointercancel="onUp"
                />
            </div>
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

.stack {
    position: relative;
    width: max-content;
}

.overlay {
    position: absolute;
    left: 0;
    top: 0;
}

.tools {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
}

.tools button.active {
    border-color: var(--accent);
    background: var(--border);
}

.marker-tag {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-left: 8px;
}
</style>
