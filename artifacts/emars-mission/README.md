# E-Mars — Martian Map opening slide

Single live 3D slide (React Three Fiber + Drei + Three + Tailwind).

## Controls
- **Space** — Play / Replay the 2.5 s camera move (over-the-shoulder → 45° tactical view; routes fade in).
- **R** — Reset to the over-the-shoulder view.
- **H** — Hide / reveal the control bar (for clean recording).
- **Fullscreen** button — fullscreen the slide; if the browser/embed blocks it, a notice appears.
- **Mouse / touch** — drag to orbit, right-drag to pan, wheel to zoom (disabled while the transition runs).

These keys and clicks are captured by the slide and do not advance the deck.

## Schematic limits
Terrain, craters, ridge, both routes, slope (<12°), O₂/battery margins and ±14 min are an
**illustrative concept** — not NASA-measured or certified data and not output of the scientific app.

## Live vs. static export
`/allslides` (PDF/PPTX/thumbnails) renders the final tactical state with controls hidden
(`preserveDrawingBuffer` enabled). PPTX/PDF hold a static image — WebGL interactivity only exists in the live deck.
If WebGL is unavailable an explicit message is shown instead of the scene.
