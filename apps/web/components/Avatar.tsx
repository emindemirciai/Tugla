/**
 * Player avatar.
 *
 * Falls back to the initial rather than a generic silhouette: in a list of
 * twenty players, twenty identical placeholders carry no information, while
 * initials at least distinguish rows. The resolution order matches the API —
 * the player's own picture first, the identity provider's second.
 */
export interface AvatarSource {
  displayName: string;
  avatarUrl?: string | null;
  providerAvatarUrl?: string | null;
}

export function Avatar({ user, size = 32 }: { user: AvatarSource; size?: number }) {
  const source = user.avatarUrl ?? user.providerAvatarUrl ?? null;

  if (!source) {
    return (
      <span
        className="avatar avatar-empty avatar-inline"
        style={{ width: size, height: size, fontSize: size * 0.45 }}
        aria-hidden
      >
        {user.displayName.slice(0, 1).toUpperCase()}
      </span>
    );
  }

  return (
    /* A plain img: avatars come from arbitrary hosts and next/image would need
       every one of them allow-listed. */
    <img
      className="avatar avatar-inline"
      src={source}
      alt=""
      width={size}
      height={size}
      loading="lazy"
    />
  );
}
