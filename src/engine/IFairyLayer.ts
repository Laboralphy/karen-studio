/** A layer that can be ticked and rendered each frame. */
export interface IFairyLayer {
    proceed(): void;
    render(): void;
    /**
     * Optional: receive the camera position (world coordinate of the viewport's
     * top-left corner) before `render`. Layers that ignore it are drawn fixed on screen.
     */
    setView?(x: number, y: number): void;
}
