<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { plainCopy, store, touch } from '../store/project';
import { nextId } from '@project/model';
import { defaultHudText, HUD_ANCHORS, HUD_FONTS, type HudAnchor } from '@project/hud';
import { renderSky } from '@project/sky';
import { HudLayer, templateError } from '@runtime/HudLayer';

const ANCHOR_LABELS: Record<HudAnchor, string> = {
    'top-left': 'En haut à gauche',
    top: 'En haut au centre',
    'top-right': 'En haut à droite',
    left: 'Au milieu à gauche',
    center: 'Au centre',
    right: 'Au milieu à droite',
    'bottom-left': 'En bas à gauche',
    bottom: 'En bas au centre',
    'bottom-right': 'En bas à droite',
};
const ARROWS = ['↖', '↑', '↗', '←', '•', '→', '↙', '↓', '↘'];

const selectedId = ref<number | null>(store.project.hud[0]?.id ?? null);
const text = computed(() => store.project.hud.find((t) => t.id === selectedId.value) ?? null);
const error = computed(() => (text.value ? templateError(text.value.template) : null));

watch(
    () => store.generation,
    () => (selectedId.value = store.project.hud[0]?.id ?? null)
);

/** Names usable in templates: the block variables, plus `niveau` and `temps`. */
const variables = computed(() => {
    const code = store.project.code as { variables?: { name: string }[] } | null;
    return [...new Set([...(code?.variables ?? []).map((v) => v.name), 'niveau', 'temps'])];
});

/** `{{name}}`, or `{{[name]}}` when the name contains spaces or symbols. */
const tag = (name: string) => (/^[\p{L}\p{N}_]+$/u.test(name) ? `{{${name}}}` : `{{[${name}]}}`);

const templateInput = ref<HTMLTextAreaElement | null>(null);

function insertVariable(name: string): void {
    const t = text.value;
    const input = templateInput.value;
    if (!t || !input) return;
    const at = input.selectionStart ?? t.template.length;
    t.template = t.template.slice(0, at) + tag(name) + t.template.slice(input.selectionEnd ?? at);
    touch();
}

function add(): void {
    const id = nextId(store.project.hud);
    store.project.hud.push(defaultHudText(id));
    selectedId.value = id;
    touch();
}

function duplicate(): void {
    if (!text.value) return;
    const id = nextId(store.project.hud);
    store.project.hud.push({ ...plainCopy(text.value), id, name: `${text.value.name} (copie)` });
    selectedId.value = id;
    touch();
}

function remove(): void {
    const current = text.value;
    if (!current || !window.confirm(`Supprimer le texte « ${current.name} » ?`)) return;
    const list = store.project.hud;
    const index = list.indexOf(current);
    list.splice(index, 1);
    selectedId.value = list[Math.min(index, list.length - 1)]?.id ?? null;
    touch();
}

// ── Preview: the texts over the first level's sky, with sample values ───────

const previewHost = ref<HTMLDivElement | null>(null);
const previewScale = ref(0.85);
const sky = computed(() => renderSky(store.project.levels[0].sky).toDataURL());
let layer: HudLayer | null = null;
let resizeObserver: ResizeObserver | null = null;

function renderPreview(): void {
    if (!previewHost.value) return;
    layer = new HudLayer(previewHost.value, plainCopy(store.project.hud));
    const sample: Record<string, unknown> = { niveau: store.project.levels[0].name, temps: 0 };
    for (const name of variables.value) {
        if (!(name in sample)) sample[name] = 0;
    }
    layer.update(sample);
    // Show hidden-at-start texts too (dimmed), so they can be placed.
    store.project.hud.forEach((t, i) => {
        const el = previewHost.value!.children[i] as HTMLElement | undefined;
        if (!el) return;
        el.hidden = false;
        el.style.opacity = t.visible ? '1' : '0.4';
        el.style.outline = t.id === selectedId.value ? '1px dashed #ffb347' : '';
    });
}

watch(() => [JSON.stringify(store.project.hud), selectedId.value, variables.value], renderPreview, {
    flush: 'post',
});
onMounted(() => {
    renderPreview();
    const box = previewHost.value!.parentElement!.parentElement!;
    resizeObserver = new ResizeObserver(([entry]) => {
        previewScale.value = Math.min(1, entry.contentRect.width / 640);
    });
    resizeObserver.observe(box);
});
onBeforeUnmount(() => {
    resizeObserver?.disconnect();
    layer?.destroy();
});
</script>

