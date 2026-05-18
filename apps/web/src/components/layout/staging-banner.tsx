export function StagingBanner() {
  const env = process.env.NEXT_PUBLIC_APP_ENV ?? "development";
  if (env === "production") return null;

  return (
    <div className="bg-amber-100 px-4 py-2 text-center text-sm font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-100">
      STAGING — test data only · Phase 0 UI shell
    </div>
  );
}
