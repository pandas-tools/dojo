/**
 * SimulatedLessonBg — full-viewport placeholder image that stands in for
 * the next-lesson video that would sit behind a celebration popup in the
 * real /watch/ flow. Design-preview surfaces have no reel, so the
 * backdrop-blur has nothing to blur; this gives it something to bite.
 */
export default function SimulatedLessonBg() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/placeholders/carousels/store/02-portrait.png"
      alt=""
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full object-cover"
    />
  );
}
