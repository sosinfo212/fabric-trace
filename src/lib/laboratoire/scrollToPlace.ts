/** Scroll rack grid cell into view (data attributes set on place cells). */
export function scrollToPlace(rackId: number, stage: number, place: number) {
  const el = document.querySelector(
    `[data-rack="${rackId}"][data-stage="${stage}"][data-place="${place}"]`
  );
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
