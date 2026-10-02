import type { Component } from 'vue';
import TabPlaceholder from './tabs/TabPlaceholder.vue';
import AboutTab from './tabs/AboutTab.vue';
import SystemTab from './tabs/SystemTab.vue';
import CodeTab from './tabs/CodeTab.vue';
import BobTab from './tabs/BobTab.vue';
import SpritesTab from './tabs/SpritesTab.vue';
import LevelTab from './tabs/LevelTab.vue';
import SoundTab from './tabs/SoundTab.vue';

export interface TabDef {
    id: string;
    label: string;
    component: Component;
    /** Texte affiché par l'onglet provisoire en attendant son implémentation. */
    description?: string;
}

/** Onglets de l'éditeur, dans l'ordre d'affichage. */
export const TABS: TabDef[] = [
    { id: 'system', label: 'Système', component: SystemTab },
    { id: 'code', label: 'Code', component: CodeTab },
    { id: 'bob', label: 'BOB', component: BobTab },
    { id: 'sprites', label: 'Sprites', component: SpritesTab },
    { id: 'level', label: 'Niveau', component: LevelTab },
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
    { id: 'sound', label: 'Son', component: SoundTab },
    { id: 'about', label: 'À propos', component: AboutTab },
];
