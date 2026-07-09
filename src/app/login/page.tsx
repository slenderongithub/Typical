import type { Metadata } from "next";

import { AuthPanel } from "@/components/account/AuthPanel";

export const metadata: Metadata = { title: "sign in" };

export default function LoginPage() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center pb-24">
      <AuthPanel />
    </div>
  );
}
