<script setup lang="ts">
import { onMounted, ref } from 'vue';

const version = ref('…');

onMounted(async () => {
    version.value = await window.karen.getVersion();
});
</script>

<template>
    <div class="about">
        <h2>Karen Studio</h2>
        <p>Atelier de création de jeux vidéo 2D rétro en programmation par blocs.</p>
        <p>
            Version <strong>{{ version }}</strong>
        </p>
        <p class="dim">Moteur de jeu : Fairy Engine.</p>
    </div>
</template>

<style scoped>
.about {
    padding: 24px;
}

.dim {
    color: var(--text-dim);
}
</style>
