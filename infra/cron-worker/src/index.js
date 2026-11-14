/**
 * Every minute: send due reminders. Every 5 minutes: also plan upcoming ones.
 * Both endpoints are idempotent, so a retried or overlapping run is harmless.
 */
async function call(env, job) {
  const res = await fetch(`${env.API_BASE}/v1/internal/cron/${job}`, {
    headers: { authorization: `Bearer ${env.CRON_SECRET}`, 'user-agent': 'tadhkirah-cron' },
    signal: AbortSignal.timeout(55_000),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`${job} failed: ${res.status} ${body.slice(0, 200)}`);
  console.log(job, body);
}

export default {
  async scheduled(event, env, ctx) {
    const jobs = event.cron === '*/5 * * * *' ? ['plan'] : ['dispatch'];
    ctx.waitUntil(Promise.all(jobs.map((job) => call(env, job))));
  },
};
