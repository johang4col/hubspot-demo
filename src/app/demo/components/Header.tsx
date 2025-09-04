"use client";

type HeaderProps = {
  apiHealthy?: boolean;
  cacheHealthy?: boolean;
};

export default function Header({
  apiHealthy = true,
  cacheHealthy = true,
}: HeaderProps) {
  return (
    <header className="flex items-center justify-between">
      <h1 className="text-2xl font-semibold">HubSpot Demo</h1>
      <div className="flex items-center gap-3 text-sm">
        <HealthDot label="API" healthy={apiHealthy} />
        <HealthDot label="Redis" healthy={cacheHealthy} />
      </div>
    </header>
  );
}

function HealthDot({ label, healthy }: { label: string; healthy: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      {label}:
      <span
        aria-label={`${label} status`}
        className={`h-2.5 w-2.5 rounded-full ${
          healthy ? "bg-emerald-500" : "bg-red-500"
        }`}
      />
    </span>
  );
}