<template>
    <div class="hud-tab">
        <div class="top">
            <div class="list">
                <button
                    v-for="t in store.project.hud"
                    :key="t.id"
                    class="item"
                    :class="{ selected: t.id === selectedId }"
                    @click="selectedId = t.id"
                >
                    {{ t.name }}
                </button>
                <div class="actions">
                    <button @click="add">Ajouter</button>
                    <button :disabled="!text" @click="duplicate">Copier</button>
                    <button :disabled="!text" @click="remove">Supprimer</button>
                </div>
            </div>

            <div v-if="text" class="editor">
                <label class="row">
                    Nom (utilisé dans les blocs)
                    <input v-model="text.name" @input="touch" />
                </label>
                <label class="column">
                    Texte
                    <textarea ref="templateInput" v-model="text.template" rows="2" @input="touch" />
                </label>
                <p v-if="error" class="error">{{ error }}</p>
                <div class="chips">
                    <span class="dim">Insérer une valeur :</span>
                    <button v-for="v in variables" :key="v" class="chip" @click="insertVariable(v)">
                        {{ tag(v) }}
                    </button>
                </div>

                <div class="row wrap">
                    <div class="anchors" role="radiogroup" aria-label="Position">
                        <button
                            v-for="(a, i) in HUD_ANCHORS"
                            :key="a"
                            :class="{ active: text.anchor === a }"
                            :title="ANCHOR_LABELS[a]"
                            @click="((text.anchor = a), touch())"
                        >
                            {{ ARROWS[i] }}
                        </button>
                    </div>
                    <div class="column">
                        <label class="row">
                            Marge
                            <input
                                v-model.number="text.margin"
                                type="number"
                                min="0"
                                max="200"
                                class="small"
                                @input="touch"
                            />
                        </label>
                        <label class="row">
                            Police
                            <select v-model="text.font" @change="touch">
                                <option v-for="f in HUD_FONTS" :key="f.value" :value="f.value">
                                    {{ f.label }}
                                </option>
                            </select>
                        </label>
                        <label class="row">
                            Taille
                            <input
                                v-model.number="text.size"
                                type="number"
                                min="6"
                                max="96"
                                class="small"
                                @input="touch"
                            />
                        </label>
                    </div>
                    <div class="column">
                        <label class="row">
                            Couleur <input v-model="text.color" type="color" @input="touch" />
                        </label>
                        <label class="row">
                            <input
                                type="checkbox"
                                :checked="text.outline !== ''"
                                @change="((text.outline = text.outline ? '' : '#000000'), touch())"
                            />
                            Contour
                            <input
                                v-if="text.outline"
                                v-model="text.outline"
                                type="color"
                                @input="touch"
                            />
                        </label>
                        <label class="row"
                            ><input v-model="text.bold" type="checkbox" @change="touch" />
                            Gras</label
                        >
                        <label class="row">
                            <input v-model="text.visible" type="checkbox" @change="touch" /> Visible
                            au démarrage
                        </label>
                    </div>
                </div>
            </div>
            <p v-else class="dim">Aucun texte : clique sur « Ajouter » pour en créer un.</p>
        </div>

        <div class="preview-box">
            <div
                class="preview"
                :style="{
                    transform: `scale(${previewScale})`,
                    backgroundImage: `url(${sky})`,
                }"
            >
                <div ref="previewHost" class="preview-hud" />
            </div>
        </div>
        <p class="dim small-text">
            Aperçu avec des valeurs d'exemple (0). Les textes cachés au démarrage sont en
            transparence.
        </p>
    </div>
</template>

<style scoped>
.hud-tab {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
}

.top {
    display: flex;
    gap: 16px;
}

.list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    width: 140px;
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
    flex: 1;
}

.row {
    display: flex;
    align-items: center;
    gap: 6px;
}

.wrap {
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 16px;
}

.column {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

textarea {
    font: inherit;
    resize: vertical;
}

input,
select,
textarea {
    color: var(--text);
    background: var(--panel-2);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 4px 6px;
    font: inherit;
}

input[type='checkbox'] {
    padding: 0;
}

input[type='color'] {
    width: 40px;
    height: 26px;
    padding: 0 2px;
}

.small {
    width: 60px;
}

.chips {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
}

.chip {
    padding: 2px 8px;
    font-family: ui-monospace, monospace;
    font-size: 12px;
}

.anchors {
    display: grid;
    grid-template-columns: repeat(3, 32px);
    gap: 2px;
}

.anchors button {
    width: 32px;
    height: 32px;
    padding: 0;
}

.anchors button.active {
    border-color: var(--accent);
    background: var(--border);
}

.preview-box {
    width: 100%;
    max-width: 640px;
    aspect-ratio: 4 / 3;
    overflow: hidden;
}

.preview {
    position: relative;
    width: 640px;
    height: 480px;
    transform-origin: top left;
    background-size: 640px 480px;
    image-rendering: pixelated;
    border: 1px solid var(--border);
}

.preview-hud {
    position: absolute;
    inset: 0;
}

.dim {
    color: var(--text-dim);
}

.small-text {
    margin: 0;
    font-size: 13px;
}

.error {
    margin: 0;
    color: var(--danger);
    font-size: 13px;
}
</style>
