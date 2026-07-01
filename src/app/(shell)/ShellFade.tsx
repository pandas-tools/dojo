/**
 * ShellFade — temporarily a pass-through while I isolate the "doubled render"
 * on tab change. Bring back the crossfade once the source is identified.
 */
export default function ShellFade({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
