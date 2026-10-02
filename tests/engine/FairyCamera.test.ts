import { describe, expect, it } from 'vitest';
import { FairyCamera } from '@fairy/FairyCamera';

describe('FairyCamera', () => {
    it('reste dans les limites du monde', () => {
        const cam = new FairyCamera(640, 480);
        cam.setWorldSize(1920, 640);
        cam.moveTo(-50, -50);
        expect([cam.x, cam.y]).toEqual([0, 0]);
        cam.moveTo(5000, 5000);
        expect([cam.x, cam.y]).toEqual([1280, 160]);
    });

    it('reste à l’origine quand le monde est plus petit que l’écran', () => {
        const cam = new FairyCamera(640, 480);
        cam.setWorldSize(320, 200);
        cam.moveTo(100, 100);
        expect([cam.x, cam.y]).toEqual([0, 0]);
    });

    it('suit la cible seulement quand elle sort de la zone morte', () => {
        const cam = new FairyCamera(640, 480);
        cam.setWorldSize(10_000, 10_000);
        cam.setDeadZone(50, 40);
        // Centre de l'écran : (320, 240)
        cam.follow({ x: 360, y: 260 });
        expect([cam.x, cam.y]).toEqual([0, 0]);
        cam.follow({ x: 400, y: 300 });
        expect([cam.x, cam.y]).toEqual([30, 20]);
        cam.follow({ x: 300, y: 250 });
        expect([cam.x, cam.y]).toEqual([30, 20]);
    });

    it('centre la vue sur un point', () => {
        const cam = new FairyCamera(640, 480);
        cam.centerOn(1000, 1000);
        expect([cam.x, cam.y]).toEqual([680, 760]);
    });
});
