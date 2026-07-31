import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
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
      select: { id: true, username: true, displayName: true, createdAt: true },
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

  @Get('friends')
  async friends(@Req() request: AuthenticatedRequest) {
    const items = await this.database.client.friendship.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [{ requesterId: request.user.sub }, { addresseeId: request.user.sub }],
      },
      include: {
        requester: { select: { id: true, username: true, displayName: true } },
        addressee: { select: { id: true, username: true, displayName: true } },
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
        user: { select: { id: true, username: true, displayName: true } },
      },
    });
    return { items };
  }
}
