type Severity = "BLOCKER" | "WARN";

type Finding = {
  severity: Severity;
  key: string;
  message: string;
};

const findings: Finding[] = [];

function required(key: string, message?: string) {
  if (!process.env[key]) {
    findings.push({
      severity: "BLOCKER",
      key,
      message: message || `${key} is required for production payment processing`,
    });
  }
}

function warn(key: string, message: string) {
  if (!process.env[key]) {
    findings.push({ severity: "WARN", key, message });
  }
}

required("DATABASE_URL");
required("PHONEPE_CLIENT_ID", "PhonePe OAuth client id is required");
required("PHONEPE_CLIENT_SECRET", "PhonePe OAuth client secret is required");
required("PHONEPE_WEBHOOK_USERNAME", "PhonePe webhook username is required; webhook must fail closed");
required("PHONEPE_WEBHOOK_PASSWORD", "PhonePe webhook password is required; webhook must fail closed");
required("NEXT_PUBLIC_APP_URL", "Public backend URL is required for PhonePe callback/webhook context");
required("CRON_SECRET", "Cron secret is required so reconciliation endpoints are not publicly executable");

warn("PHONEPE_CLIENT_VERSION", "PhonePe client version defaults to 1; set it explicitly for production");
warn("PHONEPE_REDIRECT_URL", "Explicit PhonePe redirect URL is recommended for production payment returns");
warn("NEXT_PUBLIC_FRONTEND_URL", "Frontend URL is recommended for safe payment return redirects");
warn("HMS_FINANCIAL_OWNER_ID", "Set HMS financial owner id for clearer PlatformBilling audit metadata");

if ((process.env.PHONEPE_ENV || "").toLowerCase() !== "production") {
  findings.push({
    severity: "BLOCKER",
    key: "PHONEPE_ENV",
    message: "PHONEPE_ENV must be production for live rollout",
  });
}

for (const key of ["NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_FRONTEND_URL", "PHONEPE_REDIRECT_URL"]) {
  const value = process.env[key];
  if (value && !/^https:\/\//i.test(value)) {
    findings.push({
      severity: "BLOCKER",
      key,
      message: `${key} must use https:// in production`,
    });
  }
}

const blockerCount = findings.filter((f) => f.severity === "BLOCKER").length;
const warnCount = findings.filter((f) => f.severity === "WARN").length;

console.log(JSON.stringify({
  checked_at: new Date().toISOString(),
  ready: blockerCount === 0,
  blockers: blockerCount,
  warnings: warnCount,
  findings,
}, null, 2));

if (blockerCount > 0) process.exitCode = 1;
