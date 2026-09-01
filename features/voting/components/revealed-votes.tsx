import { AVATARS } from "@/lib/avatars";
import { AvatarGlyph } from "@/components/avatar-glyph";
import type { RevealedVote } from "@/features/voting/actions";
import { getVoteExtremes, getMaturityColors } from "@/lib/voting";

export function RevealedVotes({ votes }: { votes: RevealedVote[] }) {
  if (votes.length === 0) {
    return (
      <p className="text-muted-foreground text-sm text-center">
        Personne n&apos;a voté sur cette carte.
      </p>
    );
  }

  const extremes = getVoteExtremes(votes.map((vote) => vote.value));

  return (
    <ul className="flex flex-wrap justify-center gap-4">
      {votes.map((vote) => {
        const avatar = AVATARS.find((a) => a.key === vote.avatarKey);
        const isMax = extremes !== null && vote.value === extremes.max;
        const isMin = extremes !== null && vote.value === extremes.min;
        const colors = getMaturityColors(vote.value);

        return (
          <li
            key={vote.avatarKey}
            className="flex flex-col items-center rounded-[18px] border bg-card px-[18px] py-5 w-[150px] text-center shadow-sm"
          >
            <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-sky text-lg">
              <AvatarGlyph avatar={avatar} size={40} className="h-full w-full" />
            </span>
            <span className="mb-3.5 text-[13.5px] font-medium leading-tight whitespace-nowrap">
              {vote.avatarLabel}
            </span>
            <span
              className="mb-3.5 flex h-14 w-14 items-center justify-center rounded-full font-mono text-2xl font-semibold text-white"
              style={{ backgroundColor: colors.bg }}
            >
              {vote.value}
            </span>
            {(isMax || isMin) && (
              <span className="whitespace-nowrap rounded-[14px] bg-primary px-2.5 py-2 text-xs font-medium text-primary-foreground">
                {isMax ? "▲ Le plus haut" : "▼ Le plus bas"}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
