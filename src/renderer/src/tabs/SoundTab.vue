<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { sfxr } from 'jsfxr';
import { store, touch } from '../store/project';
import { nextId } from '@project/model';
import {
    defaultSoundParams,
    mutateSoundParams,
    normalizeSoundParams,
    PARAMS,
    PRESETS,
    synthParams,
    WAVES,
    type SoundParams,
} from '@project/sound';

const selectedId = ref<number | null>(store.project.sounds[0]?.id ?? null);
const sound = computed(() => store.project.sounds.find((s) => s.id === selectedId.value) ?? null);
const simpleParams = PARAMS.filter((p) => p.simple);
const advancedParams = PARAMS.filter((p) => !p.simple);
const wave = ref<HTMLCanvasElement | null>(null);

watch(
    () => store.generation,
    () => (selectedId.value = store.project.sounds[0]?.id ?? null)
);

let context: AudioContext | null = null;

/** Render the sound; returns null when WebAudio is unavailable. */
function render(params: SoundParams): AudioBuffer | null {
    if (typeof AudioContext === 'undefined') return null;
    context ??= new AudioContext();
    return sfxr.toWebAudio(synthParams(params), context).buffer;
}

function listen(): void {
    const buffer = sound.value && render(sound.value.params);
    if (!buffer || !context) return;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    void context.resume();
    source.start();
}

/** Draw the waveform of the current sound (min/max per pixel column). */
function drawWave(): void {
    const canvas = wave.value;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !sound.value) return;
    const buffer = render(sound.value.params);
    ctx.fillStyle = '#1e1f2b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!buffer) return;
    const data = buffer.getChannelData(0);
    const mid = canvas.height / 2;
    const step = Math.max(1, Math.floor(data.length / canvas.width));
    ctx.fillStyle = '#c94fd6';
    for (let x = 0; x < canvas.width; x++) {
        let min = 0;
        let max = 0;
        for (let i = x * step; i < Math.min(data.length, (x + 1) * step); i++) {
            min = Math.min(min, data[i]);
            max = Math.max(max, data[i]);
        }
        ctx.fillRect(x, mid - max * mid, 1, Math.max(1, (max - min) * mid));
    }
    ctx.fillStyle = 'rgba(30, 31, 43, 0.85)';
    ctx.fillRect(2, 2, 52, 16);
    ctx.fillStyle = '#e8e8f0';
    ctx.font = '11px monospace';
    ctx.fillText(`${buffer.duration.toFixed(2)} s`, 6, 14);
}

watch(
    () => sound.value && JSON.stringify(sound.value.params),
    () => nextTick(drawWave),
    {
        immediate: true,
    }
);

/** Replace the parameters, then let the user hear the result. */
function setParams(params: SoundParams): void {
    if (!sound.value) return;
    sound.value.params = params;
    touch();
    listen();
}

const applyPreset = (algorithm: string) =>
    setParams(normalizeSoundParams(sfxr.generate(algorithm)));
const randomize = () => setParams(normalizeSoundParams(sfxr.generate('random')));
const mutate = () => sound.value && setParams(mutateSoundParams(sound.value.params));

function add(): void {
    const id = nextId(store.project.sounds);
    store.project.sounds.push({ id, name: `son ${id}`, params: defaultSoundParams() });
    selectedId.value = id;
    touch();
}

function duplicate(): void {
    if (!sound.value) return;
    const id = nextId(store.project.sounds);
    store.project.sounds.push({
        id,
        name: `${sound.value.name} (copie)`,
        params: { ...sound.value.params },
    });
    selectedId.value = id;
    touch();
}

function remove(): void {
    const current = sound.value;
    if (
        !current ||
        !window.confirm(
            `Supprimer « ${current.name} » ? Les blocs qui le jouent ne marcheront plus.`
        )
    ) {
        return;
    }
    const sounds = store.project.sounds;
    const index = sounds.indexOf(current);
    sounds.splice(index, 1);
    selectedId.value = sounds[Math.min(index, sounds.length - 1)]?.id ?? null;
    touch();
}
</script>

