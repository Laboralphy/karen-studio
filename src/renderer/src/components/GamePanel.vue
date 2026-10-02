<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { GameRuntime } from '@runtime/GameRuntime';
import { projectSnapshot } from '../store/project';

const SCREEN_W = 640;
const SCREEN_H = 480;

const canvas = ref<HTMLCanvasElement | null>(null);
/** HTML layer above the canvas for the interface texts. */
const hud = ref<HTMLDivElement | null>(null);
const screen = ref<HTMLDivElement | null>(null);
const running = ref(false);
const zoomed = ref(false);

/** Folded panel: more room for the editors. Remembered between sessions. */
const COLLAPSED_KEY = 'karen.gamePanel.collapsed';
function readCollapsed(): boolean {
    try {
        return localStorage.getItem(COLLAPSED_KEY) === '1';
    } catch {
        return false;
    }
}
const collapsed = ref(readCollapsed());
watch(collapsed, (value) => {
    try {
        localStorage.setItem(COLLAPSED_KEY, value ? '1' : '0');
    } catch {
        // Storage unavailable: the choice is just not remembered.
    }
});
/** Size of the area available for the game screen. */
const available = ref({ width: SCREEN_W, height: SCREEN_H });
/**
 * Scale of the screen (canvas and interface together): 1 normally, as large as fits when
 * enlarged (2 px kept for the border).
 */
const scale = computed(() =>
    zoomed.value
        ? Math.min(available.value.width / (SCREEN_W + 4), available.value.height / (SCREEN_H + 4))
        : 1
);
let resizeObserver: ResizeObserver | null = null;
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
    if (runtime.start(el, el, projectSnapshot(), hud.value ?? undefined)) {
        running.value = true;
        el.focus();
    }
}

function stop(): void {
    runtime.stop();
    running.value = false;
    drawIdleScreen();
}

onMounted(() => {
    drawIdleScreen();
    resizeObserver = new ResizeObserver(([entry]) => {
        available.value = { width: entry.contentRect.width, height: entry.contentRect.height };
    });
    resizeObserver.observe(screen.value!);
});
onBeforeUnmount(() => {
    resizeObserver?.disconnect();
    runtime.stop();
});
</script>

<template>
    <aside v-if="collapsed" class="game-panel-folded">
        <button title="Afficher l'écran de jeu" @click="collapsed = false">◀</button>
        <span class="folded-label">Jeu</span>
        <span v-if="running" class="running-dot" title="Le jeu tourne" />
    </aside>
    <section v-show="!collapsed" class="game-panel" :class="{ zoomed }">
        <div class="toolbar">
            <button :disabled="running" @click="start">▶ Démarrer</button>
            <button :disabled="!running" @click="stop">■ Stop</button>
            <button @click="zoomed = !zoomed">{{ zoomed ? '⤡ Réduire' : '⤢ Agrandir' }}</button>
            <button
                v-if="!zoomed"
                class="fold"
                title="Replier l'écran de jeu pour avoir plus de place"
                @click="collapsed = true"
            >
                ▶
            </button>
        </div>
        <div ref="screen" class="screen">
            <div class="screen-box" :style="{ transform: `scale(${scale})` }">
                <canvas ref="canvas" :width="SCREEN_W" :height="SCREEN_H" tabindex="0" />
                <div ref="hud" class="hud" />
            </div>
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

.fold {
    margin-left: auto;
}

.game-panel-folded {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    width: 40px;
    padding: 12px 4px;
    background: var(--panel);
    border-left: 1px solid var(--border);
}

.game-panel-folded button {
    padding: 4px 8px;
}

.folded-label {
    writing-mode: vertical-rl;
    color: var(--text-dim);
}

.running-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #7bd88f;
}

.screen {
    display: flex;
    align-items: center;
    justify-content: center;
}

.screen-box {
    position: relative;
    flex-shrink: 0;
}

.hud {
    position: absolute;
    /* Inside the 2 px canvas border, so positions match the 640×480 game screen. */
    inset: 2px;
    overflow: hidden;
    pointer-events: none;
}

canvas {
    display: block;
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
    overflow: hidden;
}
</style>
