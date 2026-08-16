-- Avatar support.
--
-- Two columns on purpose: "avatarUrl" is the picture the player chose and
-- "providerAvatarUrl" is the one the identity provider last supplied. Sign-in
-- refreshes the provider column only, so a player's own picture is never
-- overwritten by their next Google sign-in.
ALTER TABLE "User" ADD COLUMN "avatarUrl" TEXT;
ALTER TABLE "User" ADD COLUMN "providerAvatarUrl" TEXT;
