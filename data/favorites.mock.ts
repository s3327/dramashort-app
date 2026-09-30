// Initial empty favorites list for new guests and users.
// Guest favorites are stored cleanly in localStorage;
// Authenticated user favorites sync with the user_favorites table in Supabase.
export const defaultFavoriteSlugs: string[] = [];
