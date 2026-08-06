export class StorageConfigurationError extends Error {
  constructor(message = 'Supabase Storage requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.') { super(message); this.name = 'StorageConfigurationError'; }
}
