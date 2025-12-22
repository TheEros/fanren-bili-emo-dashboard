import React from "react";
import { cn } from "./primitives";

export function NativeSelect({
  value,
  onChange,
  options,
  className,
}: {
  value?: string;
  onChange: (v: string) => void;
  options: { label: string; value: string }[];
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200",
        className
      )}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
