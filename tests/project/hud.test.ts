import { describe, expect, it } from 'vitest';
import { newProject } from '@project/defaults';
import { defaultHudText, displayValue, normalizeHudText } from '@project/hud';
import { loadProject, saveProject } from '@project/serialize';
import { applyHudStyle, compileTemplate, HudLayer, templateError } from '@runtime/HudLayer';
import { starterAsV3 } from '../helpers/oldFiles';

describe('textes d’interface : modèle', () => {
    it('normalise des réglages abîmés', () => {
        const t = normalizeHudText(
            { anchor: 'nulle-part', size: 500, color: 'rouge', outline: '', name: 'vies' },
            3
        );
        expect(t).toMatchObject({
            id: 3,
            name: 'vies',
            anchor: 'top-left',
            size: 96,
            color: '#ffffff',
            outline: '',
        });
    });

    it('affiche les nombres sans décimales inutiles, et les tableaux en liste', () => {
        expect(displayValue(0.1 + 0.2)).toBe(0.3);
        expect(displayValue(7)).toBe(7);
        expect(displayValue([1, 2.5, 3])).toBe('1, 2.5, 3');
        expect(displayValue('abc')).toBe('abc');
    });

    it('enregistre les textes, et migre un ancien fichier sans textes', () => {
        const p = newProject();
        expect(loadProject(saveProject(p)).hud).toEqual(p.hud);
        expect(loadProject(JSON.stringify(starterAsV3())).hud).toEqual([]);
    });
});

describe('textes d’interface : gabarits', () => {
    it('remplace les {{variables}}, y compris accentuées, avec espaces, ou dans un registre', () => {
        const render = compileTemplate('{{pièces}} / {{[mon score]}} / {{sac.or}} / {{absent}}!');
        expect(render({ pièces: 3, 'mon score': 7, sac: { or: 2 } })).toBe('3 / 7 / 2 / !');
    });

    it('n’échappe pas le HTML (le texte est inséré comme texte, jamais comme HTML)', () => {
        expect(compileTemplate('{{x}}')({ x: '<b>&' })).toBe('<b>&');
    });

    it('signale un gabarit invalide et l’affiche tel quel au lieu de planter', () => {
        expect(templateError('Score {{score}}')).toBeNull();
        expect(templateError('{{#if score}} oups')).toMatch(/Gabarit invalide/);
        expect(compileTemplate('{{#if score}} oups')({ score: 1 })).toBe('{{#if score}} oups');
    });
});

describe('calque d’interface (HTML)', () => {
    it('place chaque ancre au bon endroit', () => {
        const el = document.createElement('div');
        applyHudStyle(el, { ...defaultHudText(1), anchor: 'bottom-right', margin: 8 });
        expect(el.style.right).toBe('8px');
        expect(el.style.bottom).toBe('8px');
        expect(el.style.textAlign).toBe('right');
        applyHudStyle(el, { ...defaultHudText(1), anchor: 'center' });
        expect(el.style.right).toBe('');
        expect(el.style.transform).toBe('translate(-50%, -50%)');
    });

    it('crée, met à jour, montre, cache, change et retire les textes', () => {
        const host = document.createElement('div');
        const texts = [
            { ...defaultHudText(1), template: 'Score : {{score}}' },
            { ...defaultHudText(2), template: 'GAME OVER', visible: false },
        ];
        const hud = new HudLayer(host, texts);
        expect(host.children).toHaveLength(2);
        const [score, over] = [...host.children] as HTMLElement[];
        expect(over.hidden).toBe(true);

        hud.update({ score: 4 });
        expect(score.textContent).toBe('Score : 4');
        score.textContent = 'modifié à la main';
        hud.update({ score: 4 }); // unchanged value: the element is not touched
        expect(score.textContent).toBe('modifié à la main');

        hud.setVisible(2, true);
        hud.setTemplate(1, 'Bravo {{score}} !');
        hud.update({ score: 5 });
        expect(over.hidden).toBe(false);
        expect(score.textContent).toBe('Bravo 5 !');

        hud.destroy();
        expect(host.children).toHaveLength(0);
    });
});
