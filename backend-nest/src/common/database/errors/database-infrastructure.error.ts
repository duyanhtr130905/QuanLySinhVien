export interface DatabaseErrorDetails {
  constraint?: string;
  table?: string;
  column?: string;
  detail?: string;
}

export class DatabaseInfrastructureError extends Error {
  readonly constraint?: string;
  readonly table?: string;
  readonly column?: string;
  readonly detail?: string;

  constructor(message: string, details: DatabaseErrorDetails = {}, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
    this.constraint = details.constraint;
    this.table = details.table;
    this.column = details.column;
    this.detail = details.detail;
  }
}

export class UniqueConstraintViolationError extends DatabaseInfrastructureError {}
export class ForeignKeyViolationError extends DatabaseInfrastructureError {}
export class NotNullViolationError extends DatabaseInfrastructureError {}
export class CheckConstraintViolationError extends DatabaseInfrastructureError {}
export class DatabaseUnavailableError extends DatabaseInfrastructureError {}
