import { prisma } from "../../../lib/db";
import { hashPassword } from "../../../lib/auth";
import { normalizeIndianPhone } from "../../../lib/utils/phone-utils";
import { getTenantOperationalContext } from "../../../lib/hostel-context";
import { allocationReconciliationService } from "../../../lib/services/allocation-reconciliation-service";
import { eventLog } from "../../../lib/services/event-log-service";

type ActivationStep = "ACCOUNT" | "RULES" | "PROFILE" | "ACTIVATE";
type ResolvedInvitation = { profile: any; tenant: any; token: string };

const REQUIRED_ACKNOWLEDGEMENTS = [
  "fee_refund_rules",
  "discipline_policies",
  "late_fee_obligations",
  "damage_liabilities",
  "hostel_rules",
] as const;

const DEFAULT_RULE_CONTENT = {
  categories: [
    {
      id: "payments",
      title: "1. Fee Structure & Payment Policy",
      severity: "important",
      icon: "receipt",
      highlights: [
        "Hostel fee is applicable only for the academic year period of 12 months.",
        "Hostel fees once paid are strictly non-refundable and non-adjustable under any circumstances.",
        "If GST becomes applicable as per government regulations, additional GST charges will be added to the hostel fee."
      ],
      rules: [
        "Students are required to pay 3 months hostel fee in advance at the time of joining.",
        "Any delay in fee payment will attract a late fee of ₹50 per day."
      ],
    },
    {
      id: "facilities",
      title: "2. Accommodation & Hostel Facilities",
      severity: "standard",
      icon: "wifi",
      highlights: [
        "The hostel management is responsible only for providing Accommodation, Breakfast, Lunch, and Dinner.",
        "Facilities such as Internet/Wi-Fi, Washing machines, and Hot water are provided free of cost and may face occasional interruptions or maintenance delays.",
        "Hostel premises will remain closed during major college holidays and festival vacations (Semester Holidays, Dussehra, Sankranthi, etc.). Students must vacate during these periods."
      ],
      rules: [
        "Complaints regarding internet or washing machine issues may take up to 10 days for resolution.",
        "Hostel rooms may be reshuffled under unavoidable or operational circumstances. Allocation of the same room throughout the year is not guaranteed.",
        "Visitors who wish to stay in the hostel must pay ₹500 per day, subject to management approval."
      ],
    },
    {
      id: "discipline",
      title: "3. Discipline & Conduct",
      severity: "critical",
      icon: "shield",
      highlights: [
        "Smoking, alcohol consumption, illegal activities, violence, or misconduct inside the hostel premises are strictly prohibited.",
        "Ragging in any form is strictly prohibited. Involved students will be immediately removed without any fee refund."
      ],
      rules: [
        "Students must maintain proper discipline and respectful behavior inside the hostel premises at all times.",
        "Outsiders, friends, parents, or visitors are not allowed inside hostel rooms. Visitors may wait only in the office area or front lobby.",
        "Hostel gate closes strictly at 9:30 PM every day.",
        "Students leaving the hostel premises must inform the management through WhatsApp message as proof and record.",
        "Food is not allowed inside hostel rooms. Students must use the dining hall for meals."
      ],
    },
    {
      id: "safety",
      title: "4. Safety & Responsibility",
      severity: "important",
      icon: "lock",
      highlights: [
        "Students are fully responsible for their personal belongings (Mobile phones, Laptops, Gold, Cash, Certificates, etc.).",
        "Use of electrical appliances such as iron boxes, water heaters, micro-ovens, or inflammable items is strictly prohibited inside rooms."
      ],
      rules: [
        "The hostel management is not responsible for theft, loss, damage, injuries, accidents, personal disputes, or matters occurring outside hostel responsibility.",
        "Students found using prohibited appliances will be charged a fine of ₹1000.",
        "Any damage caused to hostel property (beds, mattresses, lockers, furniture, fittings, etc.) must be repaired or compensated by the student(s) responsible."
      ],
    },
    {
      id: "vacating",
      title: "5. Vacating & Maintenance Charges",
      severity: "important",
      icon: "door-open",
      highlights: [
        "No refund will be provided for early vacating under any circumstances."
      ],
      rules: [
        "If a student vacates the hostel during the academic year, hostel charges will be recalculated at ₹12,000 per month for the occupied duration.",
        "Students vacating the hostel during the academic year must additionally pay ₹1400 as maintenance charges."
      ],
    },
    {
      id: "rights",
      title: "6. Management Rights",
      severity: "standard",
      icon: "shield",
      highlights: [
        "Decisions made by hostel management regarding hostel administration, discipline, and accommodation shall be final and binding."
      ],
      rules: [
        "The hostel management reserves the full right to discontinue hostel accommodation for any student involved in misconduct, indiscipline, rule violations, or behavior affecting hostel operations."
      ],
    }
  ],
  acknowledgements: REQUIRED_ACKNOWLEDGEMENTS,
};

