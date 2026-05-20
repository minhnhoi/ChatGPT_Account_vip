import mongoose from "mongoose";

const STATUS_VALUES = [
  "success",
  "not_found",
  "error",
  "config_missing",
  "bound",
  "cooldown",
  "login_confirmed",
  "login_not_confirmed",
];

const otpLogSchema = new mongoose.Schema(
  {
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      default: null,
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
    recipientEmail: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 160,
      default: "",
    },
    requesterName: {
      type: String,
      trim: true,
      maxlength: 80,
      default: "",
    },
    requesterVisitorId: {
      type: String,
      trim: true,
      maxlength: 120,
      default: "",
    },
    requestedByRole: {
      type: String,
      enum: ["admin", "user"],
      default: "user",
    },
    otpCode: {
      type: String,
      trim: true,
      maxlength: 12,
      default: "",
    },
    senderEmail: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 160,
      default: "",
    },
    subject: {
      type: String,
      trim: true,
      maxlength: 240,
      default: "",
    },
    receivedAt: {
      type: Date,
      default: null,
    },
    messageUid: {
      type: String,
      trim: true,
      maxlength: 80,
      default: "",
    },
    status: {
      type: String,
      enum: STATUS_VALUES,
      default: "success",
    },
    message: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    loginResult: {
      type: String,
      enum: ["pending", "done", "not_done", ""],
      default: "",
    },
    loginConfirmedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

otpLogSchema.index({ createdAt: -1 });
otpLogSchema.index({ accountId: 1, createdAt: -1 });
otpLogSchema.index({ requesterVisitorId: 1, createdAt: -1 });
otpLogSchema.index({ recipientEmail: 1, senderEmail: 1, receivedAt: -1 });

export default mongoose.model("OtpLog", otpLogSchema);
