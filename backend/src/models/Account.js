import mongoose from "mongoose";

const PLAN_VALUES = ["free", "plus", "pro", "team", "enterprise", "other"];
const STATUS_VALUES = [
  "new",
  "active",
  "expired",
  "disabled",
  "archived",
  "in_use",
  "old",
  "lost",
];
const ACCESS_STATUS_VALUES = ["pending", "approved", "rejected", "revoked"];

const clientInfoSchema = new mongoose.Schema(
  {
    ip: { type: String, trim: true, maxlength: 80, default: "" },
    ipPrefix: { type: String, trim: true, maxlength: 80, default: "" },
    forwardedFor: { type: String, trim: true, maxlength: 240, default: "" },
    userAgent: { type: String, trim: true, maxlength: 360, default: "" },
    fingerprint: { type: String, trim: true, maxlength: 180, default: "" },
    timezone: { type: String, trim: true, maxlength: 80, default: "" },
    language: { type: String, trim: true, maxlength: 80, default: "" },
    platform: { type: String, trim: true, maxlength: 80, default: "" },
    screen: { type: String, trim: true, maxlength: 80, default: "" },
    duplicateSignals: {
      sameFingerprintVisitors: { type: Number, default: 0 },
      sameIpPrefixVisitors: { type: Number, default: 0 },
      sameUserAgentVisitors: { type: Number, default: 0 },
      sameFingerprintRequests: { type: Number, default: 0 },
      sameIpPrefixRequests: { type: Number, default: 0 },
    },
    riskScore: { type: Number, min: 0, max: 100, default: 0 },
    riskFlags: { type: [String], default: [] },
  },
  { _id: false },
);

const accessRequestSchema = new mongoose.Schema(
  {
    requesterName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    requesterVisitorId: {
      type: String,
      trim: true,
      maxlength: 120,
      default: "",
    },
    status: {
      type: String,
      enum: ACCESS_STATUS_VALUES,
      default: "pending",
    },
    requestedAt: {
      type: Date,
      default: Date.now,
    },
    decidedAt: {
      type: Date,
      default: null,
    },
    decidedBy: {
      type: String,
      trim: true,
      maxlength: 80,
      default: "",
    },
    decisionReason: {
      type: String,
      trim: true,
      maxlength: 360,
      default: "",
    },
    loginConfirmedAt: {
      type: Date,
      default: null,
    },
    clientInfo: {
      type: clientInfoSchema,
      default: () => ({}),
    },
    hiddenFromAdmin: {
      type: Boolean,
      default: false,
    },
  },
  { _id: true },
);

const accountSchema = new mongoose.Schema(
  {
    ownerName: {
      type: String,
      required: [true, "Tên là bắt buộc"],
      trim: true,
      maxlength: 80,
    },
    ownerOriginalName: {
      type: String,
      trim: true,
      maxlength: 80,
      default: "",
    },
    ownerIsAdmin: {
      type: Boolean,
      default: undefined,
    },
    ownerOriginalIsAdmin: {
      type: Boolean,
      default: true,
    },
    loginEmail: {
      type: String,
      required: [true, "Mail đăng nhập là bắt buộc"],
      trim: true,
      lowercase: true,
      maxlength: 120,
    },
    passwordEncrypted: {
      type: String,
      required: [true, "Mật khẩu là bắt buộc"],
    },
    accountName: {
      type: String,
      required: [true, "Tên tài khoản là bắt buộc"],
      trim: true,
      maxlength: 100,
    },
    serviceUrl: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    planVersion: {
      type: String,
      enum: PLAN_VALUES,
      default: "free",
    },
    status: {
      type: String,
      enum: STATUS_VALUES,
      default: "new",
    },
    renewalDate: {
      type: Date,
      default: null,
    },
    tags: {
      type: [String],
      default: [],
    },
    note: {
      type: String,
      trim: true,
      maxlength: 1200,
      default: "",
    },
    accessRequests: {
      type: [accessRequestSchema],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.passwordEncrypted;
        ret.passwordMasked = "••••••••";
        return ret;
      },
    },
  },
);

accountSchema.index({ loginEmail: 1 });
accountSchema.index({ ownerIsAdmin: 1 });
accountSchema.index({
  accountName: "text",
  ownerName: "text",
  loginEmail: "text",
  note: "text",
});
accountSchema.index({
  "accessRequests.requesterName": 1,
  "accessRequests.status": 1,
});
accountSchema.index({ "accessRequests.requesterVisitorId": 1 });
accountSchema.index({ "accessRequests.clientInfo.fingerprint": 1 });
accountSchema.index({ "accessRequests.clientInfo.ipPrefix": 1 });

export const PLAN_VALUES_ENUM = PLAN_VALUES;
export const STATUS_VALUES_ENUM = STATUS_VALUES;
export const ACCESS_STATUS_VALUES_ENUM = ACCESS_STATUS_VALUES;
export default mongoose.model("Account", accountSchema);
