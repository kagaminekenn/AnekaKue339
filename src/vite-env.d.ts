declare module '*.css';

declare interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
}

declare interface ImportMeta {
  readonly env: ImportMetaEnv;
}
declare module '*.png';
declare module '*.svg';
declare module '*.jpg';
declare module '*.jpeg';