function dateOnly(value?: Date | string | null) {
  if (!value) return null;
  return new Date(value).toISOString().slice(0, 10);
}

function numberValue(value: unknown) {
  if (value == null) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function nextRentDate(autoRentDay = 1) {
  const now = new Date();
  const day = Math.min(Math.max(Number(autoRentDay || 1), 1), 28);
  const candidate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), day));
  if (candidate <= now) return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, day));
  return candidate;
}

function parsePrefsFacilities(prefs: any) {
  const candidates = [
    prefs?.facilities,
    prefs?.included_facilities,
    prefs?.amenities,
    prefs?.hostel_facilities,
  ];
  for (const value of candidates) {
    if (Array.isArray(value)) return value.map(String).filter(Boolean);
  }
  return [];
}

function validDateOfBirth(value: unknown) {
  if (!value) return null;
  const dob = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  if (dob >= now) return null;
  if (dob.getUTCFullYear() < 1900) return null;
  return dob;
}

function compactObject<T extends Record<string, any>>(input: T) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as Partial<T>;
}

export class ActivationWorkflowService {
  private async resolveInvitation(token: string): Promise<ResolvedInvitation> {
    const normalizedToken = String(token || "").trim();
    if (!normalizedToken) throw new Error("VALIDATION_ERROR: Activation token is required");

    const profile = await prisma.profile.findFirst({
      where: {
        invitation_token: normalizedToken,
        invitation_expires_at: { gte: new Date() },
        role: "TENANT",
      },
      include: {
        tenants: {
          include: {
            hostels: {
              include: {
                profiles: { select: { id: true, name: true, phone: true, email: true } },
              },
            },
            room_allocations: {
              where: { is_active: true, end_date: null },
              orderBy: { start_date: "desc" },
              take: 1,
              include: { room: true },
            },
            identification_documents: {
              where: { is_active: true },
              orderBy: { created_at: "desc" },
            },
            rule_acceptances: {
              orderBy: { accepted_at: "desc" },
              take: 5,
              include: { rule_version: true },
            },
          },
        },
      },
    });

    if (!profile || !profile.tenants) {
      const anyProfile = await prisma.profile.findFirst({
        where: { invitation_token: normalizedToken, role: "TENANT" },
        include: { tenants: true },
      });
      if (anyProfile?.tenants?.status === "ACTIVE") throw new Error("ALREADY_ACTIVE: Account already active");
      if (anyProfile?.tenants?.status === "CANCELLED") throw new Error("CANCELLED: Invitation was cancelled");
      if (anyProfile?.tenants?.status === "EXPIRED") {
        await eventLog.log("expired_invite_rate", anyProfile.tenants.owner_id || null, { tenant_id: anyProfile.tenants.id }, anyProfile.tenants.id);
        throw new Error("EXPIRED: Invitation expired");
      }
      if (anyProfile?.invitation_expires_at && anyProfile.invitation_expires_at < new Date()) {
        if (anyProfile.tenants) {
          await eventLog.log("expired_invite_rate", anyProfile.tenants.owner_id || null, { tenant_id: anyProfile.tenants.id }, anyProfile.tenants.id);
        }
        throw new Error("EXPIRED: Invitation expired");
      }
      throw new Error("INVALID: Activation link expired or already used");
    }
    if (profile.tenants.status === "ACTIVE") throw new Error("ALREADY_ACTIVE: Account already active");
    if (profile.tenants.status === "CANCELLED") throw new Error("CANCELLED: Invitation was cancelled");
    if (profile.tenants.status === "EXPIRED") throw new Error("EXPIRED: Invitation expired");
    if (profile.tenants.status !== "INVITED") {
      throw new Error("INVALID: Activation is not available for this tenant");
    }
    return { profile, tenant: profile.tenants, token: normalizedToken };
  }

