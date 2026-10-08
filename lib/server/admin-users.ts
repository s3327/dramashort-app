import "server-only";

import { createUserServiceRoleClient } from "@/lib/supabase/user-server";
import { recordAuditLog } from "@/lib/server/audit";
import type {
  AdminManagedUser,
  AdminUserDetail,
  AdminUserRole,
  BanUserPayload,
  GetAdminUsersQuery,
  PaginatedAdminUsersResult,
  UnbanUserPayload,
} from "@/types/user-admin";
import type { User } from "@supabase/supabase-js";

interface ActorContext {
  id: string;
  email?: string | null;
  ip?: string | null;
}

/**
 * Normalizes auth provider list from Supabase User metadata.
 */
function extractSocialLogins(user: User): string[] {
  const providersSet = new Set<string>();

  const appProviders = (user.app_metadata as Record<string, unknown> | undefined)?.providers;
  if (Array.isArray(appProviders)) {
    for (const p of appProviders) {
      if (typeof p === "string" && p) providersSet.add(p);
    }
  }

  const singleProvider = (user.app_metadata as Record<string, unknown> | undefined)?.provider;
  if (typeof singleProvider === "string" && singleProvider) {
    providersSet.add(singleProvider);
  }

  if (Array.isArray(user.identities)) {
    for (const identity of user.identities) {
      if (identity.provider) {
        providersSet.add(identity.provider);
      }
    }
  }

  return Array.from(providersSet);
}

/**
 * Checks whether a user account is currently banned.
 */
function isUserBanned(
  user: User,
  profile?: { is_banned?: boolean | null; banned_until?: string | null } | null
): { isBanned: boolean; bannedUntil: string | null } {
  const now = Date.now();

  // Check auth banned_until
  const authBannedUntil = (user as unknown as { banned_until?: string | null }).banned_until;
  if (authBannedUntil) {
    const until = new Date(authBannedUntil).getTime();
    if (until > now) {
      return { isBanned: true, bannedUntil: authBannedUntil };
    }
  }

  // Check profile is_banned
  if (profile?.is_banned === true) {
    if (profile.banned_until) {
      const until = new Date(profile.banned_until).getTime();
      if (until > now) {
        return { isBanned: true, bannedUntil: profile.banned_until };
      }
    } else {
      return { isBanned: true, bannedUntil: null };
    }
  }

  return { isBanned: false, bannedUntil: null };
}

/**
 * Lists administrative users with joined profiles, filtering, search, and engagement stats.
 */
