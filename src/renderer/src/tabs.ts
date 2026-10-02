import type { Component } from 'vue';
import AboutTab from './tabs/AboutTab.vue';
import SystemTab from './tabs/SystemTab.vue';
import CodeTab from './tabs/CodeTab.vue';
import BobTab from './tabs/BobTab.vue';
import SpritesTab from './tabs/SpritesTab.vue';
import LevelTab from './tabs/LevelTab.vue';
import SoundTab from './tabs/SoundTab.vue';
import SkyTab from './tabs/SkyTab.vue';
import HudTab from './tabs/HudTab.vue';

export interface TabDef {
    id: string;
    label: string;
    component: Component;
}

/** Onglets de l'éditeur, dans l'ordre d'affichage ; le premier est affiché au démarrage. */
export const TABS: TabDef[] = [
    // First, and shown at start-up: it explains what the program is for.
    { id: 'about', label: 'À propos', component: AboutTab },
    { id: 'system', label: 'Système', component: SystemTab },
    { id: 'code', label: 'Code', component: CodeTab },
    { id: 'bob', label: 'BOB', component: BobTab },
    { id: 'sprites', label: 'Sprites', component: SpritesTab },
    { id: 'level', label: 'Niveau', component: LevelTab },
    { id: 'sky', label: 'Ciel', component: SkyTab },
    { id: 'hud', label: 'Interface', component: HudTab },
    { id: 'sound', label: 'Son', component: SoundTab },
];
