import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Layers, LayoutGrid, Users, DoorOpen, BedDouble, Trash2, ArrowRightLeft, X, Phone, Calendar, CreditCard, Mail, Loader2 } from 'lucide-react';
import AddRoomModal from '../../features/rooms/components/AddRoomModal';
import AddFloorModal from '../../features/rooms/components/AddFloorModal';
import AddTenantModal from '../../features/rooms/components/AddTenantModal';
import ShiftTenantModal from '../../features/rooms/components/ShiftTenantModal';
import EditRoomModal from '../../features/rooms/components/EditRoomModal';
import { roomService, allocationService, tenantService } from '../../api/services';
import { useRooms } from '../../hooks/useRooms';
import { useAppPreferences } from '../../context/AppPreferencesContext';
import { useHostelContext } from '../../context/HostelContext';
import { formatCurrency, formatDate } from '../../utils/format';
import { StatCard } from '../../features/rooms/components/StatCard';
import { RoomCard } from '../../features/rooms/components/RoomCard';
import { RoomDetailSidebar } from '../../features/rooms/components/RoomDetailSidebar';
import { TenantProfileModal } from '../../features/rooms/components/TenantProfileModal';
const ManageRooms = () => {
    const { preferences } = useAppPreferences();
    const { hostelId } = useHostelContext();
    // State
    const [selectedRoom, setSelectedRoom] = useState(null);
    const [showAddRoomModal, setShowAddRoomModal] = useState(false);
    const [showAddFloorModal, setShowAddFloorModal] = useState(false);
    const [selectedFloorForRoom, setSelectedFloorForRoom] = useState(null);
    const [showAddTenantModal, setShowAddTenantModal] = useState(false);
    const [showEditRoomModal, setShowEditRoomModal] = useState(false);
    const [showShiftTenantModal, setShowShiftTenantModal] = useState(false);
    const [selectedTenantForShift, setSelectedTenantForShift] = useState(null);
    const [selectedTenant, setSelectedTenant] = useState(null);
    const [selectedTenantProfile, setSelectedTenantProfile] = useState(null);
    const [tenantProfileLoading, setTenantProfileLoading] = useState(false);
    const [deletingRoomId, setDeletingRoomId] = useState(null);
    const [filterStatus, setFilterStatus] = useState('All');

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

    const normalizeFloors = (floorsData) => (
        (floorsData || []).map(floor => ({
            ...floor,
            rooms: (floor.rooms || []).map(room => ({
                ...room,
                room_no: room.room_no ?? room.number,
                number: room.number ?? room.room_no,
                tenants: room.tenants || [],
                status: room.status || ((room.tenants?.length ?? 0) === 0
                    ? 'Vacant'
                    : (room.tenants?.length >= room.capacity ? 'Full' : 'Occupied'))
            }))
        }))
    );

    const findRoomById = (floorsList, roomId) => (
        floorsList.flatMap((floor) => floor.rooms).find((room) => room.id === roomId) || null
    );

    const { data: floorsData, isLoading: loading, error: fetchError, refetch: refetchRooms } = useRooms(hostelId, { grouped: true });
    
    const floors = useMemo(() => normalizeFloors(floorsData), [floorsData]);
    const error = fetchError ? "Failed to load room data. Please try again." : null;

    useEffect(() => {
        if (selectedRoom && floors.length > 0) {
            const updatedRoom = findRoomById(floors, selectedRoom.id);
            if (updatedRoom && JSON.stringify(updatedRoom) !== JSON.stringify(selectedRoom)) {
                setSelectedRoom(updatedRoom);
            }
        }
    }, [floors, selectedRoom?.id]);

    const fetchData = async () => {
        await refetchRooms();
    };

    const openRoomDetails = async (room) => {
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

    // Handlers
    const handleAddRoom = async (roomData) => {
        try {
            await roomService.create(hostelId, {
                room_no: roomData.number,
                capacity: parseInt(roomData.capacity),
                floor: parseInt(roomData.floor, 10),
                room_type: roomData.type,
                base_rent: parseFloat(roomData.rent) || 0,
            });
            await fetchData();
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

            await fetchData();
            setShowAddTenantModal(false);
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
            // First drop room allocation to ensure room resets correctly.
            // Soft delete tenant -> triggers auto-end allocation
            await tenantService.delete(tenantId);
            await fetchData();
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
            await fetchData();
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
            await fetchData();
            setShowShiftTenantModal(false);
            setSelectedTenantForShift(null);
            alert("Tenant relocated successfully!");
        } catch (err) {
            console.error(err);
            const detail = err.response?.data?.detail;
            const msg = detail?.message || detail || err.message || 'Unknown error';
            alert("Failed to shift tenant: " + msg);
        }
    };

    // --- Render ---

    // Derived state for stats
    const totalRooms = floors.reduce((acc, f) => acc + f.rooms.length, 0);
    const totalCapacity = floors.reduce((acc, f) => acc + f.rooms.reduce((rAcc, r) => rAcc + r.capacity, 0), 0);
    const totalOccupants = floors.reduce((acc, f) => acc + f.rooms.reduce((rAcc, r) => rAcc + r.tenants.length, 0), 0);
    const occupancyRate = totalCapacity > 0 ? Math.round((totalOccupants / totalCapacity) * 100) : 0;

    if (loading) return (
        <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
        </div>
    );

    if (error) return (
        <div className="p-8 text-center bg-red-50 rounded-2xl border border-red-100">
            <p className="text-red-600 font-bold mb-4">{error}</p>
            <button onClick={fetchData} className="px-4 py-2 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50">
                Retry
            </button>
        </div>
    );

    return (
        <div className="space-y-8 pb-20">
            {/* Header Stats */}
            {/* Header Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={<DoorOpen />} label="Total Rooms" value={totalRooms} color="blue" />
                <StatCard icon={<Users />} label="Total Occupants" value={totalOccupants} color="purple" />
                <StatCard icon={<BedDouble />} label="Total Capacity" value={totalCapacity} color="indigo" />
                <StatCard icon={<LayoutGrid />} label="Occupancy Rate" value={`${occupancyRate}%`} color="emerald" />
            </div>

            {/* Controls */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex gap-2 bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm overflow-x-auto max-w-full">
                    {['All', 'Occupied', 'Vacant', 'Full'].map((status) => (
                        <button
                            key={status}
                            onClick={() => setFilterStatus(status)}
                            className={`px-5 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${filterStatus === status
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                                }`}
                        >
                            {status}
                        </button>
                    ))}
                </div>

                <div className="flex gap-3 w-full md:w-auto">
                    <button
                        onClick={() => setShowAddFloorModal(true)}
                        className="flex-1 md:flex-none px-6 py-3 bg-white text-slate-700 border border-slate-200 rounded-xl font-bold hover:bg-slate-50 transition-all flex items-center justify-center gap-2 shadow-sm"
                    >
                        <Plus size={18} />
                        Add Floor
                    </button>
                    <button
                        onClick={() => {
                            setSelectedFloorForRoom(null);
                            setShowAddRoomModal(true);
                        }}
                        className="flex-1 md:flex-none px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100"
                    >
                        <Plus size={18} />
                        Add Room
                    </button>
                </div>
            </div>

            {/* Floors and Rooms */}
            <div className="space-y-8">
                {floors.map((floor) => (
                    <div key={floor.id} className="bg-white rounded-[28px] border border-slate-100 shadow-sm overflow-hidden">
                        <div className="px-7 py-5 border-b border-slate-50 bg-slate-50/30 flex justify-between items-center">
                            <div className="flex items-center gap-4">
                                <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-900 font-black shadow-sm text-sm">
                                    {floor.number}
                                </div>
                                <h3 className="text-lg font-black text-slate-900 tracking-tight">Floor {floor.number}</h3>
                            </div>
                            <span className="text-sm font-bold text-slate-400">
                                {floor.rooms.length} Rooms
                            </span>
                        </div>

                        <div className="p-8">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {floor.rooms
                                    .filter(room => filterStatus === 'All' || room.status === filterStatus)
                                    .map(room => (
                                        <RoomCard
                                            key={room.id}
                                            room={room}
                                            onClick={() => openRoomDetails(room)}
                                            onDelete={() => handleDeleteRoom(room)}
                                            isDeleting={deletingRoomId === room.id}
                                        />
                                    ))}

                                {/* Add Room Button for this floor */}
                                <button
                                    onClick={() => {
                                        setSelectedFloorForRoom(floor.number);
                                        setShowAddRoomModal(true);
                                    }}
                                    className="h-[180px] rounded-24px border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-3 text-slate-400 hover:border-indigo-300 hover:text-indigo-500 hover:bg-indigo-50/30 transition-all group"
                                >
                                    <div className="w-12 h-12 rounded-full bg-slate-50 group-hover:bg-white flex items-center justify-center transition-colors">
                                        <Plus size={24} />
                                    </div>
                                    <span className="font-bold">Add Room</span>
                                </button>
                            </div>
                        </div>
                    </div>
                ))}

                {floors.length === 0 && (
                    <div className="text-center py-24 bg-white rounded-[40px] border border-dashed border-slate-200">
                        <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-200">
                            <Layers size={48} />
                        </div>
                        <h3 className="text-2xl font-black text-slate-900 mb-2">Build Your Property</h3>
                        <p className="text-slate-500 max-w-sm mx-auto mb-10 font-medium">
                            Configure your hostel by adding floors and assigning room structures to start accepting tenants.
                        </p>
                        <button
                            onClick={() => setShowAddFloorModal(true)}
                            className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100"
                        >
                            Add First Floor
                        </button>
                    </div>
                )}
            </div>

            {/* Room Detail Sidebar */}
            <AnimatePresence>
                {selectedRoom && (
                    <RoomDetailSidebar
                        room={selectedRoom}
                        onClose={() => setSelectedRoom(null)}
                        onEditRoom={() => setShowEditRoomModal(true)}
                        onAddTenant={() => setShowAddTenantModal(true)}
                        onRemoveTenant={handleRemoveTenant}
                        onCallTenant={handleCallTenant}
                        onDeleteRoom={() => handleDeleteRoom(selectedRoom)}
                        isDeletingRoom={deletingRoomId === selectedRoom.id}
                        onShiftTenant={(tenant) => {
                            setSelectedTenantForShift({
                                ...tenant,
                                id: tenant.tenant_id || tenant.id
                            });
                            setShowShiftTenantModal(true);
                        }}
                        onOpenTenant={openTenantProfile}
                    />
                )}
            </AnimatePresence>

            {/* Modals */}
            <AnimatePresence>
                {(showAddRoomModal || showAddFloorModal) && (
                    <>
                        {showAddFloorModal && (
                            <AddFloorModal
                                onClose={() => setShowAddFloorModal(false)}
                                onAdd={handleAddFloor}
                            />
                        )}
                        {showAddRoomModal && (
                            <AddRoomModal
                                floor={{ number: selectedFloorForRoom ?? 'New' }}
                                onClose={() => {
                                    setShowAddRoomModal(false);
                                    setSelectedFloorForRoom(null);
                                }}
                                onAdd={handleAddRoom}
                            />
                        )}
                    </>
                )}
                {showAddTenantModal && selectedRoom && (
                    <AddTenantModal
                        selectedRoom={selectedRoom}
                        onClose={() => setShowAddTenantModal(false)}
                        onAdd={handleAddTenant}
                    />
                )}
                {showEditRoomModal && selectedRoom && (
                    <EditRoomModal
                        room={selectedRoom.room || selectedRoom}
                        onClose={() => setShowEditRoomModal(false)}
                        onSave={() => fetchData()}
                    />
                )}
                {showShiftTenantModal && selectedTenantForShift && (
                    <ShiftTenantModal
                        selectedTenant={selectedTenantForShift}
                        selectedRoom={selectedRoom}
                        floors={floors}
                        onClose={() => {
                            setShowShiftTenantModal(false);
                            setSelectedTenantForShift(null);
                        }}
                        onShift={handleShiftTenant}
                    />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {selectedTenant && (
                    <TenantProfileModal
                        tenant={selectedTenant}
                        profile={selectedTenantProfile}
                        loading={tenantProfileLoading}
                        onClose={() => {
                            setSelectedTenant(null);
                            setSelectedTenantProfile(null);
                        }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

export default ManageRooms;