export async function getAdminUsersServer(
  query: GetAdminUsersQuery = {}
): Promise<PaginatedAdminUsersResult> {
  const client = createUserServiceRoleClient();

  const page = query.page && query.page > 0 ? query.page : 1;
  const pageSize = query.pageSize && query.pageSize > 0 ? query.pageSize : 10;
  const searchTerm = query.query?.trim().toLowerCase() || "";
  const statusFilter = query.status || "all";
  const roleFilter = query.role || "all";
  const sortBy = query.sortBy || "createdAt";
  const sortDir = query.sortDir || "desc";

  // 1. Fetch auth users
  const { data: authData, error: authError } = await client.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (authError) {
    console.error("[getAdminUsersServer] Error fetching auth users:", authError);
    throw new Error(`Failed to list auth users: ${authError.message}`);
  }

  const authUsers: User[] = authData?.users || [];

  // 2. Fetch public.profiles
  const { data: profiles, error: profilesError } = await client
    .from("profiles")
    .select("id, display_name, avatar_url, role, created_at, updated_at, is_banned, banned_until, ban_reason");

  if (profilesError) {
    console.warn("[getAdminUsersServer] Warning fetching profiles:", profilesError.message);
  }

  const profileMap = new Map<string, any>();
  if (Array.isArray(profiles)) {
    for (const p of profiles) {
      profileMap.set(p.id, p);
    }
  }

  // 3. Construct unified managed users
  const allUsers: AdminManagedUser[] = authUsers.map((u) => {
    const prof = profileMap.get(u.id);
    const { isBanned, bannedUntil } = isUserBanned(u, prof);

    const email = u.email || "";
    const emailPrefix = email ? email.split("@")[0] : "";
    const displayName =
      prof?.display_name ||
      u.user_metadata?.full_name ||
      u.user_metadata?.name ||
      emailPrefix ||
      "User";

    const resolvedRole: AdminUserRole =
      (u.app_metadata?.role as AdminUserRole) ||
      (prof?.role as AdminUserRole) ||
      "user";

    return {
      id: u.id,
      email,
      displayName,
      avatarUrl: prof?.avatar_url || u.user_metadata?.avatar_url || null,
      role: resolvedRole,
      isBanned,
      bannedUntil: bannedUntil || prof?.banned_until || null,
      banReason: prof?.ban_reason || null,
      createdAt: u.created_at || prof?.created_at || new Date().toISOString(),
      lastLoginAt: u.last_sign_in_at || null,
      socialLogins: extractSocialLogins(u),
      watchHistoryCount: 0,
      favoritesCount: 0,
    };
  });

  // 4. Apply filtering
  const filtered = allUsers.filter((u) => {
    // Search query matching email or username or id
    if (searchTerm) {
      const matchEmail = u.email.toLowerCase().includes(searchTerm);
      const matchName = u.displayName.toLowerCase().includes(searchTerm);
      const matchId = u.id.toLowerCase() === searchTerm;
      if (!matchEmail && !matchName && !matchId) {
        return false;
      }
    }

    // Status filter
    if (statusFilter === "active" && u.isBanned) return false;
    if (statusFilter === "banned" && !u.isBanned) return false;

    // Role filter
    if (roleFilter !== "all" && u.role !== roleFilter) return false;

    return true;
  });

  // 5. Apply sorting
  filtered.sort((a, b) => {
    let comparison = 0;
    if (sortBy === "createdAt") {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      comparison = aTime - bTime;
    } else if (sortBy === "lastLoginAt") {
      const aTime = a.lastLoginAt ? new Date(a.lastLoginAt).getTime() : 0;
      const bTime = b.lastLoginAt ? new Date(b.lastLoginAt).getTime() : 0;
      comparison = aTime - bTime;
    } else if (sortBy === "displayName") {
      comparison = a.displayName.localeCompare(b.displayName);
    } else if (sortBy === "email") {
      comparison = a.email.localeCompare(b.email);
    }

    return sortDir === "asc" ? comparison : -comparison;
  });

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startIndex = (page - 1) * pageSize;
  const sliced = filtered.slice(startIndex, startIndex + pageSize);

  // 6. Aggregate engagement counts for sliced page
  if (sliced.length > 0) {
    const userIds = sliced.map((u) => u.id);

    try {
      const [favRes, watchRes] = await Promise.all([
        client.from("favorites").select("user_id").in("user_id", userIds),
        client.from("watch_history").select("user_id").in("user_id", userIds),
      ]);

      const favCounts = new Map<string, number>();
      if (Array.isArray(favRes.data)) {
        for (const f of favRes.data) {
          favCounts.set(f.user_id, (favCounts.get(f.user_id) || 0) + 1);
        }
      }

      const watchCounts = new Map<string, number>();
      if (Array.isArray(watchRes.data)) {
        for (const w of watchRes.data) {
          watchCounts.set(w.user_id, (watchCounts.get(w.user_id) || 0) + 1);
        }
      }

      for (const u of sliced) {
        u.favoritesCount = favCounts.get(u.id) || 0;
        u.watchHistoryCount = watchCounts.get(u.id) || 0;
      }
    } catch (aggErr) {
      console.warn("[getAdminUsersServer] Error aggregating engagement counts:", aggErr);
    }
  }

  return {
    items: sliced,
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
    },
  };
}

/**
 * Retrieves detailed information and engagement history for a single user.
 */
