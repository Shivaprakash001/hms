import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTestOwner, createTestHostel } from '../factories/owner-factory';
import { createTestRoom } from '../factories/room-factory';
import { tenantInvitationLifecycleService } from '../../src/services/tenants/tenant-invitation-lifecycle-service';
import { MetaWhatsAppProvider } from '../../lib/services/notifications/providers/whatsapp/meta-provider';
import { EmailService } from '../../lib/services/email-service';
import { prisma } from '../../lib/db';

vi.mock('../../lib/services/email-service', () => {
  return {
    EmailService: {
      sendInvitation: vi.fn().mockResolvedValue({ sent: true }),
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

    const result = await tenantInvitationLifecycleService.createInvitation({
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
    });

    const result = await tenantInvitationLifecycleService.createInvitation({
      name: 'Rahul Sharma',
      phone: '9876543210',
      email: 'rahul@test.com',
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
    expect(dbInvite?.phone).toBe('+919876543210');
    expect(dbInvite?.email).toBe('rahul@test.com');
  });

  it('should require email (needs_email: true) if WhatsApp fails and no email is provided', async () => {
    // WhatsApp fails
    sendInvitationSpy.mockRejectedValueOnce(new Error('WhatsApp service unavailable'));

    const result = await tenantInvitationLifecycleService.createInvitation({
      name: 'Rahul Sharma',
      phone: '9876543210',
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
    const initial = await tenantInvitationLifecycleService.createInvitation({
      name: 'Rahul Sharma',
      phone: '9876543210',
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
    });

    const resendResult = await tenantInvitationLifecycleService.resendInvitation(
      initial.invitation_id,
      { id: owner.id, role: 'OWNER' },
      { email: 'rahul-fallback@test.com' }
    );

    expect(resendResult.email_sent).toBe(true);
    expect(EmailService.sendInvitation).toHaveBeenCalledTimes(1);

    // Verify invitation record now has the email updated
    const dbInvite = await prisma.tenant_invitations.findUnique({
      where: { id: initial.invitation_id },
    });
    expect(dbInvite?.email).toBe('rahul-fallback@test.com');
  });

  it('should invite a tenant with zero monthly rent', async () => {
    sendInvitationSpy.mockResolvedValueOnce({
      providerMessageId: 'wamid.test_invite_zero',
      attempts: 1,
    });

    const result = await tenantInvitationLifecycleService.createInvitation({
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
});
