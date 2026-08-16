import { createHash, randomBytes, randomInt } from 'node:crypto';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Injectable,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { TooManyRequestsException } from '../services/errors';
import { ApiTags } from '@nestjs/swagger';
import { AuthProvider, type UserRole, UserStatus, type User } from '@tugla/database';
import {
  changePasswordSchema,
  confirmPasswordResetSchema,
  confirmVerificationSchema,
  VERIFICATION_CODE_LENGTH,
  cookieNames,
  linkProviderSchema,
  loginSchema,
  oauthSchema,
  registerSchema,
  requestEmailVerificationSchema,
  requestPasswordResetSchema,
  updateProfileSchema,
} from '@tugla/shared';
import bcrypt from 'bcrypt';
import type { Response } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { z } from 'zod';
import { env, providerStatus } from '../config/env';
import {
  AuditService,
  DatabaseService,
  JwtStrategyService,
  Public,
  RedisService,
  type AccessClaims,
  type AuthenticatedRequest,
} from '../services/core';
import { MailService } from '../services/mail';

const refreshSchema = z.object({ refreshToken: z.string().min(20).max(400).optional() });

const googleKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const appleKeys = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
// A short code needs a short life; players can always request a new one.
const VERIFY_CODE_TTL_MS = 30 * 60 * 1000;
const MAX_VERIFICATION_ATTEMPTS = 5;
const RESET_TTL_MS = 60 * 60 * 1000;

