import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { pageSchema } from '@tugla/shared';
import { z } from 'zod';
import { type AuthenticatedRequest, DatabaseService } from '../services/core';

const friendshipSchema = z.object({ userId: z.string().uuid() });

@Injectable()
export class SocialService {
  constructor(private readonly database: DatabaseService) {}

  async follow(userId: string, targetId: string) {
    if (userId === targetId) throw new BadRequestException('Cannot follow yourself');
    const blocked = await this.database.client.userBlock.findFirst({
      where: {
        OR: [
          { blockerId: userId, blockedId: targetId },
          { blockerId: targetId, blockedId: userId },
        ],
      },
    });
    if (blocked) throw new BadRequestException('Relationship unavailable');
    return this.database.client.follow.upsert({
      where: {
        followerId_followingId: { followerId: userId, followingId: targetId },
      },
      update: {},
      create: { followerId: userId, followingId: targetId },
    });
  }

  async requestFriend(userId: string, targetId: string) {
    if (userId === targetId) throw new BadRequestException('Cannot friend yourself');
    const friendship = await this.database.client.friendship.upsert({
      where: {
        requesterId_addresseeId: { requesterId: userId, addresseeId: targetId },
      },
      update: { status: 'PENDING' },
      create: { requesterId: userId, addresseeId: targetId },
    });

    // Without an inbox entry the addressee would never learn about the request.
    const requester = await this.database.client.user.findUnique({
      where: { id: userId },
      select: { displayName: true, username: true },
    });
    await this.database.client.notification.create({
      data: {
        userId: targetId,
        type: 'FRIEND_REQUEST',
        title: requester?.displayName ?? 'New friend request',
        body: `@${requester?.username ?? 'a player'} wants to be friends.`,
        data: { friendshipId: friendship.id, requesterId: userId },
      },
    });
    return friendship;
  }

  async acceptFriend(userId: string, friendshipId: string) {
    const friendship = await this.database.client.friendship.update({
      where: { id: friendshipId, addresseeId: userId },
      data: { status: 'ACCEPTED' },
    });

    const accepter = await this.database.client.user.findUnique({
      where: { id: userId },
      select: { displayName: true, username: true },
    });
    await this.database.client.notification.create({
      data: {
        userId: friendship.requesterId,
        type: 'FRIEND_ACCEPTED',
        title: accepter?.displayName ?? 'Friend request accepted',
        body: `@${accepter?.username ?? 'a player'} accepted your friend request.`,
        data: { friendshipId: friendship.id },
      },
    });
    return friendship;
  }

  /**
   * Sends a direct message to an accepted friend.
   *
   * Messages are delivered as inbox notifications rather than a new table:
   * a message to a player *is* something in their inbox, and reusing the model
   * keeps read state, listing and deletion-on-account-removal working with no
   * new code. The audit trail records who wrote to whom and nothing else —
   * moderators asked for a log, not a mailbox they can read.
   */

  /**
   * Public profile of one player.
   *
   * The social layer let players find each other and become friends but never
   * showed who they were — a search result was a name and nothing else. This is
   * the page behind the name: progress, achievements and standing, plus the
   * viewer's relationship to them so the actions on screen match reality.
   *
   * `searchVisible` is honoured here as well as in search. A player who opted
   * out of discovery should not be reachable by guessing their handle either.
   */
  async publicProfile(viewerId: string, username: string) {
    const user = await this.database.client.user.findUnique({
      where: { username: username.toLowerCase() },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        providerAvatarUrl: true,
        searchVisible: true,
        status: true,
        createdAt: true,
        progress: { select: { playerLevel: true, experience: true, currentLevel: true } },
      },
    });

    if (!user || user.status === 'DELETED') throw new NotFoundException('Player not found');
    if (!user.searchVisible && user.id !== viewerId) {
      throw new NotFoundException('Player not found');
    }

