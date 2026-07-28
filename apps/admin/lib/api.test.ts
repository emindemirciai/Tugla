import { describe, expect, it } from 'vitest';
import { ApiError, STAFF_ROLES } from './api';

describe('admin access', () => {
  it('keeps players out of the staff role list', () => {
    expect(STAFF_ROLES).not.toContain('PLAYER');
    expect(STAFF_ROLES).toContain('SUPER_ADMIN');
  });

  it('carries HTTP status on API errors', () => {
    const error = new ApiError(403, 'Forbidden');
    expect(error.status).toBe(403);
    expect(error.message).toBe('Forbidden');
  });
});
