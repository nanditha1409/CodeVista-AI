import type { ReactNode } from "react";

interface PanelHeaderProps {
  icon: ReactNode;
  title: string;
  badges?: ReactNode;
  children?: ReactNode;
  className?: string;
}

/** Shared visual header for analysis panels. */
export function PanelHeader({ icon, title, badges, children, className = "" }: PanelHeaderProps) {
  return (
    <div className={`flex min-h-14 items-center justify-between gap-4 border-b border-white/10 bg-[#121225] px-5 py-3 ${className}`}>
      <div className="flex min-w-0 items-center gap-3">
        <span className="text-blue-300">{icon}</span>
        <h2 className="truncate text-[16px] font-semibold leading-tight text-white/90">{title}</h2>
        {badges && <div className="flex items-center gap-1.5">{badges}</div>}
      </div>
      {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
    </div>
  );
}