export async function getAdminUserDetailServer(userId: string): Promise<AdminUserDetail | null> {
  const client = createUserServiceRoleClient();

  const { data: authData, error: authError } = await client.auth.admin.getUserById(userId);
  if (authError || !authData?.user) {
    return null;
  }
  const u = authData.user;

  const { data: profile } = await client
    .from("profiles")
    .select("id, display_name, avatar_url, role, created_at, updated_at, is_banned, banned_until, ban_reason")
    .eq("id", userId)
    .maybeSingle();

  const { isBanned, bannedUntil } = isUserBanned(u, profile);
  const email = u.email || "";
  const emailPrefix = email ? email.split("@")[0] : "";
  const displayName =
    profile?.display_name ||
    u.user_metadata?.full_name ||
    u.user_metadata?.name ||
    emailPrefix ||
    "User";

  const resolvedRole: AdminUserRole =
    (u.app_metadata?.role as AdminUserRole) ||
    (profile?.role as AdminUserRole) ||
    "user";

  // Aggregate engagement
  let favCount = 0;
  let watchCount = 0;
  let recentActivity: AdminUserDetail["recentActivity"] = undefined;

  try {
    const [favRes, watchRes] = await Promise.all([
      client.from("favorites").select("id", { count: "exact" }).eq("user_id", userId),
      client
        .from("watch_history")
        .select("title_slug, updated_at", { count: "exact" })
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(1),
    ]);

    favCount = favRes.count || (Array.isArray(favRes.data) ? favRes.data.length : 0);
    watchCount = watchRes.count || (Array.isArray(watchRes.data) ? watchRes.data.length : 0);

    if (Array.isArray(watchRes.data) && watchRes.data.length > 0) {
      recentActivity = {
        lastWatchedTitle: watchRes.data[0].title_slug,
        lastWatchedAt: watchRes.data[0].updated_at,
      };
    }
  } catch (err) {
    console.warn("[getAdminUserDetailServer] Error fetching engagement details:", err);
  }

  const identities = Array.isArray(u.identities)
    ? u.identities.map((i: any) => ({
        id: i.identity_id || i.id,
        provider: i.provider,
        createdAt: i.created_at,
      }))
    : undefined;

  return {
    id: u.id,
    email,
    displayName,
    avatarUrl: profile?.avatar_url || u.user_metadata?.avatar_url || null,
    role: resolvedRole,
    isBanned,
    bannedUntil: bannedUntil || profile?.banned_until || null,
    banReason: profile?.ban_reason || null,
    createdAt: u.created_at || profile?.created_at || new Date().toISOString(),
    lastLoginAt: u.last_sign_in_at || null,
    socialLogins: extractSocialLogins(u),
    watchHistoryCount: watchCount,
    favoritesCount: favCount,
    identities,
    recentActivity,
  };
}

/**
 * Bans a user, enforcing self-ban prevention and recording structured audit logs.
 */
export async function banUserServer(
  userId: string,
  input: BanUserPayload,
  actor: ActorContext
): Promise<AdminManagedUser> {
  if (userId === actor.id) {
    throw new Error("You cannot ban your own administrator account.");
  }

  const client = createUserServiceRoleClient();
  const currentDetail = await getAdminUserDetailServer(userId);
  if (!currentDetail) {
    throw new Error(`User with ID ${userId} not found.`);
  }

  const duration = input.duration || "876000h";
  let bannedUntil: string | null = null;

  if (/^\d+h$/.test(duration)) {
    const hours = parseInt(duration.replace("h", ""), 10);
    bannedUntil = new Date(Date.now() + hours * 3600 * 1000).toISOString();
  }

  // 1. Update auth.admin
  const { error: authError } = await client.auth.admin.updateUserById(userId, {
    ban_duration: duration,
  });

  if (authError) {
    console.error("[banUserServer] Error banning user via auth.admin:", authError);
    throw new Error(`Failed to ban user in auth: ${authError.message}`);
  }

  // 2. Update profiles table
  const { error: profileError } = await client
    .from("profiles")
    .update({
      is_banned: true,
      banned_until: bannedUntil,
      ban_reason: input.reason || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (profileError) {
    console.warn("[banUserServer] Warning updating profiles table:", profileError.message);
  }

  // 3. Audit log
  await recordAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "user.ban",
    entityType: "user",
    entityId: userId,
    before: {
      isBanned: currentDetail.isBanned,
      bannedUntil: currentDetail.bannedUntil,
      banReason: currentDetail.banReason,
    },
    after: {
      isBanned: true,
      bannedUntil,
      banReason: input.reason || null,
      duration,
    },
    ip: actor.ip,
  });

  const updated = await getAdminUserDetailServer(userId);
  if (!updated) {
    throw new Error("Failed to load updated user after ban.");
  }
  return updated;
}

/**
 * Unbans a user and records structured audit logs.
 */
