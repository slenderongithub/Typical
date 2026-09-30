import type { ReactNode } from "react";

/** Shared page title block — one rhythm for every non-test route. */
export function PageHeader({
  title,
  children,
}: {
  title: string;
  /** Optional right-aligned slot (actions, filters). */
  children?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <h1 className="text-4xl font-extrabold leading-none tracking-[-0.035em] text-foreground sm:text-5xl">
        {title}
      </h1>
      {children}
    </header>
  );
}
