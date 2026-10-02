<script setup lang="ts">
import { onMounted, ref } from 'vue';

const SCREEN_W = 640;
const SCREEN_H = 480;

const canvas = ref<HTMLCanvasElement | null>(null);
const running = ref(false);
const zoomed = ref(false);

/** Écran affiché quand aucun jeu ne tourne. */
function drawIdleScreen(): void {
    const ctx = canvas.value?.getContext('2d');
    if (!ctx) {
        return;
    }
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    ctx.fillStyle = '#ffb347';
    ctx.font = '24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('KAREN STUDIO', SCREEN_W / 2, SCREEN_H / 2 - 10);
    ctx.fillStyle = '#9a9cb5';
    ctx.font = '14px monospace';
    ctx.fillText('Appuie sur Démarrer', SCREEN_W / 2, SCREEN_H / 2 + 20);
}

function start(): void {
    running.value = true;
    canvas.value?.focus();
}

function stop(): void {
    running.value = false;
    drawIdleScreen();
}

onMounted(drawIdleScreen);
</script>

<template>
    <section class="game-panel" :class="{ zoomed }">
        <div class="toolbar">
            <button :disabled="running" @click="start">▶ Démarrer</button>
            <button :disabled="!running" @click="stop">■ Stop</button>
            <button @click="zoomed = !zoomed">{{ zoomed ? '⤡ Réduire' : '⤢ Agrandir' }}</button>
        </div>
        <div class="screen">
            <canvas ref="canvas" :width="SCREEN_W" :height="SCREEN_H" tabindex="0" />
        </div>
    </section>
</template>

<style scoped>
.game-panel {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    background: var(--panel);
    border-left: 1px solid var(--border);
}

.toolbar {
    display: flex;
    gap: 8px;
}

.screen {
    display: flex;
    align-items: center;
    justify-content: center;
}

canvas {
    width: 640px;
    height: 480px;
    image-rendering: pixelated;
    background: #000;
    outline: none;
    border: 2px solid var(--border);
}

canvas:focus {
    border-color: var(--accent-2);
}

/* Mode agrandi : le panneau couvre toute la fenêtre, l'écran garde son ratio 4:3. */
.game-panel.zoomed {
    position: fixed;
    inset: 0;
    z-index: 10;
    border: none;
}

.game-panel.zoomed .screen {
    flex: 1;
    min-height: 0;
}

.game-panel.zoomed canvas {
    width: auto;
    height: auto;
    max-width: 100%;
    max-height: 100%;
    aspect-ratio: 4 / 3;
    height: 100%;
}
</style>
