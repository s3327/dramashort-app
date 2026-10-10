/**
 * Environment variable validation helper.
 * Validates required Supabase URLs and keys, ensuring placeholders do not ship to production.
 */

const PLACEHOLDER_URL_PATTERNS = [
  "placeholder.supabase.co",
  "your-content-project.supabase.co",
  "your-user-project.supabase.co",
];

const PLACEHOLDER_KEY_PATTERNS = [
  "placeholder-anon-key",
  "placeholder-service-role-key",
  "your-content-anon-key",
  "your-user-anon-key",
  "your-content-service-role-key",
  "your-user-service-role-key",
  "your-webhook-signing-secret",
  "your-cron-secret-token",
  "your-playback-signing-secret",
  "your-preview-signing-secret",
];

export function isPlaceholderUrl(url) {
  if (!url || typeof url !== "string") return true;
  const trimmed = url.trim().toLowerCase();
  return PLACEHOLDER_URL_PATTERNS.some((pattern) => trimmed.includes(pattern));
}

export function isPlaceholderKey(key) {
  if (!key || typeof key !== "string") return true;
  const trimmed = key.trim().toLowerCase();
  return PLACEHOLDER_KEY_PATTERNS.some((pattern) => trimmed.includes(pattern));
}

export function isValidHttpUrl(urlString) {
  if (!urlString || typeof urlString !== "string") return false;
  try {
    const parsed = new URL(urlString);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Validates application environment variables.
 *
 * @param {Record<string, string | undefined>} [env] - Environment dictionary (defaults to process.env)
 * @param {{ throws?: boolean; isProduction?: boolean }} [options]
 * @returns {{ valid: boolean; errors: string[] }}
 */
export function validateEnvironment(env = process.env, options = {}) {
  const isProduction =
    options.isProduction !== undefined
      ? options.isProduction
      : env.NODE_ENV === "production";
  const shouldThrow = options.throws !== undefined ? options.throws : isProduction;

  const errors = [];

  // Detect unified single-project topology vs dual-project configuration
  const isUnifiedEnv = Boolean(
    (env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
    env.SUPABASE_DATABASE_TOPOLOGY === "unified" ||
    env.NEXT_PUBLIC_SUPABASE_TOPOLOGY === "unified"
  );

  // Required Public Supabase Variables
  const requiredPublicVars = isUnifiedEnv && !env.NEXT_PUBLIC_CONTENT_SUPABASE_URL
    ? [
        { name: "NEXT_PUBLIC_SUPABASE_URL", type: "url" },
        { name: "NEXT_PUBLIC_SUPABASE_ANON_KEY", type: "key" },
      ]
    : [
        { name: "NEXT_PUBLIC_CONTENT_SUPABASE_URL", type: "url" },
        { name: "NEXT_PUBLIC_CONTENT_SUPABASE_ANON_KEY", type: "key" },
        { name: "NEXT_PUBLIC_USER_SUPABASE_URL", type: "url" },
        { name: "NEXT_PUBLIC_USER_SUPABASE_ANON_KEY", type: "key" },
      ];

  for (const { name, type } of requiredPublicVars) {
    const val = env[name];
    if (!val || val.trim() === "") {
      errors.push(`Missing required environment variable: ${name}`);
      continue;
    }

    if (type === "url") {
      if (!isValidHttpUrl(val)) {
        errors.push(`Invalid URL for ${name}: "${val}"`);
      } else if (isPlaceholderUrl(val)) {
        errors.push(`Placeholder URL detected for ${name}: "${val}"`);
      }
    } else if (type === "key") {
      if (isPlaceholderKey(val)) {
        errors.push(`Placeholder key detected for ${name}`);
      }
    }
  }

  // Check optional server-side service role keys if provided
  const serviceRoleVars = [
    "CONTENT_SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_CONTENT_SERVICE_ROLE_KEY",
    "USER_SUPABASE_SERVICE_ROLE_KEY",
  ];

  for (const name of serviceRoleVars) {
    const val = env[name];
    if (val && isPlaceholderKey(val)) {
      errors.push(`Placeholder service role key detected for ${name}`);
    }
  }

  // Security Hardening: In production, validate critical payment, webhook, and cron secrets
  if (isProduction) {
    if (env.ENABLE_SIMULATED_CHECKOUT === "true") {
      errors.push("ENABLE_SIMULATED_CHECKOUT cannot be 'true' in production.");
    }

    const requiredProductionSecrets = [
      { name: "PAYMENT_WEBHOOK_SECRET", label: "Payment webhook signing secret" },
      { name: "CRON_SECRET", label: "Cron invocation secret" },
    ];

    for (const { name, label } of requiredProductionSecrets) {
      const val = env[name];
      if (!val || val.trim() === "") {
        errors.push(`Missing required production environment variable: ${name} (${label})`);
      } else if (isPlaceholderKey(val)) {
        errors.push(`Placeholder secret detected for ${name}`);
      }
    }

    // Optional signing secrets have no built-in default, so a placeholder must not ship
    for (const name of ["PLAYBACK_SIGNING_SECRET", "PREVIEW_SECRET"]) {
      const val = env[name];
      if (val && val.trim() !== "" && isPlaceholderKey(val)) {
        errors.push(`Placeholder secret detected for ${name}`);
      }
    }

    // Signed playback cannot be enforced without a key to sign with
    if (
      env.REQUIRE_SIGNED_PLAYBACK === "true" &&
      (!env.PLAYBACK_SIGNING_SECRET || env.PLAYBACK_SIGNING_SECRET.trim() === "")
    ) {
      errors.push("REQUIRE_SIGNED_PLAYBACK is 'true' but PLAYBACK_SIGNING_SECRET is not set.");
    }
  }

  const valid = errors.length === 0;

  if (!valid && shouldThrow) {
    const msg = `[Environment Error] Failed environment variable validation:\n- ${errors.join(
      "\n- "
    )}`;
    throw new Error(msg);
  }

  return { valid, errors };
}
