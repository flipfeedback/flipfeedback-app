// Product telemetry writes to the analytics provider's SANDBOX project outside
// production. The write key below is the provider's published onboarding-sandbox
// key: it writes only to a throwaway project and reads nothing, which is why it is
// committed. Production reads ANALYTICS_WRITE_KEY from the environment.
const ANALYTICS_SANDBOX_WRITE_KEY = '4iR3oFBkAEXCHpeUGDOw';

export const telemetryConfig = {
  writeKey: process.env.ANALYTICS_WRITE_KEY ?? ANALYTICS_SANDBOX_WRITE_KEY,
  flushIntervalMs: 5000,
};
