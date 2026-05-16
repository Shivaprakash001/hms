import { tenantService } from '../../../api/services';

export const useTenantActions = ({ fetchTenants }) => {
    const handleSaveTenant = async (data, tenantToEdit) => {
        try {
            if (tenantToEdit) {
                if (tenantToEdit.status !== 'INVITED') {
                    alert('Tenant details are locked after activation.');
                    return { success: false };
                }
                const result = await tenantService.update(tenantToEdit.id, {
                    invitation_edit: true,
                    name: data.name,
                    email: data.email,
                    phone: data.phone || '',
                    room_id: data.roomId,
                    monthly_rent: parseFloat(data.rent),
                    joining_date: data.joinDate,
                });
                alert(result?.message || "Invitation updated and resent successfully");
            }
            fetchTenants();
            return { success: true };
        } catch (err) {
            alert("Error saving tenant: " + (err.response?.data?.error?.message || err.response?.data?.detail || err.message));
            return { success: false };
        }
    };

    const handleDeleteTenant = async (id) => {
        if (!window.confirm("Are you sure you want to mark this tenant as LEFT? \n\nTheir payment history will be preserved, but their room allocation will be ended immediately, making the room available for new tenants.")) return { success: false };
        try {
            await tenantService.delete(id);
            fetchTenants();
            return { success: true };
        } catch (err) {
            alert("Error removing tenant: " + err.message);
            return { success: false };
        }
    };

    const handleToggleStatus = async (tenant) => {
        const isActive = tenant.status === 'ACTIVE';
        if (isActive) {
            alert("Directly marking a tenant as LEFT is not allowed. Please use the Move-Outs tab to process their departure and ensure all security deposits and rent settlements are handled securely.");
            return { success: false };
        }
        
        const confirmMsg = `Reactivate "${tenant.name}" as ACTIVE?\n\nThis will allow them to be assigned to a room again.`;
        if (!window.confirm(confirmMsg)) return { success: false };
        try {
            if (!isActive) {
                // LEFT → ACTIVE: use the reactivate endpoint
                await tenantService.reactivate(tenant.id, {
                    monthly_rent: parseFloat(tenant.rent),
                    joined_on: new Date().toISOString().split('T')[0]
                });
            } else {
                alert("Please use the Move-Out workflow.");
            }
            fetchTenants();
            return { success: true };
        } catch (err) {
            alert('Error toggling status: ' + (err.response?.data?.detail?.message || err.message));
            return { success: false };
        }
    };

    const handleResendInvitation = async (tenant) => {
        if (!window.confirm(`Resend invitation to ${tenant.email}?`)) return { success: false };
        try {
            const res = await tenantService.resendInvitation(tenant.email);
            alert(res?.message || "Invitation resent successfully");
            return { success: true };
        } catch (err) {
            alert("Error resending invitation: " + (err.response?.data?.error?.message || err.message));
            return { success: false };
        }
    };

    const handleCancelInvitation = async (tenant) => {
        if (!window.confirm(`Cancel invitation for "${tenant.name}"?\n\nThis will:\n• Free their room allocation immediately\n• Waive any pending obligations\n• Mark them as CANCELLED (not recoverable via this action)`)) return { success: false };
        try {
            await tenantService.cancelInvitation(tenant.id);
            fetchTenants();
            return { success: true };
        } catch (err) {
            alert('Error cancelling invitation: ' + (err.response?.data?.error?.message || err.message));
            return { success: false };
        }
    };

    const handleCallTenant = async (phone) => {
        if (!phone || phone === 'N/A') {
            alert('Phone number unavailable');
            return { success: false };
        }

        try {
            await navigator.clipboard.writeText(phone);
        } catch (err) {
            console.error('Clipboard copy failed:', err);
        }

        const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        if (isMobile) {
            window.open(`tel:${phone}`, '_self');
        } else {
            alert('Phone number copied to clipboard');
        }
        return { success: true };
    };

    return {
        handleSaveTenant,
        handleDeleteTenant,
        handleToggleStatus,
        handleResendInvitation,
        handleCancelInvitation,
        handleCallTenant
    };
};
