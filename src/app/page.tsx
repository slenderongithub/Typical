import { Suspense } from "react";

import { TestExperience } from "@/components/app/TestExperience";

export default function Home() {
  return (
    <Suspense>
      <TestExperience />
    </Suspense>
  );
}
