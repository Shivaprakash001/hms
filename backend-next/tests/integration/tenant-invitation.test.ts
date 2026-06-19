import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTestOwner, createTestHostel } from '../factories/owner-factory';
import { createTestRoom } from '../factories/room-factory';
import { tenantInvitationLifecycleService } from '../../src/services/tenants/tenant-invitation-lifecycle-service';
import { MetaWhatsAppProvider } from '../../lib/services/notifications/providers/whatsapp/meta-provider';
import { EmailService } from '../../lib/services/email-service';
import { prisma } from '../../lib/db';
import { hostelPolicyService } from '../../lib/services/hostel-policy-service';

vi.mock('../../lib/services/email-service', () => {
  return {
    EmailService: {
      sendInvitation: vi.fn().mockResolvedValue({ sent: true } as any),
    },
  };
});

describe('Tenant Onboarding Integration Flow', () => {
  let owner: any;
  let hostel: any;
  let room: any;
  let sendInvitationSpy: any;

  beforeEach(async () => {
    owner = await createTestOwner();
    hostel = await createTestHostel(owner.id);
    room = await createTestRoom(hostel.id);
    
    // Default mock behavior for MetaWhatsAppProvider
    sendInvitationSpy = vi.spyOn(MetaWhatsAppProvider.prototype, 'sendInvitation');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('should invite a tenant using WhatsApp only (email is optional/null)', async () => {
    sendInvitationSpy.mockResolvedValueOnce({
      providerMessageId: 'wamid.test_invite',
      attempts: 1,
    });

    const result: any = await tenantInvitationLifecycleService.createInvitation({
      name: 'Rahul Sharma',
      phone: '9876543210',
      room_id: room.id,
      monthly_rent: 8000,
    }, owner.id);

    expect(result.action).toBe('INVITED');
    expect(result.phone).toBe('+919876543210');
    expect(result.email).toBeNull();
    expect(result.whatsapp_sent).toBe(true);
    expect(result.needs_email).toBe(false);
    
    // Verify WhatsApp was called
    expect(sendInvitationSpy).toHaveBeenCalledTimes(1);
    expect(sendInvitationSpy).toHaveBeenCalledWith(expect.objectContaining({
      to: '+919876543210',
      tenantName: 'Rahul Sharma',
      roomNumber: room.room_no,
    }));

    // Verify invitation record is in database
    const dbInvite = await prisma.tenant_invitations.findUnique({
      where: { id: result.invitation_id },
    });
    expect(dbInvite).toBeTruthy();
    expect(dbInvite?.phone).toBe('+919876543210');
    expect(dbInvite?.email).toBeNull();
  });

  it('should trigger email fallback if WhatsApp fails and email is provided', async () => {
    // WhatsApp fails
    sendInvitationSpy.mockRejectedValueOnce(new Error('WhatsApp service unavailable'));
    
    // Email succeeds
    vi.mocked(EmailService.sendInvitation).mockResolvedValueOnce({
      sent: true,
    } as any);

    const result: any = await tenantInvitationLifecycleService.createInvitation({
      name: 'Rahul Sharma',
      phone: '9876543212',
      email: 'rahul2@test.com',
      room_id: room.id,
      monthly_rent: 8000,
    }, owner.id);

    expect(result.action).toBe('INVITED');
    expect(result.whatsapp_sent).toBe(false);
    expect(result.email_sent).toBe(true);
    expect(result.needs_email).toBe(false);

    expect(sendInvitationSpy).toHaveBeenCalledTimes(1);
    expect(EmailService.sendInvitation).toHaveBeenCalledTimes(1);

    // Verify database record has both email and phone
    const dbInvite = await prisma.tenant_invitations.findUnique({
      where: { id: result.invitation_id },
    });
    expect(dbInvite?.phone).toBe('+919876543212');
    expect(dbInvite?.email).toBe('rahul2@test.com');
  });

  it('should require email (needs_email: true) if WhatsApp fails and no email is provided', async () => {
    // WhatsApp fails
    sendInvitationSpy.mockRejectedValueOnce(new Error('WhatsApp service unavailable'));

    const result: any = await tenantInvitationLifecycleService.createInvitation({
      name: 'Rahul Sharma',
      phone: '9876543213',
      room_id: room.id,
      monthly_rent: 8000,
    }, owner.id);

    expect(result.action).toBe('INVITED');
    expect(result.whatsapp_sent).toBe(false);
    expect(result.email_sent).toBe(false);
    expect(result.needs_email).toBe(true);

    expect(sendInvitationSpy).toHaveBeenCalledTimes(1);
    expect(EmailService.sendInvitation).not.toHaveBeenCalled();
  });

  it('should resend invitation with email override for fallback flow', async () => {
    // 1. Create invitation without email (WhatsApp failed, needs_email is true)
    sendInvitationSpy.mockRejectedValueOnce(new Error('WhatsApp failed'));
    const initial: any = await tenantInvitationLifecycleService.createInvitation({
      name: 'Rahul Sharma',
      phone: '9876543214',
      room_id: room.id,
      monthly_rent: 8000,
    }, owner.id);

    expect(initial.needs_email).toBe(true);

    // Reset spies
    sendInvitationSpy.mockReset();
    vi.mocked(EmailService.sendInvitation).mockClear();

    // 2. Resend invitation specifying fallback email override
    vi.mocked(EmailService.sendInvitation).mockResolvedValueOnce({
      sent: true,
    } as any);

    const resendResult: any = await tenantInvitationLifecycleService.resendInvitation(
      initial.invitation_id,
      { id: owner.id, role: 'OWNER' },
      { email: 'rahul-fallback4@test.com' }
    );

    expect(resendResult.email_sent).toBe(true);
    expect(EmailService.sendInvitation).toHaveBeenCalledTimes(1);

    // Verify invitation record now has the email updated
    const dbInvite = await prisma.tenant_invitations.findUnique({
      where: { id: initial.invitation_id },
    });
    expect(dbInvite?.email).toBe('rahul-fallback4@test.com');
  });

  it('should invite a tenant with zero monthly rent', async () => {
    sendInvitationSpy.mockResolvedValueOnce({
      providerMessageId: 'wamid.test_invite_zero',
      attempts: 1,
    });

    const result: any = await tenantInvitationLifecycleService.createInvitation({
      name: 'Zero Rent Tenant',
      phone: '9876543211',
      room_id: room.id,
      monthly_rent: 0,
    }, owner.id);

    expect(result.action).toBe('INVITED');
    expect(result.whatsapp_sent).toBe(true);

    const dbTenant = await prisma.tenants.findUnique({
      where: { id: result.tenant_id },
    });
    expect(Number(dbTenant?.monthly_rent)).toBe(0);
  });

  describe('Hostel Status Hardening on Invitations', () => {
    it('should reject invitation creation when hostel is ARCHIVED or INACTIVE', async () => {
      // 1. ARCHIVED
      await prisma.hostels.update({
        where: { id: hostel.id },
        data: { status: 'ARCHIVED', is_active: false },
      });

      await expect(
        tenantInvitationLifecycleService.createInvitation({
          name: 'Blocked Tenant',
          phone: '9876543220',
          room_id: room.id,
          monthly_rent: 8000,
        }, owner.id)
      ).rejects.toThrow('VALIDATION_ERROR: Cannot invite tenant to an archived hostel');

      // 2. INACTIVE
      await prisma.hostels.update({
        where: { id: hostel.id },
        data: { status: 'INACTIVE', is_active: false },
      });

      await expect(
        tenantInvitationLifecycleService.createInvitation({
          name: 'Blocked Tenant',
          phone: '9876543220',
          room_id: room.id,
          monthly_rent: 8000,
        }, owner.id)
      ).rejects.toThrow('VALIDATION_ERROR: Cannot invite tenant to an inactive hostel');
    });

    it('should reject resending invitation when hostel is ARCHIVED or INACTIVE', async () => {
      // Restore status to active to create initial invitation
      await prisma.hostels.update({
        where: { id: hostel.id },
        data: { status: 'ACTIVE', is_active: true },
      });

      sendInvitationSpy.mockResolvedValueOnce({
        providerMessageId: 'wamid.resend_test',
        attempts: 1,
      });

      const initial: any = await tenantInvitationLifecycleService.createInvitation({
        name: 'Resend Test Tenant',
        phone: '9876543221',
        room_id: room.id,
        monthly_rent: 8000,
      }, owner.id);

      // 1. ARCHIVED
      await prisma.hostels.update({
        where: { id: hostel.id },
        data: { status: 'ARCHIVED', is_active: false },
      });

      await expect(
        tenantInvitationLifecycleService.resendInvitation(
          initial.invitation_id,
          { id: owner.id, role: 'OWNER' }
        )
      ).rejects.toThrow('VALIDATION_ERROR: Cannot resend invitation for an archived hostel');

      // 2. INACTIVE
      await prisma.hostels.update({
        where: { id: hostel.id },
        data: { status: 'INACTIVE', is_active: false },
      });

      await expect(
        tenantInvitationLifecycleService.resendInvitation(
          initial.invitation_id,
          { id: owner.id, role: 'OWNER' }
        )
      ).rejects.toThrow('VALIDATION_ERROR: Cannot resend invitation for an inactive hostel');
    });

    it('should reject resolving token (activation) when hostel is ARCHIVED or INACTIVE', async () => {
      // Restore status to active to create initial invitation
      await prisma.hostels.update({
        where: { id: hostel.id },
        data: { status: 'ACTIVE', is_active: true },
      });

      sendInvitationSpy.mockResolvedValueOnce({
        providerMessageId: 'wamid.resolve_test',
        attempts: 1,
      });

      const initial: any = await tenantInvitationLifecycleService.createInvitation({
        name: 'Resolve Test Tenant',
        phone: '9876543222',
        room_id: room.id,
        monthly_rent: 8000,
      }, owner.id);

      const dbInvite = await prisma.tenant_invitations.findUnique({
        where: { id: initial.invitation_id },
      });
      const token = dbInvite!.token;

      // 1. ARCHIVED
      await prisma.hostels.update({
        where: { id: hostel.id },
        data: { status: 'ARCHIVED', is_active: false },
      });

      await expect(
        tenantInvitationLifecycleService.resolveByToken(token)
      ).rejects.toThrow('FORBIDDEN: Cannot activate tenant in an archived hostel');

      // 2. INACTIVE
      await prisma.hostels.update({
        where: { id: hostel.id },
        data: { status: 'INACTIVE', is_active: false },
      });

      await expect(
        tenantInvitationLifecycleService.resolveByToken(token)
      ).rejects.toThrow('FORBIDDEN: Cannot activate tenant in an inactive hostel');
    });
  });

  describe('Dynamic Security Deposit Onboarding Integration', () => {
    beforeEach(async () => {
      // Ensure hostel is active and rent_cycle is MONTHLY
      await prisma.hostels.update({
        where: { id: hostel.id },
        data: { status: 'ACTIVE', is_active: true },
      });
    });

    it('should scale security deposit by rent multiplier when mode is MONTHS_OF_RENT', async () => {
      // 1. Update the hostel billing defaults policy to MONTHS_OF_RENT mode with 2 months multiplier
      await hostelPolicyService.updateHostelPolicy(
        hostel.id,
        owner.id,
        {
          billing: {
            deposit: {
              calculation_mode: 'MONTHS_OF_RENT',
              deposit_months: 2,
            }
          }
        },
        owner.id
      );

      sendInvitationSpy.mockResolvedValueOnce({
        providerMessageId: 'wamid.scale_test',
        attempts: 1,
      });

      // 2. Invite tenant without specifying explicit advance/deposit override
      const result: any = await tenantInvitationLifecycleService.createInvitation({
        name: 'Scaled Deposit Tenant',
        phone: '9876543233',
        room_id: room.id,
        monthly_rent: 12000,
      }, owner.id);

      expect(result.action).toBe('INVITED');

      // 3. Verify in database that security_deposit is calculated as monthly_rent (12000) * 2 = 24000
      const dbInvite = await prisma.tenant_invitations.findUnique({
        where: { id: result.invitation_id },
        include: { tenant: true },
      });

      expect(Number(dbInvite?.tenant.monthly_rent)).toBe(12000);
      expect(Number(dbInvite?.tenant.security_deposit)).toBe(24000);
    });

    it('should respect manual deposit override even when mode is MONTHS_OF_RENT', async () => {
      // 1. Update the hostel billing defaults policy to MONTHS_OF_RENT mode with 3 months multiplier
      await hostelPolicyService.updateHostelPolicy(
        hostel.id,
        owner.id,
        {
          billing: {
            deposit: {
              calculation_mode: 'MONTHS_OF_RENT',
              deposit_months: 3,
            }
          }
        },
        owner.id
      );

      sendInvitationSpy.mockResolvedValueOnce({
        providerMessageId: 'wamid.override_test',
        attempts: 1,
      });

      // 2. Invite tenant specifying an explicit advance_amount override of 15000 (rent is 10000)
      const result: any = await tenantInvitationLifecycleService.createInvitation({
        name: 'Overridden Deposit Tenant',
        phone: '9876543244',
        room_id: room.id,
        monthly_rent: 10000,
        advance_amount: 15000,
      }, owner.id);

      expect(result.action).toBe('INVITED');

      // 3. Verify in database that security_deposit is exactly the overridden amount (15000), not rent * 3 (30000)
      const dbInvite = await prisma.tenant_invitations.findUnique({
        where: { id: result.invitation_id },
        include: { tenant: true },
      });

      expect(Number(dbInvite?.tenant.monthly_rent)).toBe(10000);
      expect(Number(dbInvite?.tenant.security_deposit)).toBe(15000);
    });

    it('should fall back to default agreement duration from policy when not provided', async () => {
      await hostelPolicyService.updateHostelPolicy(
        hostel.id,
        owner.id,
        {
          billing: {
            invite_defaults: {
              agreement_duration_months: 9,
            }
          }
        },
        owner.id
      );

      sendInvitationSpy.mockResolvedValueOnce({
        providerMessageId: 'wamid.duration_test_1',
        attempts: 1,
      });

      const result: any = await tenantInvitationLifecycleService.createInvitation({
        name: 'Duration Test Tenant 1',
        phone: '9876543261',
        room_id: room.id,
        monthly_rent: 10000,
      }, owner.id);

      expect(result.action).toBe('INVITED');

      const dbInvite = await prisma.tenant_invitations.findUnique({
        where: { id: result.invitation_id },
      });

      expect(dbInvite?.agreement_duration_months).toBe(9);
    });

    it('should respect custom agreement duration when explicitly provided', async () => {
      await hostelPolicyService.updateHostelPolicy(
        hostel.id,
        owner.id,
        {
          billing: {
            invite_defaults: {
              agreement_duration_months: 9,
            }
          }
        },
        owner.id
      );

      sendInvitationSpy.mockResolvedValueOnce({
        providerMessageId: 'wamid.duration_test_2',
        attempts: 1,
      });

      const result: any = await tenantInvitationLifecycleService.createInvitation({
        name: 'Duration Test Tenant 2',
        phone: '9876543262',
        room_id: room.id,
        monthly_rent: 10000,
        agreement_duration_months: 6,
      }, owner.id);

      expect(result.action).toBe('INVITED');

      const dbInvite = await prisma.tenant_invitations.findUnique({
        where: { id: result.invitation_id },
      });

      expect(dbInvite?.agreement_duration_months).toBe(6);
    });
  });
});