    const [achievements, clearedLevels, friendship, bestWeekly] = await Promise.all([
      // A row exists as soon as progress starts, so only count the ones that
      // actually unlocked.
      this.database.client.achievementUnlock.count({
        where: { userId: user.id, unlockedAt: { not: null } },
      }),
      this.database.client.gameSession.findMany({
        where: { userId: user.id, status: 'COMPLETED', mode: 'CAMPAIGN' },
        select: { levelId: true },
        distinct: ['levelId'],
      }),
      viewerId === user.id
        ? null
        : this.database.client.friendship.findFirst({
            where: {
              OR: [
                { requesterId: viewerId, addresseeId: user.id },
                { requesterId: user.id, addresseeId: viewerId },
              ],
            },
            select: { id: true, status: true, requesterId: true },
          }),
      this.database.client.leaderboardEntry.findFirst({
        where: { userId: user.id, boardKey: { startsWith: 'global:' } },
        orderBy: { score: 'desc' },
        select: { score: true, boardKey: true },
      }),
    ]);

    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      providerAvatarUrl: user.providerAvatarUrl,
      joinedAt: user.createdAt,
      playerLevel: user.progress?.playerLevel ?? 1,
      experience: user.progress?.experience ?? 0,
      campaignLevel: user.progress?.currentLevel ?? 1,
      levelsCleared: clearedLevels.length,
      achievementsUnlocked: achievements,
      bestWeeklyScore: bestWeekly?.score ?? null,
      isSelf: user.id === viewerId,
      friendship: friendship
        ? {
            id: friendship.id,
            status: friendship.status,
            incoming: friendship.requesterId !== viewerId,
          }
        : null,
    };
  }

  async sendMessage(senderId: string, input: unknown) {
    const data = z
      .object({
        userId: z.string().uuid(),
        body: z.string().trim().min(1).max(1000),
      })
      .parse(input);

    if (senderId === data.userId) throw new BadRequestException('Cannot message yourself');

    const friendship = await this.database.client.friendship.findFirst({
      where: {
        status: 'ACCEPTED',
        OR: [
          { requesterId: senderId, addresseeId: data.userId },
          { requesterId: data.userId, addresseeId: senderId },
        ],
      },
      select: { id: true },
    });
    if (!friendship) throw new BadRequestException('You can only message accepted friends');

    const sender = await this.database.client.user.findUnique({
      where: { id: senderId },
      select: { username: true, displayName: true },
    });

    const notification = await this.database.client.notification.create({
      data: {
        userId: data.userId,
        type: 'DIRECT_MESSAGE',
        title: sender?.displayName ?? 'New message',
        body: data.body,
        data: { fromUserId: senderId, fromUsername: sender?.username ?? null },
      },
      select: { id: true, createdAt: true },
    });

    // Metadata only: the message body never reaches the audit log.
    await this.database.client.auditLog.create({
      data: {
        actorId: senderId,
        action: 'DIRECT_MESSAGE_SENT',
        targetType: 'User',
        targetId: data.userId,
        after: { notificationId: notification.id, length: data.body.length },
      },
    });

    return { id: notification.id, sentAt: notification.createdAt };
  }
}

@Controller('social')
export class SocialController {
  constructor(
    private readonly social: SocialService,
    private readonly database: DatabaseService,
  ) {}

  @Get('players')
  async search(@Query('q') query = '') {
    const safeQuery = query.trim().slice(0, 40);
    if (safeQuery.length < 2) return { items: [] };
    const items = await this.database.client.user.findMany({
      where: {
        status: 'ACTIVE',
        searchVisible: true,
        OR: [
          { username: { contains: safeQuery, mode: 'insensitive' } },
          { displayName: { contains: safeQuery, mode: 'insensitive' } },
        ],
      },
      take: 20,
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        providerAvatarUrl: true,
        createdAt: true,
      },
    });
    return { items };
  }

  @Post('follow')
  follow(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const data = friendshipSchema.parse(body);
    return this.social.follow(request.user.sub, data.userId);
  }

  @Delete('follow/:userId')
  unfollow(@Req() request: AuthenticatedRequest, @Param('userId') targetId: string) {
    return this.database.client.follow.deleteMany({
      where: { followerId: request.user.sub, followingId: targetId },
    });
  }

  @Post('friends')
  friend(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const data = friendshipSchema.parse(body);
    return this.social.requestFriend(request.user.sub, data.userId);
  }

  @Post('friends/:id/accept')
  accept(@Req() request: AuthenticatedRequest, @Param('id') friendshipId: string) {
    return this.social.acceptFriend(request.user.sub, friendshipId);
  }

  @Get('players/:username')
  profile(@Req() request: AuthenticatedRequest, @Param('username') username: string) {
    return this.social.publicProfile(request.user.sub, username);
  }

  @Post('messages')
  sendMessage(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.social.sendMessage(request.user.sub, body);
  }

  @Get('friends')
  async friends(@Req() request: AuthenticatedRequest) {
    const items = await this.database.client.friendship.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [{ requesterId: request.user.sub }, { addresseeId: request.user.sub }],
      },
      include: {
        requester: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            providerAvatarUrl: true,
          },
        },
        addressee: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            providerAvatarUrl: true,
          },
        },
      },
    });
    return { items };
  }

  @Get('leaderboards/:boardKey')
  async leaderboard(@Param('boardKey') boardKey: string, @Query() query: unknown) {
    const page = pageSchema.parse(query);
    const items = await this.database.client.leaderboardEntry.findMany({
      where: { boardKey: boardKey.slice(0, 120) },
      orderBy: { score: 'desc' },
      take: page.limit,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            providerAvatarUrl: true,
          },
        },
      },
    });
    return { items };
  }
}
