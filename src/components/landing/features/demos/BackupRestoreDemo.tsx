import { DATA_STEPS } from "../../data/copy";
import { DataStepShowcase } from "../../sections/DataStepShowcase";

const BACKUP_STEP_IDS: ReadonlySet<string> = new Set(["export", "restore"]);
const BACKUP_STEPS = DATA_STEPS.filter((step) => BACKUP_STEP_IDS.has(step.id));

/** The landing's import and backup stepper, narrowed to back up and restore. */
export function BackupRestoreDemo() {
  return <DataStepShowcase steps={BACKUP_STEPS} />;
}
