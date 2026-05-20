import mongoose from "mongoose";

export const DEFAULT_PROFILE_PREFERENCES = {
  defaultPlan: "plus",
  defaultStatus: "new",
  reminderDays: 30,
  tableDensity: "comfortable",
  themeGlow: "balanced",
};

const visitorProfileSchema = new mongoose.Schema(
  {
    visitorId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 120,
    },
    displayName: {
      type: String,
      trim: true,
      maxlength: 80,
      default: "non",
    },
    preferences: {
      defaultPlan: {
        type: String,
        default: DEFAULT_PROFILE_PREFERENCES.defaultPlan,
      },
      defaultStatus: {
        type: String,
        default: DEFAULT_PROFILE_PREFERENCES.defaultStatus,
      },
      reminderDays: {
        type: Number,
        default: DEFAULT_PROFILE_PREFERENCES.reminderDays,
        min: 1,
        max: 365,
      },
      tableDensity: {
        type: String,
        default: DEFAULT_PROFILE_PREFERENCES.tableDensity,
      },
      themeGlow: {
        type: String,
        default: DEFAULT_PROFILE_PREFERENCES.themeGlow,
      },
    },
    seenNotifications: {
      user: { type: [String], default: [] },
      admin: { type: [String], default: [] },
    },
    otpBinding: {
      accountId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Account",
        default: null,
      },
      accountName: { type: String, trim: true, maxlength: 120, default: "" },
      loginEmail: {
        type: String,
        trim: true,
        lowercase: true,
        maxlength: 160,
        default: "",
      },
      assignedAt: { type: Date, default: null },
    },
  },
  { timestamps: true },
);

visitorProfileSchema.index({ displayName: 1 });

export default mongoose.model("VisitorProfile", visitorProfileSchema);
