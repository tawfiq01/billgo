"use client";

// Toggles every "ids" checkbox in the enclosing form — plain DOM query
// instead of shared React state, since the row checkboxes are rendered by a
// server component and don't need to be lifted into client state otherwise.
export function SelectAllCheckbox() {
  return (
    <input
      type="checkbox"
      aria-label="Select all"
      onChange={(e) => {
        const form = e.currentTarget.closest("form");
        form?.querySelectorAll<HTMLInputElement>('input[name="ids"]').forEach((cb) => {
          cb.checked = e.currentTarget.checked;
        });
      }}
    />
  );
}