<template>
    <div class="sound-tab">
        <div class="list">
            <button
                v-for="s in store.project.sounds"
                :key="s.id"
                class="item"
                :class="{ selected: s.id === selectedId }"
                @click="selectedId = s.id"
            >
                {{ s.name }}
            </button>
            <div class="actions">
                <button @click="add">Ajouter</button>
                <button :disabled="!sound" @click="duplicate">Copier</button>
                <button :disabled="!sound" @click="remove">Supprimer</button>
            </div>
        </div>

        <div v-if="sound" class="editor">
            <label class="name">
                Nom (utilisé dans les blocs)
                <input v-model="sound.name" @input="touch" />
            </label>

            <div class="row">
                <button class="listen" @click="listen">▶ Écouter</button>
                <button @click="randomize">Aléatoire</button>
                <button @click="mutate">Muter</button>
            </div>
            <div class="row presets">
                <span>Modèles :</span>
                <button
                    v-for="[algorithm, label] in PRESETS"
                    :key="algorithm"
                    @click="applyPreset(algorithm)"
                >
                    {{ label }}
                </button>
            </div>

            <canvas ref="wave" width="384" height="72" class="wave" />

            <label class="param">
                <span>Forme d'onde</span>
                <select v-model.number="sound.params.wave_type" @change="(touch(), listen())">
                    <option v-for="w in WAVES" :key="w.value" :value="w.value">
                        {{ w.label }}
                    </option>
                </select>
            </label>
            <label v-for="p in simpleParams" :key="p.key" class="param">
                <span>{{ p.label }}</span>
                <input
                    v-model.number="sound.params[p.key]"
                    type="range"
                    :min="p.signed ? -1 : 0"
                    max="1"
                    step="0.01"
                    @input="touch"
                    @change="listen"
                />
                <output>{{ sound.params[p.key].toFixed(2) }}</output>
            </label>

            <details>
                <summary>Réglages avancés</summary>
                <label v-for="p in advancedParams" :key="p.key" class="param">
                    <span>{{ p.label }}</span>
                    <input
                        v-model.number="sound.params[p.key]"
                        type="range"
                        :min="p.signed ? -1 : 0"
                        max="1"
                        step="0.01"
                        @input="touch"
                        @change="listen"
                    />
                    <output>{{ sound.params[p.key].toFixed(2) }}</output>
                </label>
            </details>
        </div>
        <p v-else class="empty">Aucun son : clique sur « Ajouter » pour en créer un.</p>
    </div>
</template>

<style scoped>
.sound-tab {
    display: flex;
    gap: 16px;
    padding: 16px;
}

.list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    width: 150px;
    flex-shrink: 0;
}

.item {
    text-align: left;
    background: transparent;
    border-color: transparent;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.item.selected {
    background: var(--panel-2);
    border-color: var(--accent);
}

.actions {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 8px;
}

.editor {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
}

.name {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
}

.presets span {
    color: var(--text-dim);
    font-size: 13px;
}

.presets button {
    padding: 4px 10px;
}

.listen {
    border-color: #c94fd6;
}

.wave {
    width: 384px;
    max-width: 100%;
    height: 72px;
    border: 1px solid var(--border);
}

.param {
    display: grid;
    grid-template-columns: 170px 1fr 40px;
    align-items: center;
    gap: 8px;
    max-width: 420px;
    font-size: 14px;
}

.param output {
    color: var(--text-dim);
    font-size: 12px;
    text-align: right;
}

details summary {
    cursor: pointer;
    color: var(--text-dim);
    margin: 4px 0;
}

details .param {
    margin-top: 6px;
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

input[type='range'] {
    padding: 0;
    accent-color: #c94fd6;
}

.empty {
    color: var(--text-dim);
}
</style>
