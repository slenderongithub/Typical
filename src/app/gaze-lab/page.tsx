import { notFound } from "next/navigation";

import { PageHeader } from "@/components/app/PageHeader";
import { GazeLab } from "@/components/gaze/GazeLab";

/**
 * Local-only dev page: records labelled gaze runs (CSV) to tune the detector.
 * 404s in production builds — run `npm run dev` to use it.
 */
export default function GazeLabPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader title="gaze lab" />
      <GazeLab />
    </div>
  );
}
