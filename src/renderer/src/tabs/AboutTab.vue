<script setup lang="ts">
import { onMounted, ref } from 'vue';
import '@fontsource/fredoka/600.css';
import '@fontsource/fredoka/700.css';
import splash from '../../../../resources/karen-splash-image.png';

const version = ref('…');

/** Third-party components shipped with the application, and their licences. */
const CREDITS: { name: string; role: string; license: string }[] = [
    { name: 'Fairy Engine', role: 'moteur de jeu (maison)', license: '—' },
    { name: 'Electron', role: 'application de bureau', license: 'MIT' },
    { name: 'Vue', role: 'interface', license: 'MIT' },
    { name: 'Blockly', role: 'programmation par blocs', license: 'Apache 2.0' },
    { name: 'jsfxr', role: 'effets sonores', license: 'Unlicense (domaine public)' },
    { name: 'Handlebars', role: 'textes à {{variables}}', license: 'MIT' },
    { name: 'Press Start 2P', role: 'police (CodeMan38)', license: 'SIL Open Font License 1.1' },
    { name: 'VT323', role: 'police (Peter Hull)', license: 'SIL Open Font License 1.1' },
    { name: 'Silkscreen', role: 'police (Jason Kottke)', license: 'SIL Open Font License 1.1' },
    {
        name: 'Fredoka',
        role: 'police du titre (Milena Brandão)',
        license: 'SIL Open Font License 1.1',
    },
    { name: 'DB32', role: 'palette de couleurs (DawnBringer)', license: 'libre' },
];

onMounted(async () => {
    version.value = await window.karen.getVersion();
});
</script>

<template>
    <div class="about">
        <h2 class="title">
            <span class="karen">Karen's</span>
            <span class="studio">
                <span class="star">★</span> Game Studio <span class="star">★</span>
            </span>
        </h2>
        <img :src="splash" class="splash" alt="Karen et son chat devant l'écran" />
        <p class="tagline">
            Atelier de création de jeux vidéo 2D rétro en programmation par blocs.
        </p>
        <p class="tagline">
            Version <strong>{{ version }}</strong>
        </p>

        <h3>Raccourcis</h3>
        <ul>
            <li>
                <kbd>Ctrl</kbd> + <kbd>Z</kbd> : annuler · <kbd>Ctrl</kbd> + <kbd>Y</kbd> : rétablir
            </li>
            <li>Dans l'onglet Code, ces raccourcis annulent les modifications des blocs.</li>
            <li>Clique sur l'écran de jeu pour lui donner le clavier.</li>
        </ul>

        <h3>Crédits et licences</h3>
        <table>
            <tbody>
                <tr v-for="c in CREDITS" :key="c.name">
                    <th>{{ c.name }}</th>
                    <td>{{ c.role }}</td>
                    <td class="dim">{{ c.license }}</td>
                </tr>
            </tbody>
        </table>
        <p class="dim small">
            Les générateurs de textures s'inspirent de l'« Atelier de tuiles NES » et de la palette
            de la console NES.
        </p>
    </div>
</template>

<style scoped>
.about {
    padding: 24px;
    max-width: 640px;
    margin: 0 auto;
}

/* ── Kawaii title ──────────────────────────────────────────────────────────── */
.title {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin: 4px 0 18px;
    font-family: 'Fredoka', system-ui, sans-serif;
    line-height: 1;
    text-align: center;
}

.karen {
    display: inline-block;
    font-size: 64px;
    font-weight: 700;
    color: #ff6fae;
    letter-spacing: 1px;
    transform: rotate(-3deg);
    /* White outline, then a darker pink « 3D » edge and a soft pink glow. */
    text-shadow:
        -3px -3px 0 #fff,
        3px -3px 0 #fff,
        -3px 3px 0 #fff,
        3px 3px 0 #fff,
        0 -3px 0 #fff,
        0 3px 0 #fff,
        -3px 0 0 #fff,
        3px 0 0 #fff,
        5px 7px 0 #c2407e,
        0 0 24px rgba(255, 111, 174, 0.6);
}

.studio {
    margin-top: 10px;
    font-size: 26px;
    font-weight: 600;
    color: #9d8cff;
    letter-spacing: 3px;
    text-shadow:
        -2px -2px 0 #fff,
        2px -2px 0 #fff,
        -2px 2px 0 #fff,
        2px 2px 0 #fff,
        3px 4px 0 #6c5ad6;
}

.star {
    color: #ffd84d;
    font-size: 20px;
    text-shadow: 0 0 8px rgba(255, 216, 77, 0.8);
}

.splash {
    display: block;
    width: 100%;
    max-width: 420px;
    margin: 0 auto 16px;
    aspect-ratio: 1;
    object-fit: cover;
    border-radius: 28px;
    border: 4px solid #fff;
    box-shadow:
        0 0 0 4px #ff6fae,
        0 12px 32px rgba(255, 111, 174, 0.35);
}

.tagline {
    text-align: center;
    margin: 4px 0;
}

h3 {
    margin: 20px 0 8px;
}

ul {
    margin: 0;
    padding-left: 20px;
}

kbd {
    padding: 0 4px;
    border: 1px solid var(--border);
    border-radius: 3px;
    font-size: 12px;
}

table {
    border-collapse: collapse;
}

th,
td {
    padding: 3px 12px 3px 0;
    text-align: left;
    vertical-align: top;
}

th {
    font-weight: 600;
}

.dim {
    color: var(--text-dim);
}

.small {
    font-size: 13px;
}
</style>
