import mongoose from "mongoose";

const activityLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    target: {
      type: String,
      trim: true,
      maxlength: 120,
      default: "system",
    },
    targetId: {
      type: String,
      trim: true,
      maxlength: 80,
      default: "",
    },
    description: {
      type: String,
      trim: true,
      maxlength: 300,
      default: "",
    },
    ip: {
      type: String,
      trim: true,
      maxlength: 80,
      default: "",
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

activityLogSchema.index({ createdAt: -1 });
activityLogSchema.index({ action: 1 });

export default mongoose.model("ActivityLog", activityLogSchema);
