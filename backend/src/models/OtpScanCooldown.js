import mongoose from "mongoose";

const otpScanCooldownSchema = new mongoose.Schema(
  {
    visitorId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    requesterName: {
      type: String,
      trim: true,
      maxlength: 80,
      default: "",
    },
    requestedByRole: {
      type: String,
      enum: ["admin", "user"],
      default: "user",
    },
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: true,
    },
    accountName: {
      type: String,
      trim: true,
      maxlength: 120,
      default: "",
    },
    loginEmail: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 160,
      default: "",
    },
    lastScanAt: {
      type: Date,
      default: null,
    },
    nextAllowedAt: {
      type: Date,
      default: null,
    },
    cooldownSeconds: {
      type: Number,
      min: 1,
      max: 3600,
      default: 45,
    },
    lastResultStatus: {
      type: String,
      trim: true,
      maxlength: 40,
      default: "started",
    },
    lastMessage: {
      type: String,
      trim: true,
      maxlength: 240,
      default: "",
    },
  },
  { timestamps: true },
);

otpScanCooldownSchema.index({ visitorId: 1, accountId: 1 }, { unique: true });
otpScanCooldownSchema.index({ nextAllowedAt: 1 });
otpScanCooldownSchema.index({ updatedAt: -1 });

export default mongoose.model("OtpScanCooldown", otpScanCooldownSchema);
