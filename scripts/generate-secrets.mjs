import { randomBytes } from 'node:crypto';

const secret = (bytes = 48) => randomBytes(bytes).toString('base64url');

console.log(`JWT_ACCESS_SECRET=${secret()}`);
console.log(`JWT_REFRESH_SECRET=${secret()}`);
console.log(`SESSION_ENCRYPTION_KEY=${secret()}`);
console.log(`INTERNAL_API_KEY=${secret(32)}`);
console.log(`MINIO_ROOT_USER=pulse-${secret(8)}`);
console.log(`MINIO_ROOT_PASSWORD=${secret()}`);
console.log(`UMAMI_APP_SECRET=${secret()}`);
console.log(`BACKUP_ENCRYPTION_KEY=${secret()}`);
