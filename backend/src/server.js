import express from "express";
import { createServer } from "node:http";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { connectDB } from "./config/db.js";
import { env, validateEnv } from "./config/env.js";
import authRoutes from "./routes/auth.routes.js";
import accountRoutes from "./routes/account.routes.js";
import activityRoutes from "./routes/activity.routes.js";
import backupRoutes from "./routes/backup.routes.js";
import profileRoutes from "./routes/profile.routes.js";
import otpRoutes from "./routes/otp.routes.js";
import { mailToolPage } from "./toolPages/mailToolPage.js";
import { getAdminSessionFromRequest } from "./utils/adminAuth.js";
import { errorHandler, notFound } from "./middlewares/errorHandler.js";
import { initRealtime } from "./socket.js";
import { ensureBootstrapAdminUser } from "./controllers/auth.controller.js";

async function bootstrap() {
  try {
    validateEnv();
    await connectDB();
    await ensureBootstrapAdminUser();

    const app = express();
    app.disable("x-powered-by");
    app.set("trust proxy", 1);

    const allowedOrigins = String(env.clientUrl || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    app.use(
      helmet({
        crossOriginResourcePolicy: { policy: "same-site" },
        frameguard: { action: "deny" },
        referrerPolicy: { policy: "no-referrer" },
        hsts: env.isProduction
          ? { maxAge: 15552000, includeSubDomains: true, preload: true }
          : false,
        contentSecurityPolicy: {
          useDefaults: true,
          directives: {
            defaultSrc: ["'self'"],
            baseUri: ["'self'"],
            objectSrc: ["'none'"],
            frameAncestors: ["'none'"],
            formAction: ["'self'"],
            imgSrc: ["'self'", "data:"],
            connectSrc: ["'self'", ...allowedOrigins],

            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
          },
        },
      }),
    );

    app.use((req, res, next) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Referrer-Policy", "no-referrer");
      res.setHeader(
        "Permissions-Policy",
        "camera=(), microphone=(), geolocation=(), payment=()",
      );
      if (req.path.startsWith("/api/")) {
        res.setHeader(
          "Cache-Control",
          "no-store, no-cache, must-revalidate, proxy-revalidate",
        );
        res.setHeader("Pragma", "no-cache");
      }
      next();
    });

    app.use(
      cors({
        origin(origin, callback) {
          if (!origin) return callback(null, true);
          if (allowedOrigins.includes(origin)) return callback(null, true);
          return callback(new Error(`CORS không cho phép origin: ${origin}`));
        },
        credentials: true,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: [
          "Content-Type",
          "X-CSRF-Token",
          "X-Admin-Session",
          "X-User-Session",
          "X-Auth-Session",
          "X-Visitor-Name",
          "X-Visitor-Id",
          "X-Visitor-Token",
          "X-Client-Fingerprint",
          "X-Client-Timezone",
          "X-Client-Platform",
          "X-Client-Screen",
        ],
      }),
    );

    const apiLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: env.isProduction ? 450 : 900,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        success: false,
        message: "Bạn thao tác quá nhanh. Hãy đợi một lát rồi thử lại.",
      },
    });

    app.use("/api", apiLimiter);
    app.use(express.json({ limit: env.maxJsonSize }));

    app.get("/api/health", (req, res) => {
      res.json({
        success: true,
        message: "API đang chạy",
        mailTool: `/mail-tool`,
        security: {
          httpOnlyAdminCookie: true,
          httpOnlyVisitorCookie: true,
          csrfProtection: env.enableCsrfProtection,
          noStoreApiCache: true,
          corsOrigins: allowedOrigins,
          legacyAdminToken: env.allowLegacyAdminToken,
          legacyVisitorHeader: env.allowLegacyVisitorHeader,
        },
      });
    });

    app.get("/mail-tool", (req, res) => {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(
        mailToolPage({ isAdmin: Boolean(getAdminSessionFromRequest(req)) }),
      );
    });

    app.use("/api/auth", authRoutes);
    app.use("/api/accounts", accountRoutes);
    app.use("/api/activity", activityRoutes);
    app.use("/api/backup", backupRoutes);
    app.use("/api/profile", profileRoutes);
    app.use("/api/otp", otpRoutes);

    app.use(notFound);
    app.use(errorHandler);

    const httpServer = createServer(app);
    initRealtime(httpServer, allowedOrigins);

    httpServer.listen(env.port, () => {
      console.log(`\nBackend đang chạy tại http://localhost:${env.port}`);
      console.log(
        `CORS cho phép: ${allowedOrigins.join(", ") || "(chưa cấu hình CLIENT_URL)"}`,
      );
      console.log(
        `Admin cookie: ${env.adminCookieName}; SameSite=${env.adminCookieSameSite}; Secure=${env.adminCookieSecure}; SessionDays=${env.adminSessionDays}`,
      );
      console.log(
        `Visitor cookie: ${env.visitorCookieName}; SameSite=${env.visitorCookieSameSite}; Secure=${env.visitorCookieSecure}`,
      );
      console.log(
        `Realtime: Socket.IO enabled + polling fallback on frontend\n`,
      );
    });
  } catch (error) {
    console.error("Không thể khởi động backend:", error.message);
    process.exit(1);
  }
}

bootstrap();
