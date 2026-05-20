import { Code2, Database, ShieldCheck, Sparkles } from "lucide-react";

export default function AppFooter({ isAdmin = false, visitorName = "" }) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="app-copyright-footer">
      <div>
        <span className="footer-logo-mark">
          <Sparkles size={16} />
        </span>
        <div>
          <strong>AccountHub Secure Vault</strong>
          <small>© {currentYear} AccountHub. All rights reserved.</small>
        </div>
      </div>
      <nav aria-label="Footer information">
        <span>
          <ShieldCheck size={14} /> {isAdmin ? "Admin session" : "User session"}
        </span>
        <span>
          <Database size={14} /> MongoDB-backed
        </span>
        <span>
          <Code2 size={14} /> React + Node.js
        </span>
        <span>Signed in as {visitorName || "Guest"}</span>
      </nav>
    </footer>
  );
}
