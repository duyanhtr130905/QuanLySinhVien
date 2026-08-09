/** Application-level failure that preserves a legacy API contract without depending on Nest HTTP types. */
export class LegacyApplicationError extends Error {
  readonly legacyApplicationError = true;

  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = new.target.name;
  }
}
