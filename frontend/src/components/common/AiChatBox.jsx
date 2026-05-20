import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  CheckCircle2,
  ChevronDown,
  Copy,
  Database,
  KeyRound,
  Lock,
  MessageCircle,
  Navigation,
  Send,
  ShieldCheck,
  Sparkles,
  UserCheck,
  X,
} from "lucide-react";
import { getPlanLabel, getStatusLabel } from "../../utils/labels";

const CHAT_HISTORY_KEY = "accounthub_ai_chat_history_v1";

function removeVietnameseMarks(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

function normalizeQuestion(value = "") {
  return removeVietnameseMarks(value)
    .replace(/[^a-z0-9+@._\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesAny(text, keywords = []) {
  return keywords.some((keyword) => text.includes(normalizeQuestion(keyword)));
}

function countBy(items, field, normalizer = (value) => value || "unknown") {
  return items.reduce((result, item) => {
    const key = normalizer(item[field]);
    result[key] = (result[key] || 0) + 1;
    return result;
  }, {});
}

function normalizeStatus(status) {
  if (status === "in_use") return "active";
  if (status === "old") return "expired";
  if (status === "lost") return "disabled";
  return status || "new";
}

function sameName(a, b) {
  return (
    String(a || "")
      .trim()
      .toLowerCase() ===
    String(b || "")
      .trim()
      .toLowerCase()
  );
}

function getMyRequest(account, visitorName, visitorId) {
  return (account?.accessRequests || []).find((request) => {
    if (
      visitorId &&
      request.requesterVisitorId &&
      request.requesterVisitorId === visitorId
    )
      return true;
    return visitorName && sameName(request.requesterName, visitorName);
  });
}

function buildNavigationMap(isAdmin) {
  return [
    {
      key: "dashboard",
      title: "Tổng quan",
      keywords: ["tong quan", "dashboard", "thong ke", "trang chu", "home"],
      location: "Sidebar bên trái → Tổng quan",
      note: "Xem số lượng tài khoản, trạng thái nhanh và các tài khoản mới cập nhật.",
    },
    {
      key: "accounts",
      title: "Quản lý tài khoản",
      keywords: [
        "quan ly tai khoan",
        "danh sach",
        "tai khoan",
        "mat khau",
        "xem pass",
        "email",
        "mail dang nhap",
      ],
      location: "Sidebar bên trái → Quản lý tài khoản",
      note: "Xem danh sách tài khoản, bấm mắt để xem email/mật khẩu nếu có quyền, hoặc bấm Xin quyền.",
    },
    {
      key: "guide",
      title: "Hướng dẫn sử dụng",
      keywords: [
        "huong dan",
        "cach dung",
        "cach su dung",
        "xin quyen",
        "help",
        "guide",
      ],
      location: "Sidebar bên trái → Hướng dẫn sử dụng",
      note: "Giải thích luồng xin quyền, các mục bị khóa và quyền của user/admin.",
    },
    {
      key: "services",
      title: "Gói dịch vụ",
      keywords: ["goi dich vu", "plus", "pro", "team", "enterprise", "goi"],
      location: "Sidebar bên trái → Gói dịch vụ",
      note: "Lọc và xem phân bổ gói Free/Plus/Pro/Team/Enterprise.",
    },
    {
      key: "otp",
      title: "Manager OTP",
      keywords: [
        "manager otp",
        "otp",
        "ma otp",
        "get otp",
        "lich su otp",
        "cau hinh mail",
        "imap",
      ],
      location: "Sidebar bên trái → Manager OTP",
      note: isAdmin
        ? "Chỉ admin mở được trang này để xem lịch sử OTP và cấu hình mail. User thường lấy OTP trong khung xem mật khẩu của tài khoản đã được cấp quyền."
        : "Mục này bị khóa với user thường. Bạn vẫn có thể bấm Get OTP trong khung xem mật khẩu nếu tài khoản đó đã được admin cấp quyền.",
    },
    {
      key: "activity",
      title: "Nhật ký hoạt động",
      keywords: ["nhat ky", "log", "lich su", "activity", "audit"],
      location: "Sidebar bên trái → Nhật ký hoạt động",
      note: isAdmin
        ? "Admin xem toàn bộ log hệ thống."
        : "User thường chỉ xem log liên quan đến chính hồ sơ của mình.",
    },
    {
      key: "settings",
      title: "Cài đặt hệ thống",
      keywords: [
        "cai dat",
        "settings",
        "doi ten",
        "ten hien thi",
        "giao dien",
        "filter",
      ],
      location: "Sidebar bên trái → Cài đặt hệ thống",
      note: "Đổi tên hiển thị và tuỳ chọn riêng theo người dùng. Dữ liệu lưu theo hồ sơ MongoDB.",
    },
    {
      key: "admins",
      title: "Quản lý Admin",
      keywords: [
        "admin",
        "quan ly admin",
        "duyet quyen",
        "cap quyen",
        "thu hoi",
        "tu choi",
        "xoa khoi list",
      ],
      location: "Sidebar bên trái → Quản lý Admin",
      note: isAdmin
        ? "Duyệt, từ chối, thu hồi quyền từng tài khoản. Khi thu hồi có thể nhập lý do gửi cho user."
        : "Mục này bị khóa, chỉ admin tổng mở được.",
    },
    {
      key: "security",
      title: "Bảo mật",
      keywords: ["bao mat", "security", "risk", "fingerprint", "ip", "may"],
      location: "Sidebar bên trái → Bảo mật",
      note: isAdmin
        ? "Xem checklist bảo mật và các cảnh báo rủi ro."
        : "Mục này chỉ mở cho admin.",
    },
    {
      key: "backup",
      title: "Sao lưu dữ liệu",
      keywords: [
        "backup",
        "sao luu",
        "xuat du lieu",
        "import",
        "export",
        "khoi phuc",
      ],
      location: "Sidebar bên trái → Sao lưu dữ liệu",
      note: isAdmin
        ? "Xuất/nhập dữ liệu hệ thống."
        : "Mục này bị khóa để bảo vệ dữ liệu nhạy cảm.",
    },
    {
      key: "notifications",
      title: "Thông báo",
      keywords: ["thong bao", "notification", "badge", "chuong", "tin nhan"],
      location:
        "Sidebar bên trái → Thông báo hoặc biểu tượng chuông trên topbar",
      note: "Xem thông báo cấp quyền, thu hồi quyền, cảnh báo hạn gói. Badge sẽ mất sau khi bạn mở trang thông báo.",
    },
    {
      key: "create",
      title: "Thêm tài khoản",
      keywords: ["them tai khoan", "tao tai khoan", "add account", "create"],
      location: "Sidebar bên trái → Thêm tài khoản",
      note: isAdmin
        ? "Chỉ admin thêm tài khoản mới."
        : "Mục này bị khóa ở chế độ user thường.",
    },
  ];
}

function formatAccountSnapshot(accounts, stats) {
  const byPlan = stats?.byPlan || countBy(accounts, "planVersion");
  const byStatus =
    stats?.byStatus || countBy(accounts, "status", normalizeStatus);
  const plans =
    Object.entries(byPlan)
      .filter(([, count]) => count > 0)
      .map(([plan, count]) => `${getPlanLabel(plan)}: ${count}`)
      .join(" · ") || "chưa có dữ liệu gói";
  const statuses =
    Object.entries(byStatus)
      .filter(([, count]) => count > 0)
      .map(([status, count]) => `${getStatusLabel(status)}: ${count}`)
      .join(" · ") || "chưa có dữ liệu trạng thái";

  return `Hiện có ${stats?.total || accounts.length || 0} tài khoản. Theo gói: ${plans}. Theo trạng thái: ${statuses}.`;
}

function answerQuestion(question, context) {
  const text = normalizeQuestion(question);
  const {
    isAdmin,
    visitorName,
    visitorId,
    activePage,
    accounts,
    stats,
    notificationCount,
    onNavigate,
  } = context;

  const navigationMap = buildNavigationMap(isAdmin);
  const matchedNav = navigationMap.find((item) =>
    includesAny(text, item.keywords),
  );
  const pendingRequests = accounts.flatMap((account) =>
    (account.accessRequests || [])
      .filter(
        (request) => request.status === "pending" && !request.hiddenFromAdmin,
      )
      .map((request) => ({ account, request })),
  );
  const myApprovedAccounts = accounts.filter(
    (account) =>
      getMyRequest(account, visitorName, visitorId)?.status === "approved",
  );
  const myPendingAccounts = accounts.filter(
    (account) =>
      getMyRequest(account, visitorName, visitorId)?.status === "pending",
  );

  if (!text) {
    return {
      text: "Bạn nhập câu hỏi vào ô chat, mình sẽ chỉ vị trí chức năng và cách thao tác trong web.",
      actions: [],
    };
  }

  if (
    includesAny(text, [
      "ban la ai",
      "ai la gi",
      "chatbot",
      "tro ly",
      "assistant",
    ])
  ) {
    return {
      text: "Mình là trợ lý hướng dẫn nội bộ của AccountHub. Mình trả lời dựa trên cấu trúc web hiện tại: quản lý tài khoản, xin quyền, OTP, thông báo, cài đặt, backup, bảo mật và các mục trong sidebar.",
      actions: [{ label: "Mở hướng dẫn", page: "guide" }],
    };
  }

  if (
    includesAny(text, [
      "o dau",
      "vi tri",
      "nam dau",
      "tim dau",
      "muc nao",
      "nut nao",
      "sidebar",
      "menu",
    ])
  ) {
    if (matchedNav) {
      return {
        text: `${matchedNav.title} nằm ở: ${matchedNav.location}. ${matchedNav.note}`,
        actions: [{ label: `Mở ${matchedNav.title}`, page: matchedNav.key }],
      };
    }
    return {
      text: "Các mục chính đều nằm ở sidebar bên trái. Những mục có biểu tượng khóa như Quản lý Admin, Bảo mật, Sao lưu dữ liệu, Manager OTP và Thêm tài khoản chỉ mở khi đăng nhập admin.",
      actions: [{ label: "Mở hướng dẫn", page: "guide" }],
    };
  }

  if (matchedNav) {
    return {
      text: `${matchedNav.location}. ${matchedNav.note}`,
      actions: [{ label: `Đi tới ${matchedNav.title}`, page: matchedNav.key }],
    };
  }

  if (
    includesAny(text, [
      "lam sao xin quyen",
      "xin quyen nhu nao",
      "cap quyen nhu nao",
      "duoc cap quyen",
      "quyen truy cap",
    ])
  ) {
    return {
      text: "Cách xin quyền: vào Quản lý tài khoản → tìm đúng tài khoản cần dùng → bấm Xin quyền. Admin sẽ duyệt ở Quản lý Admin. Khi được cấp quyền, bạn bấm mắt để xem email/mật khẩu, lấy OTP nếu cần, và chỉ được sửa trạng thái của tài khoản đó.",
      actions: [
        { label: "Mở Quản lý tài khoản", page: "accounts" },
        { label: "Xem hướng dẫn", page: "guide" },
      ],
    };
  }

  if (
    includesAny(text, [
      "lay otp",
      "get otp",
      "ma otp",
      "otp moi",
      "copy otp",
      "ma xac minh",
    ])
  ) {
    return {
      text: isAdmin
        ? "User lấy OTP bằng cách mở tài khoản đã có quyền → bấm mắt xem email/mật khẩu → bấm Get OTP. Admin có thêm Manager OTP để xem lịch sử và cấu hình mail. Backend check đúng người nhận có dạng email+tag@gmail.com, kể cả phần +tag."
        : "Bạn cần được cấp quyền đúng tài khoản trước. Sau đó vào Quản lý tài khoản → bấm mắt → bấm Get OTP trong khung xem mật khẩu. Manager OTP ở sidebar chỉ dành cho admin.",
      actions: [
        { label: "Mở Quản lý tài khoản", page: "accounts" },
        ...(isAdmin ? [{ label: "Mở Manager OTP", page: "otp" }] : []),
      ],
    };
  }

  if (
    includesAny(text, [
      "mat khau",
      "xem pass",
      "password",
      "email that",
      "mail that",
      "an mail",
    ])
  ) {
    return {
      text: "Để xem email thật và mật khẩu: vào Quản lý tài khoản → bấm biểu tượng mắt ở dòng tài khoản. Nếu bạn không phải admin, tài khoản đó phải được admin cấp quyền trước. Email trong bảng được che một phần để bảo mật.",
      actions: [{ label: "Mở Quản lý tài khoản", page: "accounts" }],
    };
  }

  if (
    includesAny(text, [
      "done",
      "da dang nhap",
      "chu so huu",
      "owner",
      "ten chu so huu",
    ])
  ) {
    return {
      text: "Chủ sở hữu mặc định là admin. Sau khi admin cấp quyền, user lấy OTP và bấm Done đã đăng nhập thì chủ sở hữu mới chuyển sang tên user. Nếu admin thu hồi quyền, chủ sở hữu sẽ quay lại tài khoản admin.",
      actions: [{ label: "Mở hướng dẫn", page: "guide" }],
    };
  }

  if (
    includesAny(text, [
      "thu hoi",
      "tu choi",
      "xoa khoi list",
      "ly do",
      "reason",
    ])
  ) {
    return {
      text: "Trong Quản lý Admin, admin có thể cấp quyền, từ chối, thu hồi hoặc xóa khỏi list. Theo logic hiện tại, chỉ khi thu hồi quyền mới hiện bảng nhập lý do để gửi cho người dùng.",
      actions: isAdmin
        ? [{ label: "Mở Quản lý Admin", page: "admins" }]
        : [{ label: "Mở thông báo", page: "notifications" }],
    };
  }

  if (
    includesAny(text, [
      "fingerprint",
      "ip",
      "may",
      "thiet bi",
      "mang",
      "loi dung",
      "nhieu tai khoan",
      "risk",
    ])
  ) {
    return {
      text: "Khi user xin quyền, backend lưu thông tin IP, prefix mạng, user-agent, fingerprint, timezone, platform và màn hình vào MongoDB. Admin xem các dấu hiệu này ở Quản lý Admin để tránh người dùng lợi dụng nhiều tài khoản.",
      actions: isAdmin
        ? [{ label: "Mở Quản lý Admin", page: "admins" }]
        : [{ label: "Mở hướng dẫn", page: "guide" }],
    };
  }

  if (
    includesAny(text, [
      "doi ten",
      "ten hien thi",
      "profile",
      "ho so",
      "cai dat",
    ])
  ) {
    return {
      text: "Đổi tên ở Cài đặt hệ thống chỉ đổi tên hiển thị của hồ sơ người dùng. Nếu tài khoản đã được user bấm Done sau khi lấy OTP, chủ sở hữu sẽ đồng bộ theo tên mới. Các quyền vẫn bám theo visitorId nên đổi tên không làm mất quyền.",
      actions: [{ label: "Mở Cài đặt", page: "settings" }],
    };
  }

  if (
    includesAny(text, ["thong bao", "chuong", "badge", "tin nhan", "da xem"])
  ) {
    return {
      text: `Bạn có ${notificationCount || 0} thông báo chưa xem. Thông báo nằm ở sidebar hoặc nút chuông trên topbar. Khi mở trang Thông báo, badge sẽ được đánh dấu đã xem theo hồ sơ MongoDB của bạn.`,
      actions: [{ label: "Mở Thông báo", page: "notifications" }],
    };
  }

  if (
    includesAny(text, [
      "bao nhieu",
      "thong ke",
      "tong tai khoan",
      "so luong",
      "plus",
      "pro",
      "active",
      "expired",
      "new",
    ])
  ) {
    return {
      text: formatAccountSnapshot(accounts, stats),
      actions: [
        { label: "Mở Tổng quan", page: "dashboard" },
        { label: "Mở Gói dịch vụ", page: "services" },
      ],
    };
  }

  if (
    includesAny(text, [
      "mongo",
      "mongodb",
      "luu du lieu",
      "database",
      "localstorage",
      "du lieu luu dau",
    ])
  ) {
    return {
      text: "Dữ liệu nghiệp vụ lưu trong MongoDB: tài khoản, quyền, tên người dùng, cài đặt, thông báo đã xem, cấu hình mail, lịch sử OTP và nhật ký hoạt động. visitor/admin session dùng httpOnly cookie; localStorage chỉ giữ lịch sử chatbox không nhạy cảm.",
      actions: [{ label: "Mở Sao lưu", page: isAdmin ? "backup" : "guide" }],
    };
  }

  if (
    includesAny(text, [
      "sao luu",
      "backup",
      "xuat",
      "nhap",
      "restore",
      "import",
      "export",
    ])
  ) {
    return {
      text: isAdmin
        ? "Sao lưu dữ liệu nằm ở sidebar → Sao lưu dữ liệu. Admin có thể export/import dữ liệu chính của hệ thống."
        : "Sao lưu dữ liệu bị khóa với user thường để tránh lộ dữ liệu nhạy cảm. Bạn cần đăng nhập admin tổng để dùng tính năng này.",
      actions: [
        {
          label: isAdmin ? "Mở Sao lưu" : "Mở Hướng dẫn",
          page: isAdmin ? "backup" : "guide",
        },
      ],
    };
  }

  if (
    includesAny(text, [
      "admin",
      "dang nhap admin",
      "mat khau admin",
      "logout",
      "dang xuat",
    ])
  ) {
    return {
      text: "Admin tổng đăng nhập ở màn hình khóa ban đầu. Khi đã đăng nhập, phiên admin được giữ bằng httpOnly cookie cho đến khi hết hạn hoặc bấm Đăng xuất. Các mục khóa như Manager OTP, Quản lý Admin, Bảo mật, Sao lưu và Thêm tài khoản sẽ mở cho admin.",
      actions: [{ label: "Mở hướng dẫn", page: "guide" }],
    };
  }

  if (
    includesAny(text, [
      "toi co quyen khong",
      "quyen cua toi",
      "tai khoan cua toi",
      "dang cho duyet",
      "approved",
      "pending",
    ])
  ) {
    return {
      text: `Quyền hiện tại của bạn: ${myApprovedAccounts.length} tài khoản đã được cấp quyền, ${myPendingAccounts.length} yêu cầu đang chờ duyệt. ${isAdmin ? `Admin đang thấy ${pendingRequests.length} yêu cầu chờ duyệt.` : "Bạn có thể xem chi tiết ở Quản lý tài khoản hoặc Thông báo."}`,
      actions: [
        { label: "Mở Quản lý tài khoản", page: "accounts" },
        { label: "Mở Thông báo", page: "notifications" },
      ],
    };
  }

  return {
    text: "Mình chưa chắc câu này thuộc mục nào. Bạn có thể hỏi theo dạng: ‘Get OTP ở đâu?’, ‘cách xin quyền?’, ‘đổi tên ở đâu?’, ‘Manager OTP dùng sao?’, ‘chủ sở hữu đổi khi nào?’. Mình sẽ chỉ đúng vị trí trong sidebar và cách thao tác.",
    actions: [
      { label: "Mở Hướng dẫn", page: "guide" },
      { label: "Mở Quản lý tài khoản", page: "accounts" },
    ],
  };
}

function buildWelcomeMessage(visitorName, activePage) {
  return {
    id: "welcome",
    role: "assistant",
    text: `Xin chào ${visitorName || "bạn"}! Mình là AI hướng dẫn AccountHub. Bạn đang ở mục ${activePage}. Hỏi mình về vị trí nút, cách xin quyền, lấy OTP, thông báo, cài đặt hoặc quyền admin nha.`,
    createdAt: new Date().toISOString(),
  };
}

function MessageBubble({ message, onAction, onCopy }) {
  const isUser = message.role === "user";
  return (
    <div className={`ai-message-row ${isUser ? "user" : "assistant"}`}>
      {!isUser && (
        <span className="ai-avatar">
          <Bot size={16} />
        </span>
      )}
      <div className="ai-message-bubble">
        <p>{message.text}</p>
        {message.actions?.length > 0 && (
          <div className="ai-action-row">
            {message.actions.map((action) => (
              <button
                key={`${message.id}-${action.label}`}
                type="button"
                onClick={() => onAction?.(action.page)}
              >
                <Navigation size={13} /> {action.label}
              </button>
            ))}
          </div>
        )}
        {!isUser && (
          <button
            className="ai-copy-answer"
            type="button"
            onClick={() => onCopy(message.text)}
            title="Copy câu trả lời"
          >
            <Copy size={12} /> Copy
          </button>
        )}
      </div>
    </div>
  );
}

export default function AiChatBox({
  activePage,
  isAdmin,
  visitorName,
  visitorId,
  accounts = [],
  stats = {},
  notificationCount = 0,
  onNavigate,
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [messages, setMessages] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(CHAT_HISTORY_KEY) || "[]");
      if (Array.isArray(stored) && stored.length) return stored.slice(-20);
    } catch {}
    return [buildWelcomeMessage(visitorName, activePage)];
  });

  const bodyRef = useRef(null);
  const inputRef = useRef(null);

  const quickQuestions = useMemo(
    () => [
      "Cách xin quyền?",
      "Get OTP ở đâu?",
      "Chủ sở hữu đổi khi nào?",
      "Manager OTP dùng sao?",
      "Thông báo ở đâu?",
      "Dữ liệu lưu ở đâu?",
    ],
    [],
  );

  useEffect(() => {
    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(messages.slice(-30)));
  }, [messages]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!bodyRef.current) return;
    bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages, open]);

  function pushQuestion(value) {
    const clean = String(value || "").trim();
    if (!clean) return;

    const userMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: clean,
      createdAt: new Date().toISOString(),
    };

    const answer = answerQuestion(clean, {
      isAdmin,
      visitorName,
      visitorId,
      activePage,
      accounts,
      stats,
      notificationCount,
      onNavigate,
    });

    const botMessage = {
      id: `bot-${Date.now() + 1}`,
      role: "assistant",
      text: answer.text,
      actions: answer.actions,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage, botMessage].slice(-30));
    setInput("");
  }

  function handleSubmit(event) {
    event.preventDefault();
    pushQuestion(input);
  }

  async function copyAnswer(text) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  function handleAction(page) {
    if (!page) return;
    onNavigate?.(page);
    setOpen(false);
  }

  function resetChat() {
    const next = [buildWelcomeMessage(visitorName, activePage)];
    setMessages(next);
    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(next));
  }

  return (
    <div className={`ai-chatbox ${open ? "open" : "closed"}`}>
      {open && (
        <section className="ai-chat-panel" aria-label="AccountHub AI chatbox">
          <header className="ai-chat-header">
            <div>
              <span className="ai-header-icon">
                <Sparkles size={18} />
              </span>
              <div>
                <strong>AccountHub AI</strong>
                <small>Hỏi cách dùng web, vị trí nút, quyền, OTP</small>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Thu nhỏ chatbox"
            >
              <ChevronDown size={18} />
            </button>
          </header>

          <div className="ai-context-strip">
            <span>
              <UserCheck size={13} /> {visitorName || "User"}
            </span>
            <span>
              {isAdmin ? <ShieldCheck size={13} /> : <Lock size={13} />}{" "}
              {isAdmin ? "ADMIN" : "USER"}
            </span>
            <span>
              <Database size={13} /> {stats?.total || accounts.length || 0} acc
            </span>
          </div>

          <div className="ai-chat-body" ref={bodyRef}>
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                onAction={handleAction}
                onCopy={copyAnswer}
              />
            ))}
          </div>

          <div className="ai-quick-grid">
            {quickQuestions.map((question) => (
              <button
                key={question}
                type="button"
                onClick={() => pushQuestion(question)}
              >
                {question}
              </button>
            ))}
          </div>

          {copied && (
            <div className="ai-copied-toast">
              <CheckCircle2 size={14} /> Đã copy câu trả lời
            </div>
          )}

          <form className="ai-chat-form" onSubmit={handleSubmit}>
            <input
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Hỏi: Get OTP ở đâu, cách xin quyền..."
              aria-label="Nhập câu hỏi cho AI"
            />
            <button type="submit" aria-label="Gửi câu hỏi">
              <Send size={17} />
            </button>
          </form>

          <footer className="ai-chat-footer">
            <button type="button" onClick={resetChat}>
              Xóa chat
            </button>
            <span>AI nội bộ · không thay đổi dữ liệu hệ thống</span>
          </footer>
        </section>
      )}

      <button
        className="ai-chat-launcher"
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Mở AI chatbox"
      >
        {open ? <X size={22} /> : <MessageCircle size={25} />}
        {!open && <span>AI</span>}
      </button>
    </div>
  );
}
