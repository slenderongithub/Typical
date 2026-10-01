import { PageHeader } from "@/components/app/PageHeader";
import { GazeLab } from "@/components/gaze/GazeLab";

/** Unlinked dev page: measures gaze accuracy against a scripted, labelled run. */
export default function GazeLabPage() {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader title="gaze lab" />
      <GazeLab />
    </div>
  );
}
