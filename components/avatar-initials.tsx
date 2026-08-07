import { cn } from "@/lib/utils";

interface AvatarInitialsProps {
  name: string;
  className?: string;
}

/** Round avatar with the person's initials. */
export function AvatarInitials({ name, className }: AvatarInitialsProps) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <span
      aria-hidden
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary",
        className
      )}
    >
      {initials}
    </span>
  );
}
