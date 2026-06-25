import BrandAtmosphere from "@/components/BrandAtmosphere";
import StepProgress from "@/components/StepProgress";
import LoginForm from "./LoginForm";

export const metadata = { title: "Sign in · Dojo" };

export default function LoginPage() {
  return (
    <main className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-near-black text-white">
      <BrandAtmosphere variant="full" showStars showDots animated />

      <div className="relative z-10 flex min-h-dvh w-full flex-col px-6 pb-8 pt-10 sm:pb-10">
        <div className="mx-auto w-full max-w-md">
          <StepProgress current={1} total={3} />
        </div>

        <header className="mx-auto mt-10 w-full max-w-md text-center">
          <h1 className="text-balance text-[28px] font-medium leading-tight tracking-tight text-white sm:text-[32px]">
            Hi, Welcome Back!
          </h1>
          <p className="mt-2 text-sm text-white/55">
            Sign in to keep training on Pandas&nbsp;Vision&nbsp;AI.
          </p>
        </header>

        <div className="mx-auto mt-auto w-full max-w-md">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
