import { createClient } from "@supabase/supabase-js";
const env = import.meta.env;
export const configured = Boolean(
  env.VITE_SUPABASE_URL && env.VITE_SUPABASE_PUBLISHABLE_KEY,
);
export const cloud = configured
  ? createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        storage: localStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null;
export type Payload = {
  lot: string;
  date: string;
  process: string;
  quantity: string;
  note: string;
};
export type RecordRow = {
  id: string;
  owner_id: string;
  payload: Payload;
  revision: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};
export type Archive = {
  id: string;
  created_at: string;
  confirmed_at: string | null;
  snapshot: {
    schema_version: number;
    records: RecordRow[];
    history: unknown[];
  };
};
export function requireCloud() {
  if (!cloud) throw new Error("Supabase未設定");
  return cloud;
}
export async function rpc(name: string, args: Record<string, unknown> = {}) {
  const { data, error } = await requireCloud()
    .rpc(name, args)
    .abortSignal(AbortSignal.timeout(15000));
  if (error) throw new Error(error.message);
  return data;
}
