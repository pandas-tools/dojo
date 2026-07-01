/**
 * LibraryAtmosphere — backdrop for in-app surfaces (Library, Bookmark).
 * Matches the Figma file (node 96:394) — a muted version of the auth
 * backdrop: steel-harbor → near-black linear gradient with 60% alpha,
 * over a near-black base. No bottom glow / aurora; the bright moments
 * live inside the section cards.
 *
 * Gradient stop is viewport-relative (dvh), not element-relative — so a
 * short page (Bookmarks) and a tall page (Library) share the same fade
 * endpoint instead of the fade collapsing on short pages.
 */
export default function LibraryAtmosphere() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden bg-[#0e0e0e]"
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(68,81,88,0.6) 0, rgba(14,14,14,0.6) 31.844dvh)",
        }}
      />
    </div>
  );
}
