/* Minimal typing for the claude.ai artifact runtime (window.claude).
   Present only when the page runs as a published artifact with capabilities. */
export interface ClaudeError extends Error {
  code?: string;
}
export interface ClaudeSnapshot<T> {
  exists: boolean;
  data(): T | undefined;
}
export interface ClaudeDocRef<T> {
  set(value: T): Promise<void>;
  get(): Promise<ClaudeSnapshot<T>>;
  onSnapshot(next: (snap: ClaudeSnapshot<T>) => void, error?: (e: ClaudeError) => void): () => void;
}
export interface ClaudeDb {
  doc<T = unknown>(path: string): ClaudeDocRef<T>;
}
export interface ClaudeUser {
  id(): Promise<string | null>;
}
export interface ClaudeSampleOptions {
  modelTier?: 'quick' | 'default';
  images?: File | File[];
}
export interface ClaudeSample {
  json<T = unknown>(prompt: string, options?: ClaudeSampleOptions): Promise<T>;
  limits(): Promise<{ images?: boolean } | null>;
}
export interface ClaudeRuntime {
  use(name: 'db'): Promise<ClaudeDb>;
  use(name: 'user'): Promise<ClaudeUser>;
  use(name: 'sample'): Promise<ClaudeSample>;
  use(name: string): Promise<unknown>;
}
declare global {
  interface Window {
    claude?: ClaudeRuntime;
  }
}
