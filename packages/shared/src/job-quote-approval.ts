/**
 * Quote and approval transitions require at least one task on the job card.
 * Enforced in API updateStatus and mirrored in the job detail UI.
 */
export const JOB_STATUSES_REQUIRING_TASKS = ["QUOTE_SENT", "APPROVED"] as const;

export type JobStatusRequiringTasks = (typeof JOB_STATUSES_REQUIRING_TASKS)[number];

export function jobStatusRequiresTasks(status: string): status is JobStatusRequiringTasks {
  return (JOB_STATUSES_REQUIRING_TASKS as readonly string[]).includes(status);
}

/** Hide quote/approve from the manager status dropdown when the job has no tasks yet. */
export function filterJobStatusOptionsWithoutTasks<T extends string>(
  options: T[],
  taskCount: number,
): T[] {
  if (taskCount > 0) return options;
  return options.filter((s) => !jobStatusRequiresTasks(s));
}

export const JOB_QUOTE_APPROVE_TASKS_MESSAGE =
  "Add at least one task before sending a quote or approving the job.";