export async function unbanUserServer(
  userId: string,
  input: UnbanUserPayload = {},
  actor: ActorContext
): Promise<AdminManagedUser> {
  const client = createUserServiceRoleClient();
  const currentDetail = await getAdminUserDetailServer(userId);
  if (!currentDetail) {
    throw new Error(`User with ID ${userId} not found.`);
  }

  // 1. Update auth.admin ban_duration to "none"
  const { error: authError } = await client.auth.admin.updateUserById(userId, {
    ban_duration: "none",
  });

  if (authError) {
    console.error("[unbanUserServer] Error unbanning user via auth.admin:", authError);
    throw new Error(`Failed to unban user in auth: ${authError.message}`);
  }

  // 2. Update profiles table
  const { error: profileError } = await client
    .from("profiles")
    .update({
      is_banned: false,
      banned_until: null,
      ban_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (profileError) {
    console.warn("[unbanUserServer] Warning updating profiles table:", profileError.message);
  }

  // 3. Audit log
  await recordAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "user.unban",
    entityType: "user",
    entityId: userId,
    before: {
      isBanned: currentDetail.isBanned,
      bannedUntil: currentDetail.bannedUntil,
      banReason: currentDetail.banReason,
    },
    after: {
      isBanned: false,
      bannedUntil: null,
      banReason: null,
      unbanReason: input.reason || null,
    },
    ip: actor.ip,
  });

  const updated = await getAdminUserDetailServer(userId);
  if (!updated) {
    throw new Error("Failed to load updated user after unban.");
  }
  return updated;
}

/**
 * Revokes user sessions / forces sign-out and records structured audit logs.
 */
export async function forceSignOutUserServer(
  userId: string,
  actor: ActorContext
): Promise<{ success: boolean; userId: string; signedOutAt: string }> {
  const client = createUserServiceRoleClient();
  const currentDetail = await getAdminUserDetailServer(userId);
  if (!currentDetail) {
    throw new Error(`User with ID ${userId} not found.`);
  }

  const signedOutAt = new Date().toISOString();

  // Try auth.admin.signOut or update app_metadata to invalidate sessions
  try {
    if (typeof (client.auth.admin as any).signOut === "function") {
      await (client.auth.admin as any).signOut(userId);
    }
  } catch (err) {
    console.warn("[forceSignOutUserServer] auth.admin.signOut notice:", err);
  }

  // Set timestamp in app_metadata to invalidate server tokens
  const { error: updateError } = await client.auth.admin.updateUserById(userId, {
    app_metadata: {
      force_signout_at: signedOutAt,
    },
  });

  if (updateError) {
    console.warn("[forceSignOutUserServer] Warning updating user app_metadata:", updateError.message);
  }

  // Update profiles.updated_at
  await client
    .from("profiles")
    .update({ updated_at: signedOutAt })
    .eq("id", userId);

  // Audit log
  await recordAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "user.force_signout",
    entityType: "user",
    entityId: userId,
    before: null,
    after: { forcedAt: signedOutAt },
    ip: actor.ip,
  });

  return {
    success: true,
    userId,
    signedOutAt,
  };
}

/**
 * Changes a user's role (user, editor, admin) with self-demotion prevention and structured audit logging.
 */
export async function updateUserRoleServer(
  userId: string,
  newRole: AdminUserRole,
  actor: ActorContext
): Promise<AdminManagedUser> {
  if (userId === actor.id && newRole !== "admin") {
    throw new Error("You cannot remove admin privileges from your own account.");
  }

  const client = createUserServiceRoleClient();
  const currentDetail = await getAdminUserDetailServer(userId);
  if (!currentDetail) {
    throw new Error(`User with ID ${userId} not found.`);
  }

  const previousRole = currentDetail.role;

  // 1. Update app_metadata.role via auth.admin
  const { error: authError } = await client.auth.admin.updateUserById(userId, {
    app_metadata: {
      role: newRole,
    },
  });

  if (authError) {
    console.error("[updateUserRoleServer] Error updating user role in auth:", authError);
    throw new Error(`Failed to update user role in auth: ${authError.message}`);
  }

  // 2. Update profiles.role
  const { error: profileError } = await client
    .from("profiles")
    .update({
      role: newRole,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (profileError) {
    console.warn("[updateUserRoleServer] Warning updating profiles role:", profileError.message);
  }

  // 3. Audit log
  await recordAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "user.role_change",
    entityType: "user",
    entityId: userId,
    before: { role: previousRole },
    after: { role: newRole },
    ip: actor.ip,
  });

  const updated = await getAdminUserDetailServer(userId);
  if (!updated) {
    throw new Error("Failed to load updated user after role change.");
  }
  return updated;
}
