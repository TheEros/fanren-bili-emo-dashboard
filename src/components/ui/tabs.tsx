import React from "react";
import { cn } from "./primitives";

type TabsCtx = { value: string; setValue: (v: string) => void };
const Ctx = React.createContext<TabsCtx | null>(null);

export function Tabs({ defaultValue, className, children }: { defaultValue: string; className?: string; children: React.ReactNode }) {
  const [value, setValue] = React.useState(defaultValue);
  return (
    <Ctx.Provider value={{ value, setValue }}>
      <div className={cn(className)}>{children}</div>
    </Ctx.Provider>
  );
}

export function TabsList({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("inline-flex rounded-2xl bg-slate-100 p-1 border border-slate-200", className)}>{children}</div>;
}

export function TabsTrigger({ value, className, children }: { value: string; className?: string; children: React.ReactNode }) {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("TabsTrigger must be used within Tabs");
  const active = ctx.value === value;
  return (
    <button
      type="button"
      onClick={() => ctx.setValue(value)}
      className={cn(
        "rounded-2xl px-3 py-2 text-sm font-medium transition",
        active ? "bg-white border border-slate-200 shadow-sm" : "text-slate-600 hover:text-slate-900",
        className
      )}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, className, children }: { value: string; className?: string; children: React.ReactNode }) {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("TabsContent must be used within Tabs");
  if (ctx.value !== value) return null;
  return <div className={cn(className)}>{children}</div>;
}
