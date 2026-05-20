import net from "net";
import tls from "tls";

const DEFAULT_OPENAI_OTP_SENDERS = [
  "noreply@tm.openai.com",
  "noreply@tm1.openai.com",
];

function cleanText(value) {
  return String(value || "").trim();
}

function normalizeEmail(value) {
  return cleanText(value)
    .replace(/^<|>$/g, "")
    .replace(/^mailto:/i, "")
    .toLowerCase();
}

function uniqueValues(values = []) {
  return Array.from(
    new Set(values.map((item) => cleanText(item)).filter(Boolean)),
  );
}

export function getConfiguredSenderEmails(config = {}) {
  const rawValues = [];

  if (Array.isArray(config.senderEmails))
    rawValues.push(...config.senderEmails);
  if (config.senderEmail)
    rawValues.push(...String(config.senderEmail).split(/[;,\n]+/));

  const normalized = uniqueValues(rawValues.map(normalizeEmail));
  return normalized.length ? normalized : DEFAULT_OPENAI_OTP_SENDERS;
}

function escapeImapString(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"');
}

function formatImapDate(date) {
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${String(date.getDate()).padStart(2, "0")}-${months[date.getMonth()]}-${date.getFullYear()}`;
}

function decodeMimeEncodedWords(value = "") {
  return String(value).replace(
    /=\?([^?]+)\?([bqBQ])\?([^?]+)\?=/g,
    (full, charset, enc, payload) => {
      try {
        const normalizedCharset = String(charset || "").toLowerCase();
        if (enc.toLowerCase() === "b") {
          const buffer = Buffer.from(payload, "base64");
          return normalizedCharset.includes("utf")
            ? buffer.toString("utf8")
            : buffer.toString("latin1");
        }

        const bytes = payload
          .replace(/_/g, " ")
          .replace(/=([a-fA-F0-9]{2})/g, (_, hex) =>
            String.fromCharCode(parseInt(hex, 16)),
          );
        const buffer = Buffer.from(bytes, "binary");
        return normalizedCharset.includes("utf")
          ? buffer.toString("utf8")
          : buffer.toString("latin1");
      } catch {
        return full;
      }
    },
  );
}

function decodeQuotedPrintable(value = "") {
  const input = String(value || "").replace(/=\r?\n/g, "");
  try {
    const binary = input.replace(/=([a-fA-F0-9]{2})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    );
    return Buffer.from(binary, "binary").toString("utf8");
  } catch {
    return input.replace(/=([a-fA-F0-9]{2})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    );
  }
}

function decodeHtmlEntities(value = "") {
  return String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([a-fA-F0-9]+);/g, (_, code) =>
      String.fromCharCode(parseInt(code, 16)),
    )
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripHtml(value = "") {
  return decodeHtmlEntities(
    String(value)
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  );
}

function splitRawEmail(raw = "") {
  const value = String(raw || "");
  const index = value.search(/\r?\n\r?\n/);
  if (index < 0) return { headers: value, body: "" };
  const separator = value.match(/\r?\n\r?\n/)?.[0] || "\n\n";
  return {
    headers: value.slice(0, index),
    body: value.slice(index + separator.length),
  };
}

function getHeaderValue(raw, headerName) {
  const { headers } = splitRawEmail(raw);
  const pattern = new RegExp(
    `^${headerName}:([\\s\\S]*?)(?=\\r?\\n[^\\s]|$)`,
    "gim",
  );
  const values = [];
  let match;
  while ((match = pattern.exec(headers))) {
    values.push(
      decodeMimeEncodedWords(match[1].replace(/\r?\n[\t ]+/g, " ").trim()),
    );
  }
  return values.join(" ");
}

function extractEmails(value = "") {
  return Array.from(
    String(value).matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi),
  ).map((match) => normalizeEmail(match[0]));
}

function extractRecipientEmailsFromHeaders(raw = "") {
  const recipientHeaders = [
    "To",
    "Delivered-To",
    "X-Original-To",
    "X-Google-Original-To",
    "X-Gm-Original-To",
    "Original-To",
    "Envelope-To",
    "Apparently-To",
    "Resent-To",
    "Cc",
    "X-Forwarded-To",
  ];

  const emails = new Set();
  recipientHeaders.forEach((header) => {
    extractEmails(getHeaderValue(raw, header)).forEach((email) =>
      emails.add(email),
    );
  });

  const { headers } = splitRawEmail(raw);
  const decodedHeaders = decodeMimeEncodedWords(headers).replace(
    /\r?\n[\t ]+/g,
    " ",
  );
  const receivedForMatches = decodedHeaders.matchAll(
    /\bfor\s+<?([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})>?\s*;/gi,
  );
  for (const match of receivedForMatches) {
    emails.add(normalizeEmail(match[1]));
  }

  return Array.from(emails);
}

export function messageMatchesRecipient(raw, recipientEmail) {
  const expected = normalizeEmail(recipientEmail);
  if (!expected) return false;

  const emails = extractRecipientEmailsFromHeaders(raw);
  return emails.includes(expected);
}

function messageMatchesSender(raw, allowedSenders = []) {
  const allowed = new Set(allowedSenders.map(normalizeEmail).filter(Boolean));
  if (!allowed.size) return true;

  const senderHeaders = ["From", "Sender", "Reply-To", "Return-Path"];
  const found = new Set();
  senderHeaders.forEach((header) =>
    extractEmails(getHeaderValue(raw, header)).forEach((email) =>
      found.add(email),
    ),
  );

  return Array.from(found).some((email) => allowed.has(email));
}

function extractActualSender(raw = "", fallback = "") {
  const senderHeaders = ["From", "Sender", "Return-Path"];
  for (const header of senderHeaders) {
    const email = extractEmails(getHeaderValue(raw, header))[0];
    if (email) return email;
  }
  return normalizeEmail(fallback);
}

function normalizeOtpText(value = "") {
  const decoded = stripHtml(
    decodeQuotedPrintable(decodeMimeEncodedWords(value)),
  );
  return decoded
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, " ")
    .replace(/\b[a-f0-9]{24,}\b/gi, " ")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractOtpCode(raw = "") {
  const subject = normalizeOtpText(getHeaderValue(raw, "Subject"));
  const { body } = splitRawEmail(raw);
  const bodyText = normalizeOtpText(body);
  const combined = `${subject}\n${bodyText}`.trim();

  const strongPatterns = [
    /(?:verification|security|login|authentication|auth|one[-\s]?time|otp|passcode|code|mã|ma)\D{0,140}([0-9]{6})(?!\d)/i,
    /(^|\D)([0-9]{6})(?!\d)\D{0,140}(?:verification|security|login|authentication|auth|one[-\s]?time|otp|passcode|code|mã|ma)/i,
  ];

  for (const sourceText of [subject, combined, bodyText]) {
    for (const pattern of strongPatterns) {
      const match = sourceText.match(pattern);
      const code = match?.[2] || match?.[1];
      if (code && /^\d{6}$/.test(code)) return code;
    }
  }

  const candidates = [];
  const regex = /(^|\D)(\d{6})(?!\d)/g;
  let match;
  while ((match = regex.exec(combined))) {
    const code = match[2];
    const start = Math.max(0, match.index - 160);
    const end = Math.min(combined.length, match.index + 170);
    const context = combined.slice(start, end).toLowerCase();
    let score = 0;

    if (/\b(chatgpt|openai)\b/i.test(context)) score += 20;
    if (
      /\b(code|verification|verify|security|login|authentication|auth|one[-\s]?time|otp|passcode|mã|ma)\b/i.test(
        context,
      )
    )
      score += 80;
    if (/\b(your|enter|use|expires?|valid|temporary|mã|ma)\b/i.test(context))
      score += 25;
    if (
      /\b(unsubscribe|privacy|support|ticket|request id|order|invoice|phone|tel|address|street|zip|postal|copyright)\b/i.test(
        context,
      )
    )
      score -= 80;
    if (
      /https?:|utm_|token|session|client|redirect|href|src|cid:/i.test(context)
    )
      score -= 80;

    candidates.push({ code, score });
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.score >= 70 ? candidates[0].code : "";
}

function parseInternalDate(fetchResponse = "") {
  const match = String(fetchResponse).match(/INTERNALDATE\s+"([^"]+)"/i);
  if (!match) return null;
  const parsed = new Date(match[1]);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseHeaderDate(raw = "") {
  const value = getHeaderValue(raw, "Date");
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseUid(fetchResponse = "") {
  const match = String(fetchResponse).match(/\bUID\s+(\d+)\b/i);
  return match?.[1] || "";
}

function parseSubject(raw = "") {
  return getHeaderValue(raw, "Subject").slice(0, 240);
}

function extractImapLiteralPayload(fetchResponse = "") {
  const response = String(fetchResponse || "");
  const literalMatch = response.match(/\{\d+\}\r?\n/);
  if (!literalMatch) return response;

  const start = (literalMatch.index || 0) + literalMatch[0].length;
  let payload = response.slice(start);

  const closingMatch = payload.match(
    /\r?\n\)\r?\nA\d+\s+(?:OK|NO|BAD)[\s\S]*$/i,
  );
  if (closingMatch && typeof closingMatch.index === "number") {
    payload = payload.slice(0, closingMatch.index);
  }

  return payload;
}

class SimpleImapClient {
  constructor(config) {
    this.config = config;
    this.socket = null;
    this.buffer = "";
    this.tagCounter = 0;
  }

  async connect() {
    const { imapHost, imapPort, useTLS } = this.config;
    const host = imapHost || "imap.gmail.com";
    const port = Number(imapPort || 993);

    this.socket =
      useTLS === false
        ? net.connect({ host, port })
        : tls.connect({ host, port, servername: host });

    this.socket.setEncoding("utf8");
    this.socket.on("data", (chunk) => {
      this.buffer += chunk;
    });

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("IMAP timeout khi kết nối mailbox.")),
        20000,
      );
      this.socket.once("error", reject);
      const check = () => {
        if (/\* OK/i.test(this.buffer)) {
          clearTimeout(timeout);
          this.socket.off("error", reject);
          resolve();
        } else {
          setTimeout(check, 40);
        }
      };
      check();
    });
  }

  async command(commandText, timeoutMs = 45000) {
    if (!this.socket) throw new Error("IMAP chưa kết nối.");
    const tag = `A${++this.tagCounter}`;
    this.buffer = "";
    this.socket.write(`${tag} ${commandText}\r\n`);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () =>
          reject(
            new Error(`IMAP timeout ở lệnh ${commandText.split(" ")[0]}.`),
          ),
        timeoutMs,
      );
      const check = () => {
        const done = new RegExp(`(?:^|\\r?\\n)${tag} (OK|NO|BAD)`, "i").exec(
          this.buffer,
        );
        if (done) {
          clearTimeout(timeout);
          if (done[1].toUpperCase() === "OK") return resolve(this.buffer);
          return reject(
            new Error(
              `IMAP trả về ${done[1]} cho lệnh ${commandText.split(" ")[0]}.`,
            ),
          );
        }
        setTimeout(check, 50);
      };
      check();
    });
  }

  async login() {
    const username = escapeImapString(this.config.imapEmail || "");
    const password = escapeImapString(this.config.appPassword || "");
    await this.command(`LOGIN "${username}" "${password}"`);
  }

  async selectMailbox() {
    const mailbox = escapeImapString(this.config.mailbox || "INBOX");
    await this.command(`SELECT "${mailbox}"`);
  }

  async searchSender(senderEmail) {
    const days = Math.max(
      1,
      Math.min(365, Number(this.config.searchDays || 30)),
    );
    const since = formatImapDate(
      new Date(Date.now() - days * 24 * 60 * 60 * 1000),
    );
    const sender = escapeImapString(senderEmail || "");
    const response = await this.command(
      `UID SEARCH FROM "${sender}" SINCE "${since}"`,
    );
    const line =
      response.split(/\r?\n/).find((item) => /^\* SEARCH/i.test(item)) || "";
    return line
      .replace(/^\* SEARCH\s*/i, "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
  }

  async searchSenders(senderEmails = []) {
    const uidSet = new Set();
    for (const senderEmail of senderEmails) {
      const uids = await this.searchSender(senderEmail);
      uids.forEach((uid) => uidSet.add(String(uid)));
    }
    return Array.from(uidSet).sort((a, b) => Number(a) - Number(b));
  }

  async fetchMessage(uid) {
    return this.command(
      `UID FETCH ${uid} (UID INTERNALDATE BODY.PEEK[])`,
      60000,
    );
  }

  close() {
    try {
      if (this.socket && !this.socket.destroyed)
        this.socket.end("A999 LOGOUT\r\n");
    } catch {}
  }
}

export async function testImapConnection(config) {
  const client = new SimpleImapClient(config);
  try {
    await client.connect();
    await client.login();
    await client.selectMailbox();
    return { ok: true, message: "Kết nối IMAP thành công." };
  } finally {
    client.close();
  }
}

export async function findOtpFromMailbox(config, recipientEmail) {
  if (!config?.imapEmail || !config?.appPassword) {
    throw new Error("Chưa cấu hình email IMAP hoặc mã ứng dụng.");
  }

  const expectedRecipient = normalizeEmail(recipientEmail);
  const senderEmails = getConfiguredSenderEmails(config);
  const client = new SimpleImapClient(config);

  try {
    await client.connect();
    await client.login();
    await client.selectMailbox();

    const allUids = await client.searchSenders(senderEmails);
    const limit = Math.max(
      20,
      Math.min(1000, Number(config.fetchLimit || 300)),
    );
    const candidateUids = allUids
      .slice(-limit)
      .sort((a, b) => Number(b) - Number(a));

    const matchedMessages = [];
    let recipientMatched = 0;
    let senderMatched = 0;
    let otpMissingAfterRecipientMatch = 0;
    const lastRecipientHeaders = [];

    for (const uid of candidateUids) {
      const fetchResponse = await client.fetchMessage(uid);
      const messageRaw = extractImapLiteralPayload(fetchResponse);
      if (!messageMatchesSender(messageRaw, senderEmails)) continue;
      senderMatched += 1;

      const recipientHeaders = extractRecipientEmailsFromHeaders(messageRaw);
      if (!recipientHeaders.includes(expectedRecipient)) {
        if (lastRecipientHeaders.length < 5)
          lastRecipientHeaders.push({
            uid: String(uid),
            recipients: recipientHeaders,
          });
        continue;
      }
      recipientMatched += 1;

      const otpCode = extractOtpCode(messageRaw);
      if (!otpCode) {
        otpMissingAfterRecipientMatch += 1;
        continue;
      }

      const internalDate = parseInternalDate(fetchResponse);
      const headerDate = parseHeaderDate(messageRaw);
      const receivedAt = internalDate || headerDate;
      const messageUid = parseUid(fetchResponse) || String(uid);
      matchedMessages.push({
        otpCode,
        recipientEmail: expectedRecipient,
        senderEmail: extractActualSender(messageRaw, senderEmails[0]),
        subject: parseSubject(messageRaw),
        receivedAt,
        messageUid,
        numericUid: Number(messageUid || uid) || 0,
      });
    }

    matchedMessages.sort((a, b) => {
      const dateA = a.receivedAt ? a.receivedAt.getTime() : 0;
      const dateB = b.receivedAt ? b.receivedAt.getTime() : 0;
      if (dateA !== dateB) return dateB - dateA;
      return (b.numericUid || 0) - (a.numericUid || 0);
    });

    const newest = matchedMessages[0];
    if (newest) {
      return {
        found: true,
        otpCode: newest.otpCode,
        recipientEmail: newest.recipientEmail,
        senderEmail: newest.senderEmail,
        senderEmails,
        subject: newest.subject,
        receivedAt: newest.receivedAt,
        messageUid: newest.messageUid,
        scanned: candidateUids.length,
        recipientMatched,
        senderMatched,
        otpMissingAfterRecipientMatch,
      };
    }

    return {
      found: false,
      recipientEmail: expectedRecipient,
      senderEmail: senderEmails.join(", "),
      senderEmails,
      scanned: candidateUids.length,
      totalMatchedSender: allUids.length,
      recipientMatched,
      senderMatched,
      otpMissingAfterRecipientMatch,
      sampleRecipientHeaders: lastRecipientHeaders,
    };
  } finally {
    client.close();
  }
}
