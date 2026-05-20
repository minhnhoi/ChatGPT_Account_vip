export const STATUS_OPTIONS = [
  { value: "new", label: "New", className: "status-new" },
  { value: "active", label: "Active", className: "status-active" },
  { value: "expired", label: "Expired", className: "status-expired" },
  { value: "disabled", label: "Disabled", className: "status-disabled" },
  { value: "archived", label: "Archived", className: "status-archived" },
];

const STATUS_ALIASES = {
  in_use: { label: "Active", className: "status-active" },
  old: { label: "Expired", className: "status-expired" },
  lost: { label: "Disabled", className: "status-disabled" },
};

export const PLAN_OPTIONS = [
  { value: "free", label: "Free" },
  { value: "plus", label: "Plus" },
  { value: "pro", label: "Pro" },
  { value: "team", label: "Team" },
  { value: "enterprise", label: "Enterprise" },
  { value: "other", label: "Khác" },
];

export function getStatusLabel(value) {
  return (
    STATUS_OPTIONS.find((item) => item.value === value)?.label ||
    STATUS_ALIASES[value]?.label ||
    value
  );
}

export function getStatusClassName(value) {
  return (
    STATUS_OPTIONS.find((item) => item.value === value)?.className ||
    STATUS_ALIASES[value]?.className ||
    "status-archived"
  );
}

export function getPlanLabel(value) {
  return PLAN_OPTIONS.find((item) => item.value === value)?.label || value;
}
