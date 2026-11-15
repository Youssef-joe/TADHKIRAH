import 'server-only';
import { headers } from 'next/headers';
import type { MeResponse } from '@tadhkirah/contracts';

const API = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';

/**
 * Server components call the API directly over the internal network, forwarding
 * the visitor's cookies. Returns null when signed out.
 */
export async function getMe(): Promise<MeResponse | null> {
  const cookie = (await headers()).get('cookie');
  if (!cookie) return null;
  const res = await fetch(`${API}/v1/me`, { headers: { cookie }, cache: 'no-store' });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`GET /v1/me failed: ${res.status}`);
  return (await res.json()) as MeResponse;
}

/** The visitor's editorial roles (ADR-003); empty when signed out or not on the team. */
export async function getEditorialRoles(): Promise<string[]> {
  const cookie = (await headers()).get('cookie');
  if (!cookie) return [];
  const res = await fetch(`${API}/v1/admin/me`, { headers: { cookie }, cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { roles: string[] }).roles;
}
