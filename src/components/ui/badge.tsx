import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "danger" | "info" | "outline";
}

const variantClasses = {
  default: "bg-primary/10 text-primary",
  success: "bg-v-green/10 text-v-green",
  warning: "bg-v-amber/10 text-amber-700",
  danger: "bg-v-red/10 text-v-red",
  info: "bg-v-teal/10 text-teal-700",
  outline: "border border-border text-muted-foreground bg-transparent",
};

export function Badge({ variant = "default", className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", variantClasses[variant], className)}
      {...props}
    >
      {children}
    </span>
  );
}
