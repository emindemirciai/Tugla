import { createHash } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { env } from '../config/env';

export interface StoredObject {
  key: string;
  size: number;
  provider: 'database' | 's3';
}

/**
 * Replay/blob storage with two real backends.
 *
 * `database` keeps payloads in PostgreSQL, which is the default and works with
 * no external account. `s3` signs and uploads to any S3-compatible endpoint
 * (MinIO, R2, B2, AWS) using SigV4 over plain fetch, so no SDK is required.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  get provider() {
    return env().STORAGE_PROVIDER;
  }

  get available() {
    const config = env();
    if (config.STORAGE_PROVIDER === 'database') return true;
    return Boolean(config.S3_BUCKET && config.S3_ACCESS_KEY && config.S3_SECRET_KEY);
  }

  /**
   * Uploads a payload. Returns `null` when the configured backend is the
   * database, telling the caller to persist the payload inline instead.
   */
  async put(
    key: string,
    body: string | Buffer,
    contentType = 'application/json',
  ): Promise<StoredObject | null> {
    const config = env();
    if (config.STORAGE_PROVIDER !== 's3') return null;
    if (!this.available) {
      this.logger.warn('S3 storage selected but credentials are incomplete; falling back inline.');
      return null;
    }
    const endpoint = (config.S3_ENDPOINT ?? '').replace(/\/$/, '');
    const url = config.S3_FORCE_PATH_STYLE
      ? `${endpoint}/${config.S3_BUCKET}/${key}`
      : `${endpoint.replace('://', `://${config.S3_BUCKET}.`)}/${key}`;
    const response = await fetch(url, {
      method: 'PUT',
      headers: await this.signHeaders('PUT', url, body, contentType),
      body,
    });
    if (!response.ok) {
      throw new Error(`Object storage rejected the upload (${response.status})`);
    }
    return {
      key,
      size: typeof body === 'string' ? Buffer.byteLength(body) : body.byteLength,
      provider: 's3',
    };
  }

  async get(key: string): Promise<string | null> {
    const config = env();
    if (config.STORAGE_PROVIDER !== 's3' || !this.available) return null;
    const endpoint = (config.S3_ENDPOINT ?? '').replace(/\/$/, '');
    const url = config.S3_FORCE_PATH_STYLE
      ? `${endpoint}/${config.S3_BUCKET}/${key}`
      : `${endpoint.replace('://', `://${config.S3_BUCKET}.`)}/${key}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: await this.signHeaders('GET', url, '', 'application/json'),
    });
    if (!response.ok) return null;
    return response.text();
  }

  /** Minimal AWS SigV4 signer — enough for PUT/GET object operations. */
  /** Public URL of a stored object, when the bucket is served publicly. */
  publicUrl(key: string) {
    const config = env();
    const base = (config.S3_PUBLIC_URL ?? '').replace(/\/$/, '');
    return base ? `${base}/${key}` : null;
  }

  private async signHeaders(
    method: string,
    url: string,
    body: string | Buffer,
    contentType: string,
  ) {
    const config = env();
    const { createHmac } = await import('node:crypto');
    const parsed = new URL(url);
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);
    const payloadHash = createHash('sha256').update(body).digest('hex');
    const region = config.S3_REGION || 'auto';
    const service = 's3';

    const canonicalHeaders =
      `content-type:${contentType}\nhost:${parsed.host}\n` +
      `x-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
    const canonicalRequest = [
      method,
      parsed.pathname,
      parsed.searchParams.toString(),
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');

    const scope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      scope,
      createHash('sha256').update(canonicalRequest).digest('hex'),
    ].join('\n');

    const hmac = (key: Buffer | string, value: string) =>
      createHmac('sha256', key).update(value).digest();
    const signingKey = hmac(
      hmac(hmac(hmac(`AWS4${config.S3_SECRET_KEY ?? ''}`, dateStamp), region), service),
      'aws4_request',
    );
    const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');

    return {
      'content-type': contentType,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      authorization: `AWS4-HMAC-SHA256 Credential=${config.S3_ACCESS_KEY}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    };
  }
}
