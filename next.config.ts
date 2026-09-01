import type { NextConfig } from "next";

// FR36 (Story 4.6, reprise de session interrompue) depends on this: under
// cacheComponents, a Server Component is dynamic (re-executed every
// request) by default, and only becomes cached if a function it calls opts
// in with "use cache". No file in this project uses that directive today —
// that absence is what guarantees a reopened session link always reflects
// the real, current database state, no matter how much time has passed.
// Adding "use cache" to any session-reading route (especially
// /facilitate/[code], which has no other reason to stay dynamic) would
// silently break that guarantee.
const nextConfig: NextConfig = {
  cacheComponents: true,
};

export default nextConfig;
