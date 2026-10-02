<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { drawAsset } from '@project/render';
import { ASSET_SIZE, type Frame } from '@project/model';

/** Plays a sequence of images at the game speed (`tickRate` ticks per second). */
const props = withDefaults(
    defineProps<{
        frames: Frame[];
        palette: string[];
        /** Ticks each image is shown. */
        duration: number;
        loop?: boolean;
        tickRate?: number;
        scale?: number;
    }>(),
    { loop: true, tickRate: 30, scale: 3 }
);

const canvas = ref<HTMLCanvasElement | null>(null);
let raf = 0;
let start = performance.now();

function draw(now: number): void {
    const ctx = canvas.value?.getContext('2d');
    if (ctx && props.frames.length > 0) {
        // `now` is the frame start time: it may be slightly before a restart.
        const tick = Math.max(0, Math.floor(((now - start) / 1000) * props.tickRate));
        let index = Math.floor(tick / Math.max(1, props.duration));
        index = props.loop ? index % props.frames.length : Math.min(index, props.frames.length - 1);
        ctx.clearRect(0, 0, ASSET_SIZE, ASSET_SIZE);
        drawAsset(ctx, props.frames[index], props.palette);
    }
    raf = requestAnimationFrame(draw);
}

function restart(): void {
    start = performance.now();
}

// Restart from the first image when the sequence changes (useful for non-looping ones).
watch(() => [props.frames, props.duration, props.loop], restart, { deep: true });
onMounted(() => (raf = requestAnimationFrame(draw)));
onBeforeUnmount(() => cancelAnimationFrame(raf));
</script>

<template>
    <canvas
        ref="canvas"
        :width="ASSET_SIZE"
        :height="ASSET_SIZE"
        class="preview"
        :style="{ width: `${ASSET_SIZE * scale}px`, height: `${ASSET_SIZE * scale}px` }"
        title="Aperçu (cliquer pour rejouer)"
        @click="restart"
    />
</template>

<style scoped>
.preview {
    image-rendering: pixelated;
    background: repeating-conic-gradient(#3a3d52 0 25%, #2e3044 0 50%) 0 0 / 12px 12px;
    border: 1px solid var(--border);
    cursor: pointer;
}
</style>
