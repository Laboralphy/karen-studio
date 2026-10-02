<script setup lang="ts">
import { TRANSPARENT } from '@project/model';

defineProps<{ palette: string[] }>();
const emit = defineEmits<{
    /** A palette colour was changed by the user. */
    edit: [index: number, color: string];
}>();
const selected = defineModel<number>({ required: true });

function onEdit(e: Event): void {
    emit('edit', selected.value, (e.target as HTMLInputElement).value);
}
</script>

<template>
    <div class="palette">
        <div class="grid">
            <button
                v-for="(c, i) in palette"
                :key="i"
                class="swatch"
                :class="{ selected: i === selected, transparent: i === TRANSPARENT }"
                :style="i === TRANSPARENT ? undefined : { background: c }"
                :title="i === TRANSPARENT ? 'Transparent' : `${i} : ${c}`"
                @click="selected = i"
            />
        </div>
        <div class="current">
            <span
                class="preview swatch"
                :class="{ transparent: selected === TRANSPARENT }"
                :style="selected === TRANSPARENT ? undefined : { background: palette[selected] }"
            />
            <span v-if="selected === TRANSPARENT">Transparent</span>
            <template v-else>
                <span>Couleur {{ selected }}</span>
                <label class="edit">
                    modifier
                    <input type="color" :value="palette[selected]" @change="onEdit" />
                </label>
            </template>
        </div>
    </div>
</template>

<style scoped>
.palette {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.grid {
    display: grid;
    grid-template-columns: repeat(16, 16px);
    gap: 1px;
}

.swatch {
    width: 16px;
    height: 16px;
    padding: 0;
    border: none;
    border-radius: 0;
}

.swatch.transparent {
    background: repeating-conic-gradient(#3a3d52 0 25%, #2e3044 0 50%) 0 0 / 8px 8px;
}

.swatch.selected {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
    z-index: 1;
}

.current {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
}

.preview {
    width: 28px;
    height: 28px;
    border: 1px solid var(--border);
}

.edit {
    display: flex;
    align-items: center;
    gap: 4px;
    color: var(--text-dim);
}

.edit input {
    width: 32px;
    height: 22px;
    padding: 0;
    border: none;
    background: none;
}
</style>
