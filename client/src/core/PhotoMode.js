/**
 * PhotoMode — press P while playing to capture a clean screenshot
 * (no HUD — it's a DOM overlay, so the WebGL canvas is already clean).
 * Renders one fresh frame synchronously, then downloads a PNG.
 */
import { bus, Events } from './EventBus.js';

export class PhotoMode {
  /** @param {import('./Engine.js').Engine} engine @param {() => boolean} isPlaying */
  constructor(engine, isPlaying) {
    this.engine = engine;
    this.busy = false;

    document.addEventListener('keydown', (e) => {
      if (e.code !== 'KeyP' || !isPlaying() || this.busy) return;
      this.capture();
    });
  }

  capture() {
    this.busy = true;
    // Fresh frame right before reading pixels (the drawing buffer may
    // already be presented/cleared otherwise).
    this.engine.composer.render(0);
    this.engine.renderer.domElement.toBlob((blob) => {
      this.busy = false;
      if (!blob) return;
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `escape-room-${stamp}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      bus.emit(Events.PLAY_SOUND, { name: 'camera_shutter' });
      bus.emit(Events.TOAST, { text: 'Photograph taken. Some things prefer not to be captured.' });
    }, 'image/png');
  }
}
