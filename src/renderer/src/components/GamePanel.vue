<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { GameRuntime } from '@runtime/GameRuntime';
import { projectSnapshot } from '../store/project';

const SCREEN_W = 640;
const SCREEN_H = 480;

const canvas = ref<HTMLCanvasElement | null>(null);
const running = ref(false);
const zoomed = ref(false);
const error = ref<string | null>(null);
/** Latest script error; the game keeps running. */
const scriptError = ref<string | null>(null);

const runtime = new GameRuntime();
runtime.onError = (message) => {
    running.value = false;
    error.value = message;
};
runtime.onScriptError = (message) => {
    scriptError.value = message;
};

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
    const el = canvas.value;
    if (!el) {
        return;
    }
    error.value = null;
    scriptError.value = null;
    if (runtime.start(el, el, projectSnapshot())) {
        running.value = true;
        el.focus();
    }
}

function stop(): void {
    runtime.stop();
    running.value = false;
    drawIdleScreen();
}

onMounted(drawIdleScreen);
onBeforeUnmount(() => runtime.stop());
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
        <p v-if="error" class="error">Le jeu s'est arrêté : {{ error }}</p>
        <p v-if="scriptError" class="error">{{ scriptError }}</p>
        <p v-if="running && !error" class="hint">
            Clique sur l'écran de jeu pour lui donner le clavier.
        </p>
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

.hint,
.error {
    margin: 0;
    font-size: 13px;
    color: var(--text-dim);
}

.error {
    color: var(--danger);
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
