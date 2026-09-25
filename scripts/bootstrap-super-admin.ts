/**
 * Creates the FIRST Super Admin account. This is the only code path that
 * ever sets role='SUPER_ADMIN' outside of an already-authenticated super
 * admin using the admin UI — there is no signup-form path to this role,
 * and no RLS policy lets a client self-promote (see
 * supabase/migrations/0002_auth_helpers.sql).
 *
 * Run once, out-of-band, before go-live:
 *   npm run bootstrap:admin -- --email you@department.gov --password '...' --name "Your Name"
 *
 * Refuses to run if a SUPER_ADMIN already exists.
 */
import { createClient } from "@supabase/supabase-js";

process.loadEnvFile?.(".env.local");

function parseArgs() {
  const args = process.argv.slice(2);
  const out: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      out[args[i].slice(2)] = args[i + 1];
      i++;
    }
  }
  return out;
}

async function main() {
  const { email, password, name } = parseArgs();

  if (!email || !password || !name) {
    console.error(
      'Usage: npm run bootstrap:admin -- --email you@department.gov --password "..." --name "Your Name"',
    );
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local",
    );
    process.exit(1);
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Idempotent safety: refuse if a SUPER_ADMIN already exists.
  const { data: existing, error: existingError } = await admin
    .from("users")
    .select("id")
    .eq("role", "SUPER_ADMIN")
    .limit(1);

  if (existingError) {
    console.error("Failed to check for an existing Super Admin:", existingError.message);
    process.exit(1);
  }
  if (existing && existing.length > 0) {
    console.error(
      "A Super Admin already exists. Refusing to run again. " +
        "Promote additional admins from the admin UI instead.",
    );
    process.exit(1);
  }

  // 2. Create the auth.users row. The handle_new_auth_user trigger fires
  // and creates a normal PENDING public.users row — same as any signup.
  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name },
    });

  if (createError || !created.user) {
    console.error("Failed to create the auth user:", createError?.message);
    process.exit(1);
  }

  const userId = created.user.id;

  // 3. Promote to SUPER_ADMIN/APPROVED. Only possible here because this
  // client uses the service-role key, which bypasses RLS entirely — no
  // client-facing path can do this (see users_update_admin policy).
  const { error: promoteError } = await admin
    .from("users")
    .update({ role: "SUPER_ADMIN", status: "APPROVED", approved_at: new Date().toISOString() })
    .eq("id", userId);

  if (promoteError) {
    console.error("Failed to promote to Super Admin:", promoteError.message);
    process.exit(1);
  }

  // 4. Grant every permission in the catalog.
  const { data: permissions, error: permissionsError } = await admin
    .from("permissions")
    .select("id");

  if (permissionsError) {
    console.error("Failed to load permissions catalog:", permissionsError.message);
    process.exit(1);
  }

  if (permissions && permissions.length > 0) {
    const { error: grantError } = await admin.from("user_permissions").insert(
      permissions.map((p) => ({
        user_id: userId,
        permission_id: p.id,
        granted_by: userId,
      })),
    );
    if (grantError) {
      console.error("Failed to grant permissions:", grantError.message);
      process.exit(1);
    }
  }

  console.log(`Super Admin created: ${email} (${userId})`);
}

main();
