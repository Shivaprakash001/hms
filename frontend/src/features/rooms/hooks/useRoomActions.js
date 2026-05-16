import { useState } from 'react';
import { tenantService, roomService, allocationService } from '../../../api/services';

export const useRoomActions = ({
    hostelId,
    selectedRoom,
    setSelectedRoom,
    setSelectedTenant,
    setSelectedTenantProfile,
    setShowAddRoomModal,
    setShowAddFloorModal,
    setShowAddTenantModal,
    setShowShiftTenantModal,
    setSelectedFloorForRoom,
    setSelectedTenantForShift,
    refetchRooms,
}) => {
    const [tenantProfileLoading, setTenantProfileLoading] = useState(false);
    const [deletingRoomId, setDeletingRoomId] = useState(null);

    const handleCallTenant = async (phone) => {
        if (!phone || phone === 'No phone') {
            alert('Phone number unavailable');
            return;
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
    };

    const openRoomDetails = (room) => {
        setSelectedRoom(room);
    };

    const openTenantProfile = async (tenant) => {
        if (!tenant?.tenant_id && !tenant?.id) return;

        const tenantId = tenant.tenant_id || tenant.id;
        setSelectedTenant({ id: tenantId, name: tenant.name });
        setSelectedTenantProfile(null);
        setTenantProfileLoading(true);

        try {
            const ownerProfile = await tenantService.getOwnerTenantOverview(tenantId);
            setSelectedTenantProfile(ownerProfile);
        } catch (err) {
            console.error('Failed to load tenant profile:', err);
            alert('Failed to load tenant profile. Please try again.');
            setSelectedTenant(null);
            setSelectedTenantProfile(null);
        } finally {
            setTenantProfileLoading(false);
        }
    };

    const fetchData = async () => {
        if (refetchRooms) {
            await refetchRooms();
        }
    };

    const handleAddRoom = async (roomData) => {
        try {
            await roomService.create(hostelId, {
                room_no: roomData.number,
                capacity: parseInt(roomData.capacity),
                floor: parseInt(roomData.floor, 10),
                room_type: roomData.type,
                base_rent: parseFloat(roomData.rent) || 0,
            });
            if (refetchRooms) await refetchRooms();
            setShowAddRoomModal(false);
            setShowAddFloorModal(false);
            setSelectedFloorForRoom(null);
        } catch (err) {
            const detail = err.response?.data?.detail;
            const msg = detail?.message || detail || err.message || 'Unknown error';
            alert("Failed to create room: " + msg);
        }
    };

    const handleAddFloor = (floorNumber) => {
        setSelectedFloorForRoom(Number(floorNumber));
        setShowAddFloorModal(false);
        setShowAddRoomModal(true);
    };

    const handleAddTenant = async (room, tenantData) => {
        try {
            let tenantId;

            // 1. Get or Create Tenant Record
            try {
                // Check if tenant already has a record by profile_id
                const existingTenant = await tenantService.getByProfileId(tenantData.profile_id);
                tenantId = existingTenant.id;

                // If tenant exists but is LEFT, we must reactivate them
                if (existingTenant.status === 'LEFT') {
                    await tenantService.reactivate(tenantId, {
                        monthly_rent: parseFloat(tenantData.rent) || 0,
                        joined_on: tenantData.joinDate || new Date().toISOString().split('T')[0]
                    });
                }
            } catch (err) {
                // If 404, tenant doesn't exist, create it
                if (err.response?.status === 404) {
                    const tenantData = {
                        profile_id: tenantData.profile_id,
                        monthly_rent: tenantData.rent || 0,
                        joined_on: tenantData.joinDate || new Date().toISOString().split('T')[0],
                        status: 'ACTIVE'
                    };
                    const tenantResponse = await tenantService.create(tenantData);
                    tenantId = tenantResponse.id;
                } else {
                    throw err;
                }
            }

            // 2. Allocate Room
            try {
                const today = new Date();
                const localDate = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
                await allocationService.allocate(hostelId, {
                    tenant_id: tenantId,
                    room_id: room.id,
                    start_date: localDate
                });
            } catch (allocErr) {
                if (allocErr.response?.status === 409) {
                    const confirmShift = window.confirm(
                        `${tenantData.name} already has an active room allocation. Do you want to transfer them to Room ${room.room_no} instead?`
                    );
                    if (confirmShift) {
                        const today = new Date();
                        const localDate = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
                        await allocationService.shift(hostelId, {
                            tenant_id: tenantId,
                            new_room_id: room.id,
                            shift_date: tenantData.joinDate || localDate
                        });
                    } else {
                        return;
                    }
                } else {
                    throw allocErr;
                }
            }

            if (refetchRooms) await refetchRooms();
            if (setShowAddTenantModal) setShowAddTenantModal(false);
        } catch (err) {
            console.error(err);
            const detail = err.response?.data?.detail;
            const msg = detail?.message || detail || err.message || 'Unknown error';
            alert("Failed to add resident: " + msg);
        }
    };

    const handleRemoveTenant = async (tenantId) => {
        if (!window.confirm("Are you sure you want to remove this tenant? This will mark them as LEFT/Set No Room.")) return;

        try {
            await tenantService.delete(tenantId);
            if (refetchRooms) await refetchRooms();
        } catch (err) {
            alert("Failed to remove tenant: " + err.message);
        }
    };

    const handleDeleteRoom = async (room) => {
        if (!room?.id || deletingRoomId) return;

        const occupants = room.tenants || [];
        const roomNo = room.room_no || room.number || '';

        if (occupants.length > 0) {
            alert('This room has active residents. Please shift or remove them before deleting the room.');
            return;
        }

        if (!window.confirm(`Delete Room ${roomNo || 'this room'}? This cannot be undone.`)) return;

        setDeletingRoomId(room.id);
        try {
            await roomService.delete(room.id);
            if (selectedRoom?.id === room.id) {
                setSelectedRoom(null);
            }
            if (refetchRooms) await refetchRooms();
        } catch (err) {
            console.error(err);
            const detail = err.response?.data?.detail || err.response?.data?.error?.message || err.response?.data?.message;
            const msg = detail?.message || detail || err.message || 'Unknown error';
            alert("Failed to delete room: " + msg);
        } finally {
            setDeletingRoomId(null);
        }
    };

    const handleShiftTenant = async (tenantId, newRoomId) => {
        try {
            const today = new Date();
            const localDate = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
            await allocationService.shift(hostelId, {
                tenant_id: tenantId,
                new_room_id: newRoomId,
                shift_date: localDate
            });
            if (refetchRooms) await refetchRooms();
            if (setShowShiftTenantModal) setShowShiftTenantModal(false);
            if (setSelectedTenantForShift) setSelectedTenantForShift(null);
            alert("Tenant relocated successfully!");
        } catch (err) {
            console.error(err);
            const detail = err.response?.data?.detail;
            const msg = detail?.message || detail || err.message || 'Unknown error';
            alert("Failed to shift tenant: " + msg);
        }
    };

    return {
        handleCallTenant,
        openRoomDetails,
        openTenantProfile,
        tenantProfileLoading,
        deletingRoomId,
        fetchData,
        handleAddRoom,
        handleAddFloor,
        handleAddTenant,
        handleRemoveTenant,
        handleDeleteRoom,
        handleShiftTenant,
    };
};
