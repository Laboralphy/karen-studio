<script setup lang="ts">
defineProps<{ title: string; description?: string }>();
</script>

<template>
    <div class="placeholder">
        <h2>{{ title }}</h2>
        <p>{{ description }}</p>
        <p class="soon">Bientôt disponible.</p>
    </div>
</template>

<style scoped>
.placeholder {
    padding: 24px;
}

.soon {
    color: var(--text-dim);
    font-style: italic;
}
</style>
