import React from "react";

export function cn(...cls: Array<string | undefined | false | null>) {
  return cls.filter(Boolean).join(" ");
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-2xl bg-white shadow-soft border border-slate-200", className)} {...props} />;
}
export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5 pb-3", className)} {...props} />;
}
export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-base font-semibold", className)} {...props} />;
}
export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-slate-500", className)} {...props} />;
}
export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5 pt-0", className)} {...props} />;
}

export function Button({
  className,
  variant = "default",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "secondary" }) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-medium transition active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed";
  const styles =
    variant === "secondary"
      ? "bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-200"
      : "bg-slate-900 hover:bg-slate-800 text-white border border-slate-900";
  return <button className={cn(base, styles, className)} {...props} />;
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200",
        className
      )}
      {...props}
    />
  );
}

export function Badge({
  className,
  variant = "secondary",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: "secondary" | "default" }) {
  const styles =
    variant === "default"
      ? "bg-slate-900 text-white"
      : "bg-slate-100 text-slate-700 border border-slate-200";
  return <span className={cn("inline-flex items-center rounded-xl px-2 py-1 text-xs", styles, className)} {...props} />;
}

export function Separator({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-slate-200", className)} />;
}

export function Progress({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="h-2 w-full rounded-full bg-slate-100 border border-slate-200 overflow-hidden">
      <div className="h-full rounded-full bg-slate-900" style={{ width: `${v}%` }} />
    </div>
  );
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-sm text-slate-700", className)} {...props} />;
}

export function Switch({ checked, onCheckedChange }: { checked: boolean; onCheckedChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 items-center rounded-full border transition",
        checked ? "bg-slate-900 border-slate-900" : "bg-slate-100 border-slate-200"
      )}
      aria-pressed={checked}
    >
      <span
        className={cn(
          "inline-block h-5 w-5 transform rounded-full bg-white shadow transition",
          checked ? "translate-x-5" : "translate-x-1"
        )}
      />
    </button>
  );
}

export function Alert({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-2xl border border-slate-200 bg-white p-4 shadow-soft", className)}>{children}</div>;
}
export function AlertTitle({ children }: { children: React.ReactNode }) {
  return <div className="text-sm font-semibold text-slate-900">{children}</div>;
}
export function AlertDescription({ children }: { children: React.ReactNode }) {
  return <div className="mt-1 text-sm text-slate-600">{children}</div>;
}

export function ScrollArea({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("overflow-auto", className)}>{children}</div>;
}
