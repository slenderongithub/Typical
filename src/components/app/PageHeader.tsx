import type { ReactNode } from "react";

/** Shared page title block — one rhythm for every non-test route. */
export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  /** Optional right-aligned slot (actions, filters). */
  children?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[1.75rem] font-semibold leading-tight tracking-tight text-foreground">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </header>
  );
}
