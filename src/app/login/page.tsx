import AuthAtmosphere from "@/components/AuthAtmosphere";
import LoginForm from "./LoginForm";

export const metadata = { title: "Sign in · Dojo" };

export default function LoginPage() {
  return (
    <main className="relative isolate min-h-dvh overflow-hidden bg-near-black text-white">
      <AuthAtmosphere />
      <LoginForm />
    </main>
  );
}
