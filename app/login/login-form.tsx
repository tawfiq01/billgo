"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = {};

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <input suppressHydrationWarning type="hidden" name="next" value={next ?? ""} />
      <div>
        <label className="field-label" htmlFor="email">
          Email
        </label>
        <input suppressHydrationWarning className="field-input" id="email" name="email" type="email" autoComplete="username" required autoFocus />
      </div>
      <div>
        <label className="field-label" htmlFor="password">
          Password
        </label>
        <input suppressHydrationWarning
          className="field-input"
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      <button type="submit" className="btn-primary w-full" disabled={pending}>
        {pending ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
