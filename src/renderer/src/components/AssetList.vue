<script setup lang="ts">
import { computed } from 'vue';
import { assetCanvas } from '@project/render';

const props = defineProps<{
    items: { id: number; name: string; frames: number[][] }[];
    palette: string[];
}>();
const emit = defineEmits<{ add: []; duplicate: []; remove: [] }>();
const selected = defineModel<number | null>({ required: true });

/** Thumbnail (first image) of each item, recomputed when it or the palette changes. */
const thumbnails = computed(() =>
    props.items.map((item) => assetCanvas(item.frames[0], props.palette).toDataURL())
);
</script>

<template>
    <div class="asset-list">
        <div class="items">
            <button
                v-for="(item, i) in items"
                :key="item.id"
                class="item"
                :class="{ selected: item.id === selected }"
                @click="selected = item.id"
            >
                <img :src="thumbnails[i]" alt="" />
                <span>{{ item.name }}</span>
            </button>
        </div>
        <div class="actions">
            <button @click="emit('add')">Ajouter</button>
            <button :disabled="selected === null" @click="emit('duplicate')">Copier</button>
            <button :disabled="selected === null" @click="emit('remove')">Supprimer</button>
        </div>
    </div>
</template>

<style scoped>
.asset-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 170px;
    flex-shrink: 0;
}

.items {
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-height: 460px;
    overflow-y: auto;
}

.item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px;
    text-align: left;
    background: transparent;
    border-color: transparent;
}

.item.selected {
    background: var(--panel-2);
    border-color: var(--accent);
}

.item img {
    width: 32px;
    height: 32px;
    image-rendering: pixelated;
    background: repeating-conic-gradient(#3a3d52 0 25%, #2e3044 0 50%) 0 0 / 8px 8px;
}

.item span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.actions {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
}
</style>
