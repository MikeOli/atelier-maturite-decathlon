import { cn } from "@/lib/utils";
import type { Avatar } from "@/lib/avatars";

/**
 * Renders an avatar's custom illustration when it has one (`imageSrc`),
 * falling back to its emoji glyph otherwise — every avatar without a
 * custom image keeps rendering exactly as before.
 */
export function AvatarGlyph({
  avatar,
  size,
  className,
}: {
  avatar: Avatar | undefined;
  size: number;
  className?: string;
}) {
  if (!avatar) {
    return <span className={className}>❔</span>;
  }

  if (avatar.imageSrc) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- fixed-size local asset, no responsive/optimization needs
      <img
        src={avatar.imageSrc}
        alt={avatar.label}
        width={size}
        height={size}
        className={cn("rounded-full object-cover", className)}
      />
    );
  }

  return <span className={className}>{avatar.emoji}</span>;
}
