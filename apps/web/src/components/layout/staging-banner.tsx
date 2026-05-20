export function StagingBanner() {
  const env = process.env.NEXT_PUBLIC_APP_ENV ?? "development";
  if (env === "production") return null;

  const build = process.env.NEXT_PUBLIC_BUILD_SHA?.slice(0, 7);

  return (
    <div className="shrink-0 bg-amber-100 px-4 py-2 text-center text-sm font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-100">
      STAGING — test data only
      {build ? (
        <span className="ml-2 font-mono text-xs opacity-80">build {build}</span>
      ) : null}
    </div>
  );
}
