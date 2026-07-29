import { ZodError } from "zod";

// Shared return shape for Server Actions invoked directly from client code
// (not via native <form action=...>), so business-rule errors (ClaimError,
// WorkflowError, zod validation) surface as inline messages instead of
// throwing into a route error boundary and losing in-progress form state.
export type ActionResult<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };

export function errorMessage(err: unknown): string {
  if (err instanceof ZodError) {
    return err.issues[0]?.message ?? "Invalid input.";
  }
  if (err instanceof Error) {
    return err.message;
  }
  return "Something went wrong.";
}
