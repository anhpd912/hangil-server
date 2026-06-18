// Result pattern dùng chung — thay throw/catch lan tràn
export type Result<T> = { ok: true; data: T } | { ok: false; error: string };
