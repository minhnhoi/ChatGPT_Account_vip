import mongoose from "mongoose";

const USER_ROLE_VALUES = ["admin", "user"];
const USER_STATUS_VALUES = ["active", "disabled"];

const appUserSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 40,
      match: [
        /^[a-z0-9._-]+$/,
        "Tên đăng nhập chỉ gồm chữ thường, số, dấu chấm, gạch dưới hoặc gạch ngang",
      ],
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 160,
      default: "",
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: USER_ROLE_VALUES,
      default: "user",
    },
    status: {
      type: String,
      enum: USER_STATUS_VALUES,
      default: "active",
    },
    linkedVisitorId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 120,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    createdBySystem: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.passwordHash;
        return ret;
      },
    },
  },
);

appUserSchema.index({ email: 1 }, { sparse: true });
appUserSchema.index({ role: 1, status: 1 });

export const USER_ROLE_VALUES_ENUM = USER_ROLE_VALUES;
export const USER_STATUS_VALUES_ENUM = USER_STATUS_VALUES;
export default mongoose.model("AppUser", appUserSchema);
