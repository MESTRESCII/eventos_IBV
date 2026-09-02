import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ---------------------------------------------------------------------------
  // Cloudflare Workers (future)
  // ---------------------------------------------------------------------------
  // When deploying to Cloudflare Workers, uncomment the adapter below and run:
  //   npm install @opennextjs/cloudflare
  //
  // import { defineCloudflareConfig } from "@opennextjs/cloudflare";
  // export default defineCloudflareConfig({ nextConfig });
  //
  // Required additions to wrangler.toml:
  //   compatibility_flags = ["nodejs_compat"]
  //   compatibility_date   = "2024-09-23"
  //
  // Migration checklist:
  //   - Remove --webpack flag from dev script (Cloudflare adapter uses its own bundler)
  //   - Replace postgres.js with a Cloudflare-compatible driver (e.g. @neondatabase/serverless
  //     or Supabase HTTP API via @supabase/supabase-js)
  //   - Set DATABASE_URL and DIRECT_URL as Cloudflare secrets (wrangler secret put)
  // ---------------------------------------------------------------------------
};

export default nextConfig;