  private async markActivity(tenant: any, eventType: string, metadata: Record<string, any> = {}) {
    const isFirstStart = !tenant.activation_started_at;
    await prisma.tenants.update({
      where: { id: tenant.id },
      data: {
        onboarding_last_activity_at: new Date(),
        ...(tenant.activation_started_at ? {} : { activation_started_at: new Date() }),
      },
    }).catch(() => undefined);

    if (eventType === "activation_started" && !isFirstStart) return;

    await eventLog.log(eventType, tenant.owner_id || null, {
      tenant_id: tenant.id,
      hostel_id: tenant.hostel_id,
      ...metadata,
    }, tenant.id);
  }

  private async getActiveRuleVersion(hostelId: string) {
    const existing = await prisma.ruleVersion.findFirst({
      where: {
        hostel_id: hostelId,
        OR: [{ is_active: true }, { active: true }],
      },
      orderBy: { created_at: "desc" },
    });
    if (existing) return existing;

    const version = `default-${new Date().toISOString().slice(0, 10)}`;
    return prisma.ruleVersion.create({
      data: {
        hostel_id: hostelId,
        version,
        title: "Standard Hostel Rules",
        content: DEFAULT_RULE_CONTENT,
        content_snapshot: DEFAULT_RULE_CONTENT,
        is_active: true,
        active: true,
      },
    });
  }

  private rulePayload(ruleVersion: any) {
    const content = ruleVersion.content ?? ruleVersion.content_snapshot ?? DEFAULT_RULE_CONTENT;
    return {
      id: ruleVersion.id,
      version: ruleVersion.version,
      title: ruleVersion.title ?? "Standard Hostel Rules",
      content,
      required_acknowledgements: REQUIRED_ACKNOWLEDGEMENTS,
    };
  }