interface RequestMeta {
  ip?: string;
  userAgent?: string;
  deviceName?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly database: DatabaseService,
    private readonly jwt: JwtStrategyService,
    private readonly mail: MailService,
    private readonly redis: RedisService,
    private readonly audit: AuditService,
  ) {}

  private get db() {
    return this.database.client;
  }

  /**
   * Per-identity throttling for credential endpoints.
   * The global throttler protects the process; this protects individual accounts
   * from being brute-forced from many source addresses.
   */
  private async guardRate(bucket: string, identity: string, limit: number, windowSeconds: number) {
    const count = await this.redis.increment(`rate:${bucket}:${identity}`, windowSeconds);
    const effectiveLimit = limit * env().AUTH_RATE_LIMIT_FACTOR;
    if (count !== null && count > effectiveLimit) {
      throw new TooManyRequestsException('Too many attempts, please wait and try again');
    }
  }

  private async issueTokens(
    user: { id: string; email: string; role: UserRole },
    meta: RequestMeta,
  ) {
    const refreshToken = randomBytes(48).toString('base64url');
    const session = await this.db.refreshSession.create({
      data: {
        userId: user.id,
        tokenHash: createHash('sha256').update(refreshToken).digest('hex'),
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
        deviceName: meta.deviceName,
        expiresAt: new Date(Date.now() + env().REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000),
      },
    });
    const claims: AccessClaims = {
      sub: user.id,
      email: user.email,
      role: user.role,
      type: 'access',
      sid: session.id,
    };
    return { accessToken: await this.jwt.sign(claims), refreshToken, expiresIn: 900 };
  }

  /**
   * Six-digit verification code.
   *
   * Stored the same way as a link token — as a salted hash — but scoped to the
   * user so a short code cannot be guessed globally. Brute force is bounded on
   * three sides: a 30 minute lifetime, a per-address attempt limit, and the
   * token being burned after too many wrong tries (the player simply asks for a
   * new one).
   */
  private async createVerificationCode(userId: string) {
    const code = String(randomInt(0, 10 ** VERIFICATION_CODE_LENGTH)).padStart(
      VERIFICATION_CODE_LENGTH,
      '0',
    );
    await this.db.actionToken.updateMany({
      where: { userId, type: 'EMAIL_VERIFY', usedAt: null },
      data: { usedAt: new Date() },
    });
    await this.db.actionToken.create({
      data: {
        userId,
        type: 'EMAIL_VERIFY',
        tokenHash: this.hashVerificationCode(userId, code),
        expiresAt: new Date(Date.now() + VERIFY_CODE_TTL_MS),
      },
    });
    return code;
  }

  private hashVerificationCode(userId: string, code: string) {
    return createHash('sha256').update(`${userId}:${code}`).digest('hex');
  }

  private async createActionToken(userId: string, type: 'EMAIL_VERIFY' | 'PASSWORD_RESET') {
    const token = randomBytes(32).toString('base64url');
    await this.db.actionToken.updateMany({
      where: { userId, type, usedAt: null },
      data: { usedAt: new Date() },
    });
    await this.db.actionToken.create({
      data: {
        userId,
        type,
        tokenHash: createHash('sha256').update(token).digest('hex'),
        expiresAt: new Date(Date.now() + (type === 'EMAIL_VERIFY' ? VERIFY_TTL_MS : RESET_TTL_MS)),
      },
    });
    return token;
  }

  private async consumeActionToken(token: string, type: 'EMAIL_VERIFY' | 'PASSWORD_RESET') {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const record = await this.db.actionToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!record || record.type !== type || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('This link is invalid or has expired');
    }
    await this.db.actionToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });
    return record.user;
  }

  private uniqueUsername(displayName: string) {
    const base = displayName
      .normalize('NFKD')
      .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase()
      .slice(0, 22);
    return `${base || 'player'}-${randomBytes(3).toString('hex')}`;
  }

  async register(input: unknown, meta: RequestMeta) {
    const data = registerSchema.parse(input);
    await this.guardRate('register', meta.ip ?? 'unknown', 10, 3600);
    const existing = await this.db.user.findUnique({ where: { email: data.email } });
    if (existing) throw new BadRequestException('Email already registered');

    const passwordHash = await bcrypt.hash(data.password, 12);
    const user = await this.db.user.create({
      data: {
        email: data.email,
        username: this.uniqueUsername(data.displayName),
        displayName: data.displayName,
        passwordHash,
        locale: data.locale,
        marketingConsent: data.marketingConsent,
        acceptedTermsAt: new Date(),
        accounts: { create: { provider: AuthProvider.PASSWORD, providerAccountId: data.email } },
        progress: { create: {} },
        balances: {
          create: [
            { currency: 'CREDITS', amount: 0 },
            { currency: 'CRYSTALS', amount: 0 },
          ],
        },
      },
    });

    const code = await this.createVerificationCode(user.id);
    const delivery = await this.mail.sendVerification(
      user.email,
      code,
      user.locale === 'tr' ? 'tr' : 'en',
    );
    return {
      user: this.publicUser(user),
      ...(await this.issueTokens(user, meta)),
      verificationEmailSent: delivery.delivered,
    };
  }

  async login(input: unknown, meta: RequestMeta) {
    const data = loginSchema.parse(input);
    await this.guardRate('login', data.email, 10, 900);
    const user = await this.db.user.findUnique({ where: { email: data.email } });
    // Constant-ish work regardless of account existence to avoid user enumeration.
    const hash =
      user?.passwordHash ?? '$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv';
    const matches = await bcrypt.compare(data.password, hash);
    if (!user || !user.passwordHash || !matches)
      throw new UnauthorizedException('Invalid credentials');
    if (user.status === UserStatus.DELETED) throw new UnauthorizedException('Account unavailable');
    if (
      user.status === UserStatus.SUSPENDED &&
      (!user.bannedUntil || user.bannedUntil > new Date())
    ) {
      throw new ForbiddenException(
        user.banReason ? `Account suspended: ${user.banReason}` : 'Account is suspended',
      );
    }
    return {
      user: this.publicUser(user),
      ...(await this.issueTokens(user, {
        ...meta,
        deviceName: data.deviceName ?? meta.deviceName,
      })),
    };
  }

  /**
   * Rotates the refresh token. Reusing an already-rotated token revokes every
   * session for that user: that pattern means the token leaked.
   */
  async refresh(token: string | undefined, meta: RequestMeta) {
    if (!token) throw new UnauthorizedException('Refresh token missing');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const session = await this.db.refreshSession.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!session) throw new UnauthorizedException('Refresh token invalid');
    if (session.revokedAt) {
      await this.db.refreshSession.updateMany({
        where: { userId: session.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Refresh token reuse detected; all sessions revoked');
    }
    if (session.expiresAt < new Date()) throw new UnauthorizedException('Refresh token expired');
    if (session.user.status !== UserStatus.ACTIVE)
      throw new UnauthorizedException('Account unavailable');

    await this.db.refreshSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });
    return {
      user: this.publicUser(session.user),
      ...(await this.issueTokens(session.user, {
        ...meta,
        deviceName: session.deviceName ?? undefined,
      })),
    };
  }

  private async verifyIdentityToken(provider: 'google' | 'apple', identityToken: string) {
    const config = env();
    if (provider === 'google') {
      if (!config.GOOGLE_CLIENT_ID)
        throw new BadRequestException('Google sign-in is not configured');
      const verified = await jwtVerify(identityToken, googleKeys, {
        issuer: ['https://accounts.google.com', 'accounts.google.com'],
        audience: config.GOOGLE_CLIENT_ID,
      });
      return {
        subject: String(verified.payload.sub ?? ''),
        email: String(verified.payload.email ?? '').toLowerCase(),
        emailVerified: verified.payload.email_verified === true,
        // Google supplies a profile picture; Apple does not.
        picture: typeof verified.payload.picture === 'string' ? verified.payload.picture : null,
      };
    }
    if (!config.APPLE_CLIENT_ID) throw new BadRequestException('Apple sign-in is not configured');
    const verified = await jwtVerify(identityToken, appleKeys, {
      issuer: 'https://appleid.apple.com',
      audience: config.APPLE_CLIENT_ID,
    });
    return {
      subject: String(verified.payload.sub ?? ''),
      email: String(verified.payload.email ?? '').toLowerCase(),
      emailVerified:
        verified.payload.email_verified === true || verified.payload.email_verified === 'true',
      picture: null,
    };
  }

  /**
   * Federated sign-in.
   *
   * Account merging happens here: if the verified provider email already exists
   * as a local account, the provider is linked to it instead of creating a
   * duplicate player.
   */
  async oauth(input: unknown, meta: RequestMeta) {
    const data = oauthSchema.parse(input);
    const identity = await this.verifyIdentityToken(data.provider, data.identityToken);
    if (!identity.subject)
      throw new UnauthorizedException('Identity provider response is incomplete');

    const provider = data.provider === 'google' ? AuthProvider.GOOGLE : AuthProvider.APPLE;
    const account = await this.db.authAccount.findUnique({
      where: { provider_providerAccountId: { provider, providerAccountId: identity.subject } },
      include: { user: true },
    });

    let user: User | null = account?.user ?? null;
    let merged = false;

    if (!user) {
      if (!identity.email)
        throw new UnauthorizedException('Provider did not supply an email address');
      const existing = await this.db.user.findUnique({ where: { email: identity.email } });
      if (existing) {
        if (existing.status === UserStatus.DELETED)
          throw new UnauthorizedException('Account unavailable');
        await this.db.authAccount.create({
          data: { userId: existing.id, provider, providerAccountId: identity.subject },
        });
        user = existing;
        merged = true;
      } else {
        user = await this.db.user.create({
          data: {
            email: identity.email,
            username: this.uniqueUsername(
              data.displayName ?? identity.email.split('@')[0] ?? 'player',
            ),
            displayName: data.displayName ?? identity.email.split('@')[0] ?? 'Player',
            emailVerifiedAt: identity.emailVerified ? new Date() : null,
            providerAvatarUrl: identity.picture,
            acceptedTermsAt: new Date(),
            accounts: { create: { provider, providerAccountId: identity.subject } },
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

    if (
      user.status === UserStatus.SUSPENDED &&
      (!user.bannedUntil || user.bannedUntil > new Date())
    ) {
      throw new ForbiddenException('Account is suspended');
    }

    // Refresh the provider's picture, never the player's own. Writing to
    // avatarUrl here would undo a picture the player deliberately chose, on
    // every single sign-in.
    if (identity.picture && identity.picture !== user.providerAvatarUrl) {
      user = await this.db.user.update({
        where: { id: user.id },
        data: { providerAvatarUrl: identity.picture },
      });
    }

    return { user: this.publicUser(user), merged, ...(await this.issueTokens(user, meta)) };
  }

  /** Links an extra provider to the signed-in account (account merge, explicit). */
  async linkProvider(userId: string, input: unknown) {
    const data = linkProviderSchema.parse(input);
    const identity = await this.verifyIdentityToken(data.provider, data.identityToken);
    const provider = data.provider === 'google' ? AuthProvider.GOOGLE : AuthProvider.APPLE;
    const existing = await this.db.authAccount.findUnique({
      where: { provider_providerAccountId: { provider, providerAccountId: identity.subject } },
    });
    if (existing && existing.userId !== userId) {
      throw new BadRequestException('This provider account is already linked to another player');
    }
    if (!existing) {
      await this.db.authAccount.create({
        data: { userId, provider, providerAccountId: identity.subject },
      });
    }
    return this.listProviders(userId);
  }

  async unlinkProvider(userId: string, provider: AuthProvider) {
    const accounts = await this.db.authAccount.findMany({ where: { userId } });
    const user = await this.db.user.findUniqueOrThrow({ where: { id: userId } });
    const remaining = accounts.filter((account) => account.provider !== provider);
    if (!remaining.length && !user.passwordHash) {
      throw new BadRequestException('Set a password before removing your last sign-in method');
    }
    await this.db.authAccount.deleteMany({ where: { userId, provider } });
    return this.listProviders(userId);
  }

  async listProviders(userId: string) {
    const accounts = await this.db.authAccount.findMany({
      where: { userId },
      select: { provider: true, createdAt: true },
    });
    return { items: accounts, available: providerStatus() };
  }

  async requestEmailVerification(input: unknown) {
    const data = requestEmailVerificationSchema.parse(input);
    await this.guardRate('verify', data.email, 5, 3600);
    const user = await this.db.user.findUnique({ where: { email: data.email } });
    if (!user || user.emailVerifiedAt) return { sent: this.mail.enabled };
    const code = await this.createVerificationCode(user.id);
    const delivery = await this.mail.sendVerification(
      user.email,
      code,
      user.locale === 'tr' ? 'tr' : 'en',
    );
    return { sent: delivery.delivered };
  }

  async confirmEmail(input: unknown) {
    const data = confirmVerificationSchema.parse(input);
    const user =
      'token' in data
        ? await this.consumeActionToken(data.token, 'EMAIL_VERIFY')
        : await this.consumeVerificationCode(data.email, data.code);
    await this.db.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
    return { verified: true };
  }

  /**
   * Redeems a six-digit code. Wrong guesses are counted per address; once the
   * budget is spent the outstanding code is burned so an attacker cannot keep
   * trying against the same credential, and the player asks for a new one.
   */
  private async consumeVerificationCode(email: string, code: string) {
    await this.guardRate('verify-code', email, 10, 900);
    const user = await this.db.user.findUnique({ where: { email } });
    if (!user || user.status === UserStatus.DELETED)
      throw new BadRequestException('Verification code is invalid or expired');

    const token = await this.db.actionToken.findFirst({
      where: {
        userId: user.id,
        type: 'EMAIL_VERIFY',
        usedAt: null,
        expiresAt: { gt: new Date() },
        tokenHash: this.hashVerificationCode(user.id, code),
      },
    });

    if (!token) {
      const attempts = await this.redis.increment(`verify-attempts:${user.id}`, 1800);
      if (attempts !== null && attempts >= MAX_VERIFICATION_ATTEMPTS) {
        await this.db.actionToken.updateMany({
          where: { userId: user.id, type: 'EMAIL_VERIFY', usedAt: null },
          data: { usedAt: new Date() },
        });
      }
      throw new BadRequestException('Verification code is invalid or expired');
    }

    await this.db.actionToken.update({ where: { id: token.id }, data: { usedAt: new Date() } });
    return user;
  }

  async requestPasswordReset(input: unknown) {
    const data = requestPasswordResetSchema.parse(input);
    await this.guardRate('reset', data.email, 5, 3600);
    const user = await this.db.user.findUnique({ where: { email: data.email } });
    // Always report the same result so the endpoint cannot enumerate accounts.
    if (!user || user.status === UserStatus.DELETED) return { sent: this.mail.enabled };
    const token = await this.createActionToken(user.id, 'PASSWORD_RESET');
    const delivery = await this.mail.sendPasswordReset(
      user.email,
      token,
      user.locale === 'tr' ? 'tr' : 'en',
    );
    return { sent: delivery.delivered };
  }

  async confirmPasswordReset(input: unknown) {
    const data = confirmPasswordResetSchema.parse(input);
    const user = await this.consumeActionToken(data.token, 'PASSWORD_RESET');
    const passwordHash = await bcrypt.hash(data.password, 12);
    await this.db.$transaction([
      this.db.user.update({ where: { id: user.id }, data: { passwordHash } }),
      this.db.refreshSession.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    return { reset: true };
  }

  async changePassword(userId: string, input: unknown, currentSessionId: string) {
    const data = changePasswordSchema.parse(input);
    const user = await this.db.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.passwordHash) {
      const passwordHash = await bcrypt.hash(data.newPassword, 12);
      await this.db.user.update({ where: { id: userId }, data: { passwordHash } });
      return { changed: true };
    }
    if (!(await bcrypt.compare(data.currentPassword, user.passwordHash))) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    const passwordHash = await bcrypt.hash(data.newPassword, 12);
    await this.db.$transaction([
      this.db.user.update({ where: { id: userId }, data: { passwordHash } }),
      this.db.refreshSession.updateMany({
        where: { userId, revokedAt: null, id: { not: currentSessionId } },
        data: { revokedAt: new Date() },
      }),
    ]);
    return { changed: true };
  }

  async updateProfile(userId: string, input: unknown) {
    const data = updateProfileSchema.parse(input);

    // Renaming is rate limited, not forbidden: a name is how other players
    // recognise you, and swapping it daily is how impersonation works. The
    // e-mail address is deliberately absent from this schema — changing the
    // address that owns an account is a verification flow, not a profile edit.
    if (data.displayName || data.username) {
      const user = await this.db.user.findUniqueOrThrow({ where: { id: userId } });
      const lastChange = user.lastUsernameChangedAt?.getTime() ?? 0;
      if (Date.now() - lastChange < 7 * 24 * 60 * 60 * 1000 && user.lastUsernameChangedAt) {
        throw new BadRequestException('Your name can only change once every 7 days');
      }
      if (data.username && data.username !== user.username) {
        const taken = await this.db.user.findUnique({
          where: { username: data.username },
          select: { id: true },
        });
        if (taken) throw new BadRequestException('That username is already taken');
      }
    }
    const user = await this.db.user.update({
      where: { id: userId },
      data: {
        ...data,
        // An empty string means "use the provider's picture again".
        ...(data.avatarUrl !== undefined ? { avatarUrl: data.avatarUrl || null } : {}),
        ...(data.displayName || data.username ? { lastUsernameChangedAt: new Date() } : {}),
      },
    });
    return this.publicUser(user);
  }

  async sessions(userId: string, currentSessionId: string) {
    const items = await this.db.refreshSession.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        deviceName: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
        expiresAt: true,
      },
    });
    return { items: items.map((item) => ({ ...item, current: item.id === currentSessionId })) };
  }

  async revokeSession(userId: string, sessionId: string) {
    await this.db.refreshSession.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { revoked: true };
  }

  async logout(token: string | undefined) {
    if (!token) return { ok: true };
    await this.db.refreshSession.updateMany({
      where: { tokenHash: createHash('sha256').update(token).digest('hex'), revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }

  /** GDPR/KVKK-style portable export of everything tied to the account. */
  async exportData(userId: string) {
    const user = await this.db.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        progress: true,
        balances: true,
        inventory: { include: { item: true } },
        accounts: { select: { provider: true, createdAt: true } },
        devices: true,
        achievementUnlocks: { include: { achievement: { select: { key: true, name: true } } } },
        taskProgress: { include: { task: { select: { key: true, name: true } } } },
        leaderboardEntries: true,
        walletTransactions: true,
        supportTickets: true,
        notifications: true,
        authoredLevels: {
          select: { id: true, slug: true, name: true, status: true, createdAt: true },
        },
      },
    });
    const sessions = await this.db.gameSession.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 1000,
      select: {
        id: true,
        levelId: true,
        mode: true,
        status: true,
        score: true,
        durationMs: true,
        blocksDestroyed: true,
        createdAt: true,
      },
    });
    const { passwordHash: _password, twoFactorSecret: _secret, ...safeUser } = user;
    return {
      exportedAt: new Date().toISOString(),
      format: 'json',
      account: safeUser,
      gameSessions: sessions,
    };
  }

  /**
   * Deletes the account: personal data is scrubbed immediately while
   * aggregate rows the leaderboards depend on are anonymised, not orphaned.
   */
  async deleteAccount(userId: string, meta: RequestMeta) {
    const user = await this.db.user.findUniqueOrThrow({ where: { id: userId } });
    const anonymousEmail = `deleted-${userId}@invalid.local`;
    await this.db.$transaction([
      this.db.user.update({
        where: { id: userId },
        data: {
          status: UserStatus.DELETED,
          deletedAt: new Date(),
          email: anonymousEmail,
          username: `deleted-${userId.slice(0, 8)}`,
          displayName: 'Deleted Player',
          passwordHash: null,
          twoFactorSecret: null,
          searchVisible: false,
          marketingConsent: false,
        },
      }),
      this.db.refreshSession.deleteMany({ where: { userId } }),
      this.db.actionToken.deleteMany({ where: { userId } }),
      this.db.device.deleteMany({ where: { userId } }),
      this.db.authAccount.deleteMany({ where: { userId } }),
      this.db.notification.deleteMany({ where: { userId } }),
      this.db.follow.deleteMany({
        where: { OR: [{ followerId: userId }, { followingId: userId }] },
      }),
      this.db.friendship.deleteMany({
        where: { OR: [{ requesterId: userId }, { addresseeId: userId }] },
      }),
    ]);
    await this.audit.record({
      actorId: userId,
      action: 'ACCOUNT_DELETE',
      targetType: 'User',
      targetId: userId,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
    if (user.email && !user.email.startsWith('deleted-'))
      await this.mail.sendAccountDeleted(user.email, user.locale === 'tr' ? 'tr' : 'en');
    return { deleted: true };
  }

  publicUser(user: {
    id: string;
    email: string;
    username: string;
    displayName: string;
    role: UserRole;
    locale: string;
    emailVerifiedAt?: Date | null;
    searchVisible?: boolean;
    marketingConsent?: boolean;
    avatarUrl?: string | null;
    providerAvatarUrl?: string | null;
  }) {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      locale: user.locale,
      emailVerified: Boolean(user.emailVerifiedAt),
      searchVisible: user.searchVisible ?? true,
      marketingConsent: user.marketingConsent ?? false,
      // The player's own picture wins; the provider's is the fallback. Both are
      // exposed so the account screen can say where the current one came from.
      avatarUrl: user.avatarUrl ?? user.providerAvatarUrl ?? null,
      ownAvatar: Boolean(user.avatarUrl),
    };
  }
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly database: DatabaseService,
  ) {}

  private meta(request: AuthenticatedRequest): RequestMeta {
    return {
      ip: request.ip,
      userAgent: request.header('user-agent')?.slice(0, 400),
      deviceName: (request.body as { deviceName?: string } | undefined)?.deviceName,
    };
  }

  private writeRefreshCookie(response: Response, token: string) {
    response.cookie(cookieNames(env().APP_SLUG).refresh, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: env().NODE_ENV === 'production',
      path: '/api/auth',
      maxAge: env().REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
    });
  }

  private readRefreshCookie(request: AuthenticatedRequest) {
    return (request.cookies as Record<string, string> | undefined)?.[
      cookieNames(env().APP_SLUG).refresh
    ];
  }

  @Public()
  @Post('register')
  async register(
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.register(body, this.meta(request));
    this.writeRefreshCookie(response, result.refreshToken);
    return {
      user: result.user,
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
      verificationEmailSent: result.verificationEmailSent,
    };
  }

  @Public()
  @Post('login')
  async login(
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.login(body, this.meta(request));
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
    const result = await this.auth.oauth(body, this.meta(request));
    this.writeRefreshCookie(response, result.refreshToken);
    return {
      user: result.user,
      merged: result.merged,
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
    };
  }

  @Public()
  @Post('refresh')
  async refresh(
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const parsed = refreshSchema.parse(body ?? {});
    const result = await this.auth.refresh(
      this.readRefreshCookie(request) ?? parsed.refreshToken,
      this.meta(request),
    );
    this.writeRefreshCookie(response, result.refreshToken);
    return {
      user: result.user,
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
      refreshToken: this.readRefreshCookie(request) ? undefined : result.refreshToken,
    };
  }

  @Public()
  @Post('logout')
  async logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.auth.logout(this.readRefreshCookie(request));
    response.clearCookie(cookieNames(env().APP_SLUG).refresh, { path: '/api/auth' });
    return { ok: true };
  }

  @Public()
  @Post('email/verify/request')
  requestVerification(@Body() body: unknown) {
    return this.auth.requestEmailVerification(body);
  }

  @Public()
  @Post('email/verify/confirm')
  confirmVerification(@Body() body: unknown) {
    return this.auth.confirmEmail(body);
  }

  @Public()
  @Post('password/reset/request')
  requestReset(@Body() body: unknown) {
    return this.auth.requestPasswordReset(body);
  }

  @Public()
  @Post('password/reset/confirm')
  confirmReset(@Body() body: unknown) {
    return this.auth.confirmPasswordReset(body);
  }

  @Post('password/change')
  changePassword(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.auth.changePassword(request.user.sub, body, request.user.sid);
  }

  @Get('me')
  async me(@Req() request: AuthenticatedRequest) {
    const user = await this.database.client.user.findUniqueOrThrow({
      where: { id: request.user.sub },
      include: { progress: true, balances: true },
    });
    return {
      ...this.auth.publicUser(user),
      progress: user.progress,
      balances: user.balances,
    };
  }

  @Patch('me')
  updateProfile(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.auth.updateProfile(request.user.sub, body);
  }

  @Get('providers')
  providers(@Req() request: AuthenticatedRequest) {
    return this.auth.listProviders(request.user.sub);
  }

  @Post('providers/link')
  link(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.auth.linkProvider(request.user.sub, body);
  }

  @Delete('providers/:provider')
  unlink(@Req() request: AuthenticatedRequest, @Param('provider') provider: string) {
    const parsed = z.enum(['GOOGLE', 'APPLE', 'PASSWORD']).parse(provider.toUpperCase());
    return this.auth.unlinkProvider(request.user.sub, parsed as AuthProvider);
  }

  @Get('sessions')
  sessions(@Req() request: AuthenticatedRequest) {
    return this.auth.sessions(request.user.sub, request.user.sid);
  }

  @Delete('sessions/:id')
  revokeSession(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.auth.revokeSession(request.user.sub, id);
  }

  @Get('export')
  exportData(@Req() request: AuthenticatedRequest) {
    return this.auth.exportData(request.user.sub);
  }

  @Delete('me')
  deleteMe(@Req() request: AuthenticatedRequest) {
    return this.auth.deleteAccount(request.user.sub, this.meta(request));
  }
}
