/** Keyboard keys offered by the key blocks: [label, legacy keyCode]. */
export const KEY_OPTIONS: [string, string][] = [
    ['flèche gauche', '37'],
    ['flèche droite', '39'],
    ['flèche haut', '38'],
    ['flèche bas', '40'],
    ['espace', '32'],
    ['entrée', '13'],
    ...Array.from({ length: 26 }, (_, i): [string, string] => [
        String.fromCharCode(65 + i),
        String(65 + i),
    ]),
    ...Array.from({ length: 10 }, (_, i): [string, string] => [String(i), String(48 + i)]),
];
