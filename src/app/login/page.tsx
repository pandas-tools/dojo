import AuthAtmosphere from "@/components/AuthAtmosphere";
import LoginIntro, {
  INTRO_SKIP_ATTR,
  INTRO_STORAGE_KEY,
} from "@/components/LoginIntro";
import LoginForm from "./LoginForm";

export const metadata = { title: "Sign in · Dojo" };

// Runs synchronously in the <body> before AuthAtmosphere / wizard / intro
// are parsed. If the intro has already played this session, mark the
// document so the LoginIntro overlay CSS collapses to display:none and
// the wizard's rise-in classes reset to opacity:1 — no flash of black on
// repeat visits.
const INTRO_INIT_SCRIPT = `try{if(sessionStorage.getItem(${JSON.stringify(
  INTRO_STORAGE_KEY,
)})==='1')document.documentElement.setAttribute(${JSON.stringify(
  INTRO_SKIP_ATTR,
)},'skip');}catch{}`;

export default function LoginPage() {
  return (
    <main className="relative isolate min-h-dvh overflow-hidden bg-near-black text-white">
      <script dangerouslySetInnerHTML={{ __html: INTRO_INIT_SCRIPT }} />
      <link
        rel="preload"
        as="image"
        href="/brand/pandas-emblem-animated.gif"
        fetchPriority="high"
      />
      <AuthAtmosphere />
      <LoginForm />
      <LoginIntro />
    </main>
  );
}
