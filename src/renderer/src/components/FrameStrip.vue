<script setup lang="ts">
import { computed } from 'vue';
import { assetCanvas } from '@project/render';
import type { Frame } from '@project/model';

const props = defineProps<{ frames: Frame[]; palette: string[] }>();
const emit = defineEmits<{ 'update:frames': [frames: Frame[]] }>();
/** Index of the image being edited. */
const selected = defineModel<number>({ required: true });

const thumbs = computed(() => props.frames.map((f) => assetCanvas(f, props.palette).toDataURL()));

function update(frames: Frame[], index: number): void {
    emit('update:frames', frames);
    selected.value = index;
}

/** Add a copy of the current image right after it. */
function duplicate(): void {
    const frames = [...props.frames];
    frames.splice(selected.value + 1, 0, [...props.frames[selected.value]]);
    update(frames, selected.value + 1);
}

function remove(): void {
    if (props.frames.length <= 1) return;
    const frames = props.frames.filter((_, i) => i !== selected.value);
    update(frames, Math.min(selected.value, frames.length - 1));
}

function move(delta: number): void {
    const to = selected.value + delta;
    if (to < 0 || to >= props.frames.length) return;
    const frames = [...props.frames];
    [frames[selected.value], frames[to]] = [frames[to], frames[selected.value]];
    update(frames, to);
}
</script>

<template>
    <div class="strip">
        <span class="label">Images :</span>
        <button
            v-for="(url, i) in thumbs"
            :key="i"
            class="frame"
            :class="{ selected: i === selected }"
            :title="`Image ${i + 1}`"
            @click="selected = i"
        >
            <img :src="url" alt="" />
            <span>{{ i + 1 }}</span>
        </button>
        <button title="Ajouter une copie de l'image" @click="duplicate">＋ image</button>
        <button :disabled="selected === 0" title="Déplacer vers la gauche" @click="move(-1)">
            ◀
        </button>
        <button
            :disabled="selected === frames.length - 1"
            title="Déplacer vers la droite"
            @click="move(1)"
        >
            ▶
        </button>
        <button :disabled="frames.length <= 1" @click="remove">Retirer</button>
    </div>
</template>

<style scoped>
.strip {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
}

.label {
    color: var(--text-dim);
    font-size: 13px;
}

.frame {
    position: relative;
    padding: 2px;
    width: 40px;
    height: 40px;
}

.frame img {
    width: 32px;
    height: 32px;
    image-rendering: pixelated;
    background: repeating-conic-gradient(#3a3d52 0 25%, #2e3044 0 50%) 0 0 / 8px 8px;
}

.frame span {
    position: absolute;
    right: 2px;
    bottom: 0;
    font-size: 10px;
    color: var(--text-dim);
}

.frame.selected {
    border-color: var(--accent);
}
</style>
