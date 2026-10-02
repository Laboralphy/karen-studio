import type { Component } from 'vue';
import TabPlaceholder from './tabs/TabPlaceholder.vue';
import AboutTab from './tabs/AboutTab.vue';

export interface TabDef {
    id: string;
    label: string;
    component: Component;
    /** Texte affiché par l'onglet provisoire en attendant son implémentation. */
    description?: string;
}

/** Onglets de l'éditeur, dans l'ordre d'affichage. */
export const TABS: TabDef[] = [
    {
        id: 'system',
        label: 'Système',
        component: TabPlaceholder,
        description: 'Enregistrer et charger un projet.',
    },
    {
        id: 'code',
        label: 'Code',
        component: TabPlaceholder,
        description: 'Programmer le jeu avec des blocs.',
    },
    {
        id: 'bob',
        label: 'BOB',
        component: TabPlaceholder,
        description: 'Dessiner les éléments de décor (32×32).',
    },
    {
        id: 'sprites',
        label: 'Sprites',
        component: TabPlaceholder,
        description: 'Dessiner et animer les sprites (32×32).',
    },
    {
        id: 'level',
        label: 'Niveau',
        component: TabPlaceholder,
        description: 'Placer les BOB et les marqueurs dans les niveaux.',
    },
    {
        id: 'sky',
        label: 'Ciel',
        component: TabPlaceholder,
        description: 'Générer le ciel qui défile en parallaxe.',
    },
    {
        id: 'hud',
        label: 'Interface',
        component: TabPlaceholder,
        description: 'Placer les textes affichés par-dessus le jeu.',
    },
    {
        id: 'sound',
        label: 'Son',
        component: TabPlaceholder,
        description: 'Créer des effets sonores rétro.',
    },
    { id: 'about', label: 'À propos', component: AboutTab },
];
