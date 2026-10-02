/**
 * Any image source the engine can draw from: a loaded image file, or a canvas /
 * bitmap generated in memory (e.g. by an editor).
 * Use `.width` (not `naturalWidth`) to read its pixel size: it is defined for all three.
 */
export type FairyImage = HTMLImageElement | HTMLCanvasElement | ImageBitmap;
