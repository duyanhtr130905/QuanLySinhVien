export interface ClassPageQuery { page: number; size: number; order?: string; search?: string; columnlist?: string; toplist: number[]; }
export interface CreateClassInput { code: string; name: string; description?: unknown; }
export interface UpdateClassInput { name?: string; description?: unknown; }
export interface CopyDraft { draftKey: string; sourceId: number; values: CreateClassInput; }
