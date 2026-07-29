import Image from "next/image";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden bg-background px-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 15% 20%, var(--accent), transparent 45%), radial-gradient(circle at 85% 80%, var(--brand-orange), transparent 45%)",
        }}
      />

      <div className="card relative w-full max-w-sm overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-accent to-brand-orange" />

        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="Billgo" width={101} height={72} priority className="h-12 w-auto shrink-0" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Billgo</h1>
            <p className="text-sm text-muted">Bill Management System</p>
          </div>
        </div>

        <div className="mt-6">
          <LoginForm next={next} />
        </div>
      </div>
    </div>
  );
}
