import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost" | "destructive" | "success";
  size?: "sm" | "md" | "lg" | "icon";
}

const variantClasses = {
  default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm",
  outline: "border border-border bg-transparent hover:bg-secondary text-foreground",
  ghost: "hover:bg-secondary text-foreground",
  destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  success: "bg-v-green text-white hover:bg-v-green/90",
};

const sizeClasses = {
  sm: "h-7 px-2.5 text-xs rounded-md",
  md: "h-9 px-3.5 text-sm rounded-lg",
  lg: "h-11 px-5 text-sm rounded-lg",
  icon: "h-8 w-8 rounded-lg",
};

export function Button({ variant = "default", size = "md", className, children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-1.5 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
