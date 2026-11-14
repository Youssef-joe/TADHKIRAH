import { Logger } from '@nestjs/common';
import * as webPush from 'web-push';
import type { Env } from '../config/env.js';

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** 'gone' means the subscription no longer exists (404/410) and should be disabled. */
export type PushResult = 'ok' | 'gone' | 'error';

/** Port for push delivery: Web Push (VAPID) now, FCM/APNs adapters in Phase 4. */
export interface PushChannel {
  readonly enabled: boolean;
  send(
    target: PushTarget,
    payload: object,
    opts: { ttlSeconds: number; topic: string },
  ): Promise<PushResult>;
}

export const PUSH_CHANNEL = Symbol('PUSH_CHANNEL');

class WebPushChannel implements PushChannel {
  readonly enabled = true;
  private readonly logger = new Logger('WebPushChannel');
  constructor(env: Env) {
    webPush.setVapidDetails(
      // Push services require an https: or mailto: contact; local http setups get a placeholder.
      env.VAPID_SUBJECT ??
        (env.PUBLIC_WEB_URL.startsWith('https:') ? env.PUBLIC_WEB_URL : 'mailto:admin@localhost'),
      env.VAPID_PUBLIC_KEY!,
      env.VAPID_PRIVATE_KEY!,
    );
  }
  async send(
    target: PushTarget,
    payload: object,
    opts: { ttlSeconds: number; topic: string },
  ): Promise<PushResult> {
    try {
      await webPush.sendNotification(
        { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
        JSON.stringify(payload),
        { TTL: opts.ttlSeconds, topic: opts.topic, urgency: 'normal' },
      );
      return 'ok';
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) return 'gone';
      this.logger.warn(`push failed (${status ?? 'network'})`);
      return 'error';
    }
  }
}

/** Without VAPID keys: inbox-only delivery. */
class DisabledChannel implements PushChannel {
  readonly enabled = false;
  async send(): Promise<PushResult> {
    return 'error';
  }
}

/** Tests: records what would have been pushed. */
export class MemoryPushChannel implements PushChannel {
  readonly enabled = true;
  readonly sent: { target: PushTarget; payload: Record<string, unknown>; topic: string }[] = [];
  goneEndpoints = new Set<string>();
  async send(target: PushTarget, payload: object, opts: { topic: string }): Promise<PushResult> {
    if (this.goneEndpoints.has(target.endpoint)) return 'gone';
    this.sent.push({ target, payload: payload as Record<string, unknown>, topic: opts.topic });
    return 'ok';
  }
}

export function createPushChannel(env: Env): PushChannel {
  if (env.PUSH_TRANSPORT === 'memory') return new MemoryPushChannel();
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return new DisabledChannel();
  return new WebPushChannel(env);
}
