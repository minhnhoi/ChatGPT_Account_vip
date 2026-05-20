import mongoose from "mongoose";

const mailConfigSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: "default",
    },
    imapEmail: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 160,
      default: "",
    },
    imapHost: {
      type: String,
      trim: true,
      maxlength: 120,
      default: "imap.gmail.com",
    },
    imapPort: {
      type: Number,
      default: 993,
      min: 1,
      max: 65535,
    },
    useTLS: {
      type: Boolean,
      default: true,
    },
    appPasswordEncrypted: {
      type: String,
      default: "",
    },
    senderEmail: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 160,
      default: "noreply@tm.openai.com",
    },
    senderEmails: {
      type: [String],
      default: ["noreply@tm.openai.com", "noreply@tm1.openai.com"],
      validate: {
        validator(value) {
          return Array.isArray(value) && value.length <= 10;
        },
        message: "Chỉ nên cấu hình tối đa 10 email người gửi OTP.",
      },
    },
    mailbox: {
      type: String,
      trim: true,
      maxlength: 80,
      default: "INBOX",
    },
    searchDays: {
      type: Number,
      default: 30,
      min: 1,
      max: 365,
    },
    fetchLimit: {
      type: Number,
      default: 300,
      min: 20,
      max: 1000,
    },
    enabled: {
      type: Boolean,
      default: false,
    },
    lastTestAt: {
      type: Date,
      default: null,
    },
    lastTestStatus: {
      type: String,
      trim: true,
      maxlength: 80,
      default: "",
    },
  },
  { timestamps: true },
);

mailConfigSchema.methods.toSafeJSON = function toSafeJSON() {
  const doc = this.toObject();
  delete doc.appPasswordEncrypted;
  doc.hasAppPassword = Boolean(this.appPasswordEncrypted);
  return doc;
};

export default mongoose.model("MailConfig", mailConfigSchema);