  private computeState(profile: any, tenant: any, ruleVersion: any) {
    const latestAcceptance = (tenant.rule_acceptances || []).find((a: any) => a.rule_version_id === ruleVersion.id);
    const accountSetupCompleted = Boolean(profile.password_hash && (tenant.phone_1 || profile.phone));
    const missingTier1: string[] = [];
    if (!(tenant.phone_1 || profile.phone)) missingTier1.push("phone");
    if (!tenant.gender) missingTier1.push("gender");
    if (!tenant.date_of_birth) missingTier1.push("date_of_birth");
    if (!tenant.phone_3) missingTier1.push("emergency_phone");
    if (!tenant.photo_url) missingTier1.push("photo_url");

    const profileCompleted = missingTier1.length === 0;
    const rulesAccepted = Boolean(latestAcceptance);
    const requiredDocumentTypes = this.requiredDocumentTypes(tenant.profile_type);
    const requiredDocuments = (tenant.identification_documents || []).filter((doc: any) =>
      requiredDocumentTypes.includes(doc.doc_type)
    );
    const documentsUploaded = requiredDocuments.length > 0;
    const activationCompleted = tenant.status === "ACTIVE";
    const startedAt = tenant.activation_started_at || tenant.created_at || null;
    const completedAt = tenant.activation_completed_at || null;
    const durationSeconds = startedAt && completedAt
      ? Math.max(0, Math.round((new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 1000))
      : null;

    const completedSteps: ActivationStep[] = [];
    if (accountSetupCompleted) completedSteps.push("ACCOUNT");
    if (rulesAccepted) completedSteps.push("RULES");
    if (profileCompleted) completedSteps.push("PROFILE");
    if (activationCompleted) completedSteps.push("ACTIVATE");

    let currentStep: ActivationStep = "ACCOUNT";
    if (accountSetupCompleted && !rulesAccepted) currentStep = "RULES";
    else if (accountSetupCompleted && rulesAccepted && !profileCompleted) currentStep = "PROFILE";
    else if (accountSetupCompleted && rulesAccepted && profileCompleted) currentStep = "ACTIVATE";

    return {
      account_setup_completed: accountSetupCompleted,
      rules_accepted: rulesAccepted,
      profile_completed: profileCompleted,
      documents_uploaded: documentsUploaded,
      activation_completed: activationCompleted,
      current_step: currentStep,
      completed_steps: completedSteps,
      blocked_steps: this.blockedSteps({ accountSetupCompleted, rulesAccepted, profileCompleted }),
      missing_fields: {
        tier_1_required: missingTier1,
        tier_2_recommended: this.recommendedMissingFields(tenant),
        tier_3_optional: this.optionalMissingFields(tenant),
      },
      acceptance: latestAcceptance
        ? {
            accepted_at: latestAcceptance.accepted_at,
            rules_version: latestAcceptance.rules_version,
            rule_version_id: latestAcceptance.rule_version_id,
          }
        : null,
      progress_percent: Math.round((completedSteps.length / 4) * 100),
      activation_started_at: startedAt,
      activation_completed_at: completedAt,
      onboarding_last_activity_at: tenant.onboarding_last_activity_at || null,
      activation_duration_seconds: durationSeconds,
    };
  }

  private blockedSteps(flags: { accountSetupCompleted: boolean; rulesAccepted: boolean; profileCompleted: boolean }) {
    const blocked: ActivationStep[] = [];
    if (!flags.accountSetupCompleted) blocked.push("RULES", "PROFILE", "ACTIVATE");
    else if (!flags.rulesAccepted) blocked.push("ACTIVATE");
    if (!flags.profileCompleted) blocked.push("ACTIVATE");
    return Array.from(new Set(blocked));
  }

  private recommendedMissingFields(tenant: any) {
    const missing: string[] = [];
    if (!tenant.permanent_address) missing.push("permanent_address");
    const profileType = String(tenant.profile_type || "STUDENT").toUpperCase();
    if (profileType === "STUDENT") {
      if (!tenant.college_name) missing.push("college_name");
      if (!tenant.course) missing.push("course");
      if (!tenant.roll_number) missing.push("roll_number");
    } else {
      if (!tenant.office_name) missing.push("office_name");
      if (!tenant.office_location) missing.push("office_location");
      if (!tenant.job_role) missing.push("job_role");
    }
    return missing;
  }

  private optionalMissingFields(tenant: any) {
    return [
      !tenant.photo_url && "photo_url",
      !tenant.phone_2 && "guardian_phone",
      !tenant.phone_3 && "emergency_phone",
      !tenant.guardian_name && "guardian_name",
      !tenant.guardian_relation && "guardian_relation",
    ].filter(Boolean);
  }

  async getContext(token: string) {
    const { profile, tenant } = await this.resolveInvitation(token);
    await this.markActivity(tenant, "activation_started", { source: "context" });
    const hostel = tenant.hostels;
    if (!tenant.hostel_id || !hostel) throw new Error("INTERNAL_ERROR: Tenant hostel context unavailable");
    const ruleVersion = await this.getActiveRuleVersion(tenant.hostel_id);

    let prefs: any = {};
    try {
      prefs = (await getTenantOperationalContext(tenant.id, tenant.owner_id, tenant.hostel_id)).prefs || {};
    } catch {
      prefs = {};
    }

    const activeAllocation = tenant.room_allocations?.[0] || null;
    const room = activeAllocation?.room || null;
    const roommateCount = room
      ? await prisma.roomAllocation.count({
          where: { room_id: room.id, is_active: true, end_date: null, tenant_id: { not: tenant.id } },
        })
      : 0;

    const state = this.computeState(profile, tenant, ruleVersion);
    const requiredDocumentTypes = this.requiredDocumentTypes(tenant.profile_type);
    const requiredDocuments = (tenant.identification_documents || []).filter((doc: any) =>
      requiredDocumentTypes.includes(doc.doc_type)
    );

    return {
      token_status: "VALID",
      activation_state: state,
      current_step: state.current_step,
      completed_steps: state.completed_steps,
      blocked_steps: state.blocked_steps,
      missing_fields: state.missing_fields,
      profile: {
        id: profile.id,
        name: profile.name,
        email: profile.email,
        phone: profile.phone,
      },
      tenant: {
        id: tenant.id,
        profile_type: tenant.profile_type,
        status: tenant.status,
        phone_1: tenant.phone_1,
        phone_2: tenant.phone_2,
        phone_3: tenant.phone_3,
        guardian_name: tenant.guardian_name,
        guardian_phone: tenant.guardian_phone,
        guardian_relation: tenant.guardian_relation,
        gender: tenant.gender,
        date_of_birth: dateOnly(tenant.date_of_birth),
        permanent_address: tenant.permanent_address,
        temporary_address: tenant.temporary_address,
        college_name: tenant.college_name,
        course: tenant.course,
        year_of_study: tenant.year_of_study,
        branch: tenant.branch,
        roll_number: tenant.roll_number,
        office_name: tenant.office_name,
        office_location: tenant.office_location,
        job_role: tenant.job_role,
      },
      hostel: {
        id: hostel.id,
        name: hostel.name,
        logo_url: hostel.logo_url,
        address: [hostel.address, hostel.city, hostel.state, hostel.pincode].filter(Boolean).join(", "),
        phone: hostel.phone,
      },
      room_summary: {
        hostel_name: hostel.name,
        room_number: room?.room_no ?? null,
        floor: room?.floor ?? null,
        capacity: room?.capacity ?? null,
        current_occupancy: room ? roommateCount + 1 : null,
        roommates_count: roommateCount,
        monthly_rent: numberValue(tenant.monthly_rent ?? room?.base_rent),
        maintenance_charge: numberValue(tenant.maintenance_charge),
        maintenance_type: tenant.maintenance_type,
        advance_deposit: numberValue(tenant.advance_deposit),
        billing_start_date: dateOnly(tenant.billing_start_date),
        joining_date: dateOnly(tenant.joined_on),
        payment_due_cycle: hostel.rent_cycle || prefs.rent_cycle || "MONTHLY",
        next_rent_generation_date: dateOnly(nextRentDate(hostel.auto_rent_day || prefs.auto_rent_day || 1)),
        included_facilities: parsePrefsFacilities(prefs),
        wifi_available: Boolean(room?.wifi_name),
      },
      rules: this.rulePayload(ruleVersion),
      documents: {
        uploaded_count: requiredDocuments.length,
        uploaded_types: requiredDocuments.map((d: any) => d.doc_type),
        verification_status: tenant.document_verified ? "VERIFIED" : "PENDING",
        required_after_activation: requiredDocumentTypes,
      },
    };
  }

  private requiredDocumentTypes(profileType?: string | null) {
    return String(profileType || "STUDENT").toUpperCase() === "WORKING_PROFESSIONAL"
      ? ["AADHAAR", "WORK_ID"]
      : ["AADHAAR", "COLLEGE_ID"];
  }

  async mutate(token: string, step: ActivationStep, data: any, context: { ip: string; userAgent: string }) {
    if (!["ACCOUNT", "RULES", "PROFILE", "ACTIVATE"].includes(step)) {
      throw new Error("VALIDATION_ERROR: Unsupported activation step");
    }
    const { profile, tenant } = await this.resolveInvitation(token);
    if (!tenant.hostel_id) throw new Error("INTERNAL_ERROR: Tenant hostel context unavailable");
    const ruleVersion = await this.getActiveRuleVersion(tenant.hostel_id);
    const state = this.computeState(profile, tenant, ruleVersion);
    this.assertTransition(step, state);

    if (step === "ACCOUNT") {
      await this.saveAccount(profile, tenant, data);
    }
    if (step === "RULES") {
      await this.acceptRules(profile, tenant, data, context);
    }
    if (step === "PROFILE") {
      await this.saveProfile(profile, tenant, data);
    }
    if (step === "ACTIVATE") {
      await this.activate(profile, tenant);
      const requiredDocumentTypes = this.requiredDocumentTypes(tenant.profile_type);
      return {
        activation_state: {
          account_setup_completed: true,
          rules_accepted: true,
          profile_completed: true,
          documents_uploaded: (tenant.identification_documents || []).some((doc: any) =>
            requiredDocumentTypes.includes(doc.doc_type)
          ),
          activation_completed: true,
        },
        redirect_to: "/tenant/dashboard",
      };
    }

    return this.getContext(token);
  }

  private assertTransition(step: ActivationStep, state: any) {
    if (step === "RULES" && !state.account_setup_completed) {
      throw new Error("INVALID_TRANSITION: Complete account setup before accepting rules");
    }
    if (step === "PROFILE" && !state.account_setup_completed) {
      throw new Error("INVALID_TRANSITION: Complete account setup before profile completion");
    }
    if (step === "PROFILE" && !state.rules_accepted) {
      throw new Error("INVALID_TRANSITION: Accept hostel rules before profile completion");
    }
    if (step === "ACTIVATE") {
      if (!state.account_setup_completed) throw new Error("INVALID_TRANSITION: Account setup is incomplete");
      if (!state.rules_accepted) throw new Error("INVALID_TRANSITION: Rules must be accepted before activation");
      if (!state.profile_completed) throw new Error("INVALID_TRANSITION: Required profile fields are incomplete");
    }
  }

  private async saveAccount(profile: any, tenant: any, data: any) {
    const password = String(data?.password || "");
    const confirmPassword = String(data?.confirm_password || data?.confirmPassword || "");
    const primaryPhone = normalizeIndianPhone(data?.phone || data?.primary_phone || tenant.phone_1 || profile.phone);
    if (!primaryPhone) throw new Error("VALIDATION_ERROR: Valid primary phone is required");

    const profileUpdate: any = { phone: primaryPhone };
    if (password || confirmPassword) {
      if (password.length < 8) throw new Error("VALIDATION_ERROR: Password must be at least 8 characters");
      if (password !== confirmPassword) throw new Error("VALIDATION_ERROR: Passwords do not match");
      profileUpdate.password_hash = await hashPassword(password);
    } else if (!profile.password_hash) {
      throw new Error("VALIDATION_ERROR: Password is required");
    }

    await prisma.$transaction(async (tx: any) => {
      await tx.profile.update({ where: { id: profile.id }, data: profileUpdate });
      await tx.tenants.update({
        where: { id: tenant.id },
        data: {
          phone_1: primaryPhone,
          onboarding_last_activity_at: new Date(),
          ...(tenant.activation_started_at ? {} : { activation_started_at: new Date() }),
          ...(data?.photo_url ? { photo_url: String(data.photo_url) } : {}),
        },
      });
    });
    await eventLog.log("account_setup_completed", tenant.owner_id || null, { tenant_id: tenant.id, hostel_id: tenant.hostel_id }, tenant.id);
  }

  private async saveProfile(profile: any, tenant: any, data: any) {
    const phone = normalizeIndianPhone(data?.phone || data?.primary_phone || tenant.phone_1 || profile.phone);
    const gender = data?.gender ? String(data.gender) : tenant.gender;
    const dob = validDateOfBirth(data?.date_of_birth || tenant.date_of_birth);
    const guardianPhone = data?.guardian_phone || data?.phone_2
      ? normalizeIndianPhone(data?.guardian_phone || data?.phone_2)
      : null;
    const emergencyPhone = data?.phone_3 || data?.emergency_phone || data?.emergency_contact
      ? normalizeIndianPhone(data?.phone_3 || data?.emergency_phone || data?.emergency_contact)
      : null;
    if (!phone) throw new Error("VALIDATION_ERROR: Valid primary phone is required");
    if (guardianPhone === null && (data?.guardian_phone || data?.phone_2)) throw new Error("VALIDATION_ERROR: Valid guardian phone is required");
    if (!emergencyPhone) throw new Error("VALIDATION_ERROR: Valid emergency contact phone is required");
    if (!["Male", "Female", "Other", "Prefer not to say"].includes(gender)) throw new Error("VALIDATION_ERROR: Gender is required");
    if (!dob) throw new Error("VALIDATION_ERROR: Valid date of birth is required");
    if (!tenant.photo_url && !data?.photo_url) throw new Error("VALIDATION_ERROR: Profile photo is required");

    const profileType = data?.profile_type ? String(data.profile_type).toUpperCase() : tenant.profile_type || "STUDENT";
    const yearOfStudy = data?.year_of_study ? Number(data.year_of_study) : undefined;
    if (yearOfStudy !== undefined && (!Number.isInteger(yearOfStudy) || yearOfStudy < 1 || yearOfStudy > 6)) {
      throw new Error("VALIDATION_ERROR: Year of study must be between 1 and 6");
    }
    await prisma.$transaction(async (tx: any) => {
      await tx.profile.update({
        where: { id: profile.id },
        data: compactObject({ phone, emergency_contact: emergencyPhone || undefined }),
      });
      await tx.tenants.update({
        where: { id: tenant.id },
        data: compactObject({
          phone_1: phone,
          phone_2: guardianPhone || undefined,
          phone_3: emergencyPhone || undefined,
          guardian_name: data?.guardian_name || undefined,
          guardian_phone: guardianPhone || undefined,
          guardian_relation: data?.guardian_relation || undefined,
          gender,
          date_of_birth: dob,
          profile_type: ["STUDENT", "WORKING_PROFESSIONAL"].includes(profileType) ? profileType : "STUDENT",
          permanent_address: data?.permanent_address || undefined,
          temporary_address: data?.temporary_address || data?.permanent_address || undefined,
          personal_email: data?.personal_email || undefined,
          college_name: profileType === "STUDENT" ? data?.college_name || undefined : null,
          course: profileType === "STUDENT" ? data?.course || undefined : null,
          year_of_study: profileType === "STUDENT" ? yearOfStudy : undefined,
          branch: profileType === "STUDENT" ? data?.branch || undefined : null,
          roll_number: profileType === "STUDENT" ? data?.roll_number || undefined : null,
          office_name: profileType === "WORKING_PROFESSIONAL" ? data?.office_name || undefined : null,
          office_location: profileType === "WORKING_PROFESSIONAL" ? data?.office_location || undefined : null,
          job_role: profileType === "WORKING_PROFESSIONAL" ? data?.job_role || undefined : null,
          photo_url: data?.photo_url || undefined,
          onboarding_last_activity_at: new Date(),
        }),
      });
    });
    await eventLog.log("profile_completed", tenant.owner_id || null, { tenant_id: tenant.id, hostel_id: tenant.hostel_id }, tenant.id);
  }

  private async acceptRules(profile: any, tenant: any, data: any, context: { ip: string; userAgent: string }) {
    await eventLog.log("rules_viewed", tenant.owner_id || null, { tenant_id: tenant.id, hostel_id: tenant.hostel_id }, tenant.id);
    const acknowledgements = data?.acknowledgements || {};
    const missing = REQUIRED_ACKNOWLEDGEMENTS.filter((key) => acknowledgements[key] !== true);
    if (missing.length > 0) {
      throw new Error(`VALIDATION_ERROR: Missing required rule acknowledgements: ${missing.join(", ")}`);
    }
    const ruleVersion = await this.getActiveRuleVersion(tenant.hostel_id);
    const rulesSnapshot = this.rulePayload(ruleVersion);
    const existing = await prisma.tenantPolicyAcceptance.findUnique({
      where: {
        tenant_id_rule_version_id: {
          tenant_id: tenant.id,
          rule_version_id: ruleVersion.id,
        },
      },
    });
    if (!existing) {
      try {
        await prisma.tenantPolicyAcceptance.create({
          data: {
            tenant_id: tenant.id,
            hostel_id: tenant.hostel_id,
            rule_version_id: ruleVersion.id,
            rules_version: ruleVersion.version,
            rules_snapshot: rulesSnapshot,
            accepted_ip: context.ip,
            accepted_user_agent: context.userAgent,
            typed_signature_name: data?.typed_signature_name || profile.name,
          },
        });
      } catch (error: any) {
        if (error?.code !== "P2002") throw error;
      }
    }
    await prisma.tenants.update({
      where: { id: tenant.id },
      data: { onboarding_last_activity_at: new Date() },
    });
    await eventLog.log("rules_accepted", tenant.owner_id || null, { tenant_id: tenant.id, hostel_id: tenant.hostel_id, rule_version_id: ruleVersion.id }, tenant.id);
  }

  private async activate(profile: any, tenant: any) {
    const ruleVersion = await this.getActiveRuleVersion(tenant.hostel_id);
    const current = await prisma.profile.findUnique({
      where: { id: profile.id },
      include: {
        tenants: {
          include: {
            rule_acceptances: { where: { rule_version_id: ruleVersion.id } },
          },
        },
      },
    });
    const tenantNow = current?.tenants;
    if (!current || !tenantNow) throw new Error("INVALID: Activation link expired or already used");
    if (tenantNow.status !== "INVITED") throw new Error("INVALID_TRANSITION: Tenant is not invited");
    if (current.invitation_token !== profile.invitation_token || !current.invitation_token) {
      throw new Error("INVALID: Activation token has already been used");
    }

    const state = this.computeState(current, { ...tenantNow, identification_documents: [], rule_acceptances: tenantNow.rule_acceptances }, ruleVersion);
    if (!state.account_setup_completed || !state.rules_accepted || !state.profile_completed) {
      throw new Error("VALIDATION_ERROR: Required activation steps are incomplete");
    }
    this.validateOperationalInviteData(tenantNow);

    const completedAt = new Date();
    await prisma.$transaction(async (tx: any) => {
      const profileUpdate = await tx.profile.updateMany({
        where: {
          id: current.id,
          invitation_token: current.invitation_token,
          invitation_expires_at: { gte: completedAt },
          role: "TENANT",
        },
        data: {
          is_active: true,
          is_profile_completed: true,
          invitation_token: null,
          invitation_expires_at: null,
        },
      });
      if (profileUpdate.count !== 1) {
        throw new Error("INVALID: Activation token has already been used");
      }

      const tenantUpdate = await tx.tenants.updateMany({
        where: {
          id: tenantNow.id,
          profile_id: current.id,
          status: "INVITED",
          activation_completed_at: null,
        },
        data: {
          status: "ACTIVE",
          profile_completed: true,
          activation_completed_at: completedAt,
          onboarding_last_activity_at: completedAt,
        },
      });
      if (tenantUpdate.count !== 1) {
        throw new Error("INVALID_TRANSITION: Tenant activation was already completed or cancelled");
      }
    });

    await eventLog.log("activation_completed", tenantNow.owner_id || null, {
      tenant_id: tenantNow.id,
      hostel_id: tenantNow.hostel_id,
      completed_at: completedAt.toISOString(),
      duration_seconds: tenantNow.activation_started_at
        ? Math.max(0, Math.round((completedAt.getTime() - new Date(tenantNow.activation_started_at).getTime()) / 1000))
        : null,
    }, tenantNow.id);

    await allocationReconciliationService.reconcileTenant(tenantNow.id).catch(() => undefined);
  }

  private validateOperationalInviteData(tenant: any) {
    const rent = numberValue(tenant.monthly_rent);
    const advance = numberValue(tenant.advance_deposit);
    const maintenance = numberValue(tenant.maintenance_charge);
    if (rent <= 0) throw new Error("VALIDATION_ERROR: Monthly rent must be greater than zero");
    if (advance < 0) throw new Error("VALIDATION_ERROR: Advance deposit cannot be negative");
    if (maintenance < 0) throw new Error("VALIDATION_ERROR: Maintenance charge cannot be negative");

    for (const [label, value] of Object.entries({
      joined_on: tenant.joined_on,
      billing_start_date: tenant.billing_start_date,
    })) {
      if (!value) continue;
      const parsed = new Date(value as any);
      if (Number.isNaN(parsed.getTime())) throw new Error(`VALIDATION_ERROR: Invalid ${label}`);
    }
  }
}

export const activationWorkflowService = new ActivationWorkflowService();
