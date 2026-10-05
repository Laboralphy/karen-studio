<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { ASSET_SIZE, TRANSPARENT } from '@project/model';
import { flipFrame, floodFill, type PixelEdit } from '@project/pixels';

type Tool = 'pencil' | 'eraser' | 'fill' | 'picker';

const props = defineProps<{
    pixels: number[];
    palette: string[];
    /** « Dessiner sur toutes les images » is on: highlight the drawing area. */
    allFrames?: boolean;
}>();
const emit = defineEmits<{
    /** The new image, and what was done (so that the edit can be applied to other images). */
    'update:pixels': [pixels: number[], edit: PixelEdit];
}>();
/** Selected palette index (shared with the palette grid). */
const color = defineModel<number>('color', { required: true });

const ZOOM = 12;
const SIZE = ASSET_SIZE * ZOOM;

const canvas = ref<HTMLCanvasElement | null>(null);
const tool = ref<Tool>('pencil');
const showGrid = ref(true);
const TOOLS: { id: Tool; label: string; title: string }[] = [
    { id: 'pencil', label: 'Crayon', title: 'Dessiner avec la couleur choisie' },
    { id: 'eraser', label: 'Gomme', title: 'Effacer (rendre transparent)' },
    { id: 'fill', label: 'Remplir', title: 'Remplir une zone de la même couleur' },
    { id: 'picker', label: 'Pipette', title: 'Prendre la couleur d’un pixel' },
];

function draw(): void {
    const ctx = canvas.value?.getContext('2d');
    if (!ctx) {
        return;
    }
    for (let y = 0; y < ASSET_SIZE; y++) {
        for (let x = 0; x < ASSET_SIZE; x++) {
            const index = props.pixels[y * ASSET_SIZE + x];
            if (index === TRANSPARENT) {
                // Checkerboard for transparent pixels.
                ctx.fillStyle = (x + y) % 2 === 0 ? '#3a3d52' : '#2e3044';
            } else {
                ctx.fillStyle = props.palette[index];
            }
            ctx.fillRect(x * ZOOM, y * ZOOM, ZOOM, ZOOM);
        }
    }
    if (showGrid.value) {
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 1; i < ASSET_SIZE; i++) {
            ctx.moveTo(i * ZOOM + 0.5, 0);
            ctx.lineTo(i * ZOOM + 0.5, SIZE);
            ctx.moveTo(0, i * ZOOM + 0.5);
            ctx.lineTo(SIZE, i * ZOOM + 0.5);
        }
        ctx.stroke();
    }
}

/** Pixel coordinates under the pointer, or null outside the image. */
function pixelAt(e: PointerEvent): [number, number] | null {
    const rect = canvas.value!.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * ASSET_SIZE);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * ASSET_SIZE);
    return x >= 0 && y >= 0 && x < ASSET_SIZE && y < ASSET_SIZE ? [x, y] : null;
}

let painting = false;

function apply(e: PointerEvent): void {
    const at = pixelAt(e);
    if (!at) {
        return;
    }
    const [x, y] = at;
    const i = y * ASSET_SIZE + x;
    if (tool.value === 'picker') {
        color.value = props.pixels[i];
        tool.value = 'pencil';
        return;
    }
    const pixels = [...props.pixels];
    if (tool.value === 'fill') {
        floodFill(pixels, ASSET_SIZE, x, y, color.value);
        emit('update:pixels', pixels, { kind: 'fill', x, y, color: color.value });
        return;
    } else {
        const value = tool.value === 'eraser' ? TRANSPARENT : color.value;
        if (pixels[i] === value) {
            return;
        }
        pixels[i] = value;
    }
    emit('update:pixels', pixels, { kind: 'paint' });
}

function onDown(e: PointerEvent): void {
    canvas.value!.setPointerCapture(e.pointerId);
    painting = tool.value === 'pencil' || tool.value === 'eraser';
    apply(e);
}

function onMove(e: PointerEvent): void {
    if (painting) {
        apply(e);
    }
}

function onUp(): void {
    painting = false;
}

/** Horizontal or vertical mirror of the whole image. */
function flip(horizontal: boolean): void {
    emit('update:pixels', flipFrame(props.pixels, horizontal), { kind: 'flip', horizontal });
}

function clear(): void {
    const question = props.allFrames
        ? 'Effacer le dessin de TOUTES les images ?'
        : 'Effacer tout le dessin ?';
    if (window.confirm(question)) {
        emit('update:pixels', new Array<number>(ASSET_SIZE * ASSET_SIZE).fill(TRANSPARENT), {
            kind: 'clear',
        });
    }
}

watch(() => [props.pixels, props.palette, showGrid.value], draw, { deep: true });
onMounted(draw);
</script>

<template>
    <div class="pixel-editor">
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
            <span class="sep" />
            <button title="Miroir horizontal" @click="flip(true)">⇆</button>
            <button title="Miroir vertical" @click="flip(false)">⇅</button>
            <button title="Tout effacer" @click="clear">Effacer</button>
            <label class="grid-toggle"><input v-model="showGrid" type="checkbox" /> grille</label>
        </div>
        <canvas
            ref="canvas"
            :class="{ 'all-frames': allFrames }"
            :width="SIZE"
            :height="SIZE"
            @pointerdown="onDown"
            @pointermove="onMove"
            @pointerup="onUp"
            @pointercancel="onUp"
        />
    </div>
</template>

<style scoped>
.pixel-editor {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.tools {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
    max-width: 384px;
}

.tools button {
    padding: 4px 8px;
}

.tools button.active {
    border-color: var(--accent);
    background: var(--border);
}

.sep {
    width: 8px;
}

.grid-toggle {
    margin-left: 8px;
    color: var(--text-dim);
    font-size: 13px;
}

canvas {
    width: 384px;
    height: 384px;
    image-rendering: pixelated;
    cursor: crosshair;
    border: 1px solid var(--border);
    touch-action: none;
}

canvas.all-frames {
    border: 2px solid #ff6fae;
    box-shadow: 0 0 10px rgba(255, 111, 174, 0.5);
}
</style>
