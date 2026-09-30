/**
 * Ambient background layer: a flat theme background with a faint dot grid.
 * (The drifting hue blobs and pointer glow were removed on request — the
 * themes read as solid colours now.)
 */
export function BackgroundGlow() {
  return (
    <div className="bg-glow-field" aria-hidden>
      <div className="glow-grid" />
    </div>
  );
}
