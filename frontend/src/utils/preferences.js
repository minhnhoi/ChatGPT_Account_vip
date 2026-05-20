export const DEFAULT_PREFERENCES = {
  defaultPlan: "plus",
  defaultStatus: "new",
  reminderDays: 30,
  tableDensity: "comfortable",
  themeGlow: "balanced",
};

export function normalizePreferences(preferences = {}) {
  return {
    ...DEFAULT_PREFERENCES,
    ...(preferences || {}),
    reminderDays: Math.min(
      365,
      Math.max(
        1,
        Number(preferences?.reminderDays || DEFAULT_PREFERENCES.reminderDays),
      ),
    ),
  };
}

export function normalizePreferenceOwner(visitorName = "") {
  return (
    String(visitorName || "guest")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9_-]/g, "") || "guest"
  );
}

export function getPreferenceKey(visitorName = "") {
  return `mongo_profile_preferences_${normalizePreferenceOwner(visitorName)}`;
}

export function readPreferences() {
  return DEFAULT_PREFERENCES;
}

export function savePreferences(_visitorName = "", preferences = {}) {
  return normalizePreferences(preferences);
}
