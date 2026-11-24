import * as React from "react";

import { cn } from "@/lib/utils";

const control =
  "w-full rounded-control border border-input bg-surface text-base text-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70 aria-invalid:border-critical aria-invalid:bg-critical-soft";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(control, "h-10 min-w-0 px-3 file:mr-3 file:border-0 file:bg-transparent file:font-bold", className)}
      {...props}
    />
  );
}

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea data-slot="textarea" className={cn(control, "min-h-24 px-3 py-2", className)} {...props} />;
}

function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <select data-slot="select" className={cn(control, "h-10 px-2", className)} {...props}>
      {children}
    </select>
  );
}

function Label({ className, ...props }: React.ComponentProps<"label">) {
  return <label data-slot="label" className={cn("text-base font-bold text-foreground", className)} {...props} />;
}

function FieldHint({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

function FieldError({ className, ...props }: React.ComponentProps<"p">) {
  return <p role="alert" className={cn("text-sm text-critical", className)} {...props} />;
}

function Field({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-2", className)} {...props} />;
}

export { Input, Textarea, NativeSelect, Label, FieldHint, FieldError, Field };
