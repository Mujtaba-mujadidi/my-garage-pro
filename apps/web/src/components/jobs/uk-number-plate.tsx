import { formatRegistrationDisplay } from "@/lib/vehicle-registration";

type UkNumberPlateProps = {
  registration: string;
  className?: string;
};

/** UK rear-style yellow number plate for job headers and vehicle display. */
export function UkNumberPlate({ registration, className = "" }: UkNumberPlateProps) {
  const display = formatRegistrationDisplay(registration);
  if (!display) return null;

  return (
    <div
      className={`inline-flex overflow-hidden rounded-md border-2 border-black shadow-sm ${className}`.trim()}
      aria-label={`Registration ${display}`}
    >
      <div className="flex w-7 shrink-0 items-center justify-center bg-[#003399] px-1 py-2">
        <span className="text-[9px] font-bold leading-none text-white">GB</span>
      </div>
      <div className="flex min-w-[7.5rem] items-center justify-center bg-[#F7CE46] px-3 py-1.5">
        <span className="font-mono text-lg font-bold tracking-[0.12em] text-black">{display}</span>
      </div>
    </div>
  );
}
