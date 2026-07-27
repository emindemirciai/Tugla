import { HttpException, HttpStatus } from '@nestjs/common';

/** 429 with a consistent shape; Nest has no built-in exception for this status. */
export class TooManyRequestsException extends HttpException {
  constructor(message = 'Too many requests') {
    super({ statusCode: HttpStatus.TOO_MANY_REQUESTS, message }, HttpStatus.TOO_MANY_REQUESTS);
  }
}
