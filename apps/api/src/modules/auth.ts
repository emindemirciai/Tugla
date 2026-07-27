import { createHash, randomBytes } from 'node:crypto';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthProvider, User, UserRole, UserStatus } from '@tugla/database';
import { loginSchema, registerSchema } from '@tugla/shared';
import bcrypt from 'bcrypt';
import type { Response } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { z } from 'zod';
import {
  AccessGuard,
  type AccessClaims,
  type AuthenticatedRequest,
  DatabaseService,
  Public,
} from '../services/core';

const refreshSchema = z.object({ refreshToken: z.string().min(32).optional() });
const oauthSchema = z.object({
  provider: z.enum(['google', 'apple']),
  identityToken: z.string().min(100),
  displayName: z.string().min(2).max(40).optional(),
});

@Injectable()
export class AuthService {
  constructor(
    private readonly database: DatabaseService,
    private readonly jwt: JwtService,
  ) {}

  private async issueTokens(
    user: { id: string; email: string; role: UserRole },
    metadata: { ip?: string; userAgent?: string },
  ) {
    const claims: AccessClaims = {
      sub: user.id,
      email: user.email,
      role: user.role,
      type: 'access',
    };
    const accessToken = await this.jwt.signAsync(claims, {
      secret: process.env.JWT_ACCESS_SECRET ?? 'development-access-secret-change-me',
    });
    const refreshToken = randomBytes(48).toString('base64url');
    await this.database.refreshSession.create({
      data: {
        userId: user.id,
        tokenHash: createHash('sha256').update(refreshToken).digest('hex'),
        ipAddress: metadata.ip,
        userAgent: metadata.userAgent,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1_000),
      },
    });
    return { accessToken, refreshToken, expiresIn: 900 };
  }

  async register(input: unknown, metadata: { ip?: string; userAgent?: string }) {
    const data = registerSchema.parse(input);
    const existing = await this.database.user.findUnique({ where: { email: data.email } });
    if (existing) throw new BadRequestException('Email already registered');
    const passwordHash = await bcrypt.hash(data.password, 12);
    const usernameBase = data.displayName
      .normalize('NFKD')
      .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase()
      .slice(0, 22);
    const username = `${usernameBase || 'player'}-${randomBytes(3).toString('hex')}`;
    const user = await this.database.$transaction(async (database) =>
      database.user.create({
        data: {
          email: data.email,
          username,
          displayName: data.displayName,
          passwordHash,
          locale: data.locale,
          acceptedTermsAt: new Date(),
          accounts: {
            create: { provider: AuthProvider.PASSWORD, providerAccountId: data.email },
          },
          progress: { create: {} },
          balances: {
            create: [
              { currency: 'CREDITS', amount: 0 },
              { currency: 'CRYSTALS', amount: 0 },
            ],
          },
        },
      }),
    );
    return { user: this.publicUser(user), ...(await this.issueTokens(user, metadata)) };
  }

  async login(input: unknown, metadata: { ip?: string; userAgent?: string }) {
    const data = loginSchema.parse(input);
    const user = await this.database.user.findUnique({ where: { email: data.email } });
    if (!user?.passwordHash || !(await bcrypt.compare(data.password, user.passwordHash)))
      throw new UnauthorizedException('Invalid credentials');
    if (user.status !== UserStatus.ACTIVE) throw new UnauthorizedException('Account unavailable');
    return { user: this.publicUser(user), ...(await this.issueTokens(user, metadata)) };
  }

  async refresh(token: string | undefined, metadata: { ip?: string; userAgent?: string }) {
    if (!token) throw new UnauthorizedException('Refresh token missing');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const session = await this.database.refreshSession.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!session || session.revokedAt || session.expiresAt < new Date())
      throw new UnauthorizedException('Refresh token invalid');
    await this.database.refreshSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });
    return {
      user: this.publicUser(session.user),
      ...(await this.issueTokens(session.user, metadata)),
    };
  }

  async oauth(input: unknown, metadata: { ip?: string; userAgent?: string }) {
    const data = oauthSchema.parse(input);
    let subject = '';
    let email = '';
    if (data.provider === 'google') {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      if (!clientId) throw new BadRequestException('Google sign-in is not configured');
      const keys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
      const verified = await jwtVerify(data.identityToken, keys, {
        issuer: ['https://accounts.google.com', 'accounts.google.com'],
        audience: clientId,
      });
      subject = String(verified.payload.sub);
      email = String(verified.payload.email ?? '').toLowerCase();
    } else {
      const clientId = process.env.APPLE_CLIENT_ID;
      if (!clientId) throw new BadRequestException('Apple sign-in is not configured');
      const keys = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));
      const verified = await jwtVerify(data.identityToken, keys, {
        issuer: 'https://appleid.apple.com',
        audience: clientId,
      });
      subject = String(verified.payload.sub);
      email = String(verified.payload.email ?? '').toLowerCase();
    }
    if (!subject || !email)
      throw new UnauthorizedException('Identity provider response is incomplete');
    const provider = data.provider === 'google' ? AuthProvider.GOOGLE : AuthProvider.APPLE;
    const account = await this.database.authAccount.findUnique({
      where: { provider_providerAccountId: { provider, providerAccountId: subject } },
      include: { user: true },
    });
    let user: User | null | undefined = account?.user;
    if (!user) {
      user = await this.database.user.findUnique({ where: { email } });
      if (user) {
        await this.database.authAccount.create({
          data: { userId: user.id, provider, providerAccountId: subject },
        });
      } else {
        user = await this.database.user.create({
          data: {
            email,
            username: `player-${randomBytes(4).toString('hex')}`,
            displayName: data.displayName ?? email.split('@')[0] ?? 'Player',
            emailVerifiedAt: new Date(),
            acceptedTermsAt: new Date(),
            accounts: { create: { provider, providerAccountId: subject } },
            progress: { create: {} },
            balances: {
              create: [
                { currency: 'CREDITS', amount: 0 },
                { currency: 'CRYSTALS', amount: 0 },
              ],
            },
          },
        });
      }
    }
    return { user: this.publicUser(user), ...(await this.issueTokens(user, metadata)) };
  }

  async logout(token: string | undefined) {
    if (!token) return;
    await this.database.refreshSession.updateMany({
      where: { tokenHash: createHash('sha256').update(token).digest('hex'), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async deleteAccount(userId: string) {
    await this.database.user.update({
      where: { id: userId },
      data: {
        status: 'DELETED',
        deletedAt: new Date(),
        email: `deleted-${userId}@invalid.local`,
        displayName: 'Deleted Player',
        passwordHash: null,
        searchVisible: false,
      },
    });
    await this.database.refreshSession.deleteMany({ where: { userId } });
  }

  publicUser(user: {
    id: string;
    email: string;
    username: string;
    displayName: string;
    role: UserRole;
    locale: string;
  }) {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      locale: user.locale,
    };
  }
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly database: DatabaseService,
  ) {}

  private metadata(request: AuthenticatedRequest) {
    return { ip: request.ip, userAgent: request.header('user-agent') };
  }

  private writeRefreshCookie(response: Response, token: string) {
    response.cookie('tugla_refresh', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/api/auth',
      maxAge: 30 * 24 * 60 * 60 * 1_000,
    });
  }

  @Public()
  @Post('register')
  async register(
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.register(body, this.metadata(request));
    this.writeRefreshCookie(response, result.refreshToken);
    return { user: result.user, accessToken: result.accessToken, expiresIn: result.expiresIn };
  }

  @Public()
  @Post('login')
  async login(
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.login(body, this.metadata(request));
    this.writeRefreshCookie(response, result.refreshToken);
    return { user: result.user, accessToken: result.accessToken, expiresIn: result.expiresIn };
  }

  @Public()
  @Post('oauth')
  async oauth(
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.oauth(body, this.metadata(request));
    this.writeRefreshCookie(response, result.refreshToken);
    return { user: result.user, accessToken: result.accessToken, expiresIn: result.expiresIn };
  }

  @Public()
  @Post('refresh')
  async refresh(
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const parsed = refreshSchema.parse(body);
    const result = await this.auth.refresh(
      request.cookies?.tugla_refresh ?? parsed.refreshToken,
      this.metadata(request),
    );
    this.writeRefreshCookie(response, result.refreshToken);
    return { user: result.user, accessToken: result.accessToken, expiresIn: result.expiresIn };
  }

  @Public()
  @Post('logout')
  async logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.auth.logout(request.cookies?.tugla_refresh);
    response.clearCookie('tugla_refresh', { path: '/api/auth' });
    return { ok: true };
  }

  @UseGuards(AccessGuard)
  @Get('me')
  async me(@Req() request: AuthenticatedRequest) {
    const user = await this.database.user.findUniqueOrThrow({
      where: { id: request.user.sub },
      include: { progress: true, balances: true },
    });
    return {
      ...this.auth.publicUser(user),
      progress: user.progress,
      balances: user.balances,
    };
  }

  @UseGuards(AccessGuard)
  @Delete('me')
  async deleteMe(@Req() request: AuthenticatedRequest) {
    await this.auth.deleteAccount(request.user.sub);
    return { ok: true };
  }
}
