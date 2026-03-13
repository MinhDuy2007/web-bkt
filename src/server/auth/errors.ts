type AuthErrorOptions = {
  code: string;
  message: string;
  statusCode: number;
};

export class AuthError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(options: AuthErrorOptions) {
    super(options.message);
    this.name = "AuthError";
    this.code = options.code;
    this.statusCode = options.statusCode;
  }
}

export function laAuthError(error: unknown): error is AuthError {
  return error instanceof AuthError;
}

