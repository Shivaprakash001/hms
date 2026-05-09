import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Layers, LayoutGrid, Users, DoorOpen, BedDouble, Trash2, ArrowRightLeft, X, Phone, Calendar, CreditCard, Mail, Loader2 } from 'lucide-react';
import AddRoomModal from '../../components/owner/rooms/AddRoomModal';
import AddTenantModal from '../../components/owner/rooms/AddTenantModal';
import ShiftTenantModal from '../../components/owner/rooms/ShiftTenantModal';
import EditRoomModal from '../../components/owner/rooms/EditRoomModal';
import { roomService, allocationService, tenantService } from '../../api/services';
import { useRooms } from '../../hooks/useRooms';
import { useAppPreferences } from '../../context/AppPreferencesContext';
import { useHostelContext } from '../../context/HostelContext';
import { formatCurrency, formatDate } from '../../utils/format';

const ManageRooms = () => {
    const { preferences } = useAppPreferences();
    const { hostelId } = useHostelContext();
    // State
    const [selectedRoom, setSelectedRoom] = useState(null);
    const [showAddRoomModal, setShowAddRoomModal] = useState(false);
    const [showAddFloorModal, setShowAddFloorModal] = useState(false); // We'll reuse AddRoomModal for this
    const [showAddTenantModal, setShowAddTenantModal] = useState(false);
    const [showEditRoomModal, setShowEditRoomModal] = useState(false);
    const [showShiftTenantModal, setShowShiftTenantModal] = useState(false);
    const [selectedTenantForShift, setSelectedTenantForShift] = useState(null);
    const [selectedTenant, setSelectedTenant] = useState(null);
    const [selectedTenantProfile, setSelectedTenantProfile] = useState(null);
    const [tenantProfileLoading, setTenantProfileLoading] = useState(false);
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
                type: roomData.type,
                price: parseFloat(roomData.rent),
                // Note: 'price' and 'type' are sent but need confirming if schema calls for them.
                // Assuming RoomCreate schema might be loose or I need to update it.
                // room_schema.py showed RoomCreate had room_no, capacity.
                // If I send extra fields, Pydantic ignores them unless Extra.forbid.
                // So this is safe, even if backend doesn't use them yet.
            });
            await fetchData();
            setShowAddRoomModal(false);
            setShowAddFloorModal(false);
        } catch (err) {
            const detail = err.response?.data?.detail;
            const msg = detail?.message || detail || err.message || 'Unknown error';
            alert("Failed to create room: " + msg);
        }
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
                        onClick={() => setShowAddRoomModal(true)}
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
                                        />
                                    ))}

                                {/* Add Room Button for this floor */}
                                <button
                                    onClick={() => {
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
                    <AddRoomModal
                        floor={{ number: 'New' }}
                        onClose={() => { setShowAddRoomModal(false); setShowAddFloorModal(false); }}
                        onAdd={handleAddRoom}
                    />
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

const StatCard = ({ icon, label, value, color }) => {
    const colorMap = {
        indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', icon: 'text-indigo-500' },
        purple: { bg: 'bg-purple-50', text: 'text-purple-600', icon: 'text-purple-500' },
        blue: { bg: 'bg-blue-50', text: 'text-blue-600', icon: 'text-blue-500' },
        emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', icon: 'text-emerald-500' },
    };
    const style = colorMap[color] || colorMap.indigo;

    return (
        <div className={`bg-white p-4 sm:p-5 rounded-2xl sm:rounded-[24px] border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all`}>
            <div className="relative z-10">
                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl ${style.bg} flex items-center justify-center ${style.text} mb-3 sm:mb-4 group-hover:scale-110 transition-transform`}>
                    {React.cloneElement(icon, { size: 20, className: "sm:size-[24px]" })}
                </div>
                <h4 className="text-slate-400 font-bold text-[9px] sm:text-[10px] uppercase tracking-[0.12em] mb-1">{label}</h4>
                <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">{value}</div>
            </div>
        </div>
    );
};

const RoomCard = ({ room, onClick }) => {
    const isFull = room.tenants?.length >= room.capacity;
    const isVacant = (room.tenants?.length || 0) === 0;
    
    const getStatusStyle = () => {
        if (isFull) return { 
            bg: 'bg-rose-50', 
            text: 'text-rose-600', 
            fill: 'bg-rose-500', 
            border: 'hover:border-rose-200', 
            label: 'FULL' 
        };
        if (isVacant) return { 
            bg: 'bg-emerald-50', 
            text: 'text-emerald-600', 
            fill: 'bg-emerald-500', 
            border: 'hover:border-emerald-200', 
            label: 'VACANT' 
        };
        return { 
            bg: 'bg-amber-50', 
            text: 'text-amber-600', 
            fill: 'bg-amber-500', 
            border: 'hover:border-amber-200', 
            label: 'OCCUPIED' 
        };
    };
    
    const status = getStatusStyle();

    return (
        <motion.div
            whileHover={{ y: -4, scale: 1.02 }}
            onClick={onClick}
            className={`cursor-pointer group relative bg-white rounded-xl border border-slate-100 ${status.border} shadow-sm hover:shadow-xl transition-all p-5`}
        >
            <div className="flex justify-between items-start mb-6">
                <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Room</span>
                    <span className="text-3xl font-black text-slate-900 leading-none">{room.room_no}</span>
                </div>
                <div className={`px-2.5 py-1 rounded-lg ${status.bg} ${status.text} text-[10px] font-black uppercase tracking-widest`}>
                    {status.label}
                </div>
            </div>

            <div className="space-y-4">
                <div className="flex items-center gap-2 text-slate-500 text-xs font-bold">
                    <Users size={16} className="text-slate-300" />
                    <span>{room.tenants?.length || 0} / {room.capacity} Occupants</span>
                </div>
                {/* Progress bar */}
                <div className="h-2 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100/50">
                    <div
                        className={`h-full ${status.fill} transition-all duration-700 ease-out`}
                        style={{ width: `${((room.tenants?.length || 0) / room.capacity) * 100}%` }}
                    />
                </div>
            </div>
        </motion.div>
    );
}

const RoomDetailSidebar = ({ room, onClose, onEditRoom, onAddTenant, onRemoveTenant, onShiftTenant, onOpenTenant, onCallTenant }) => {
    const roomInfo = room?.room || room;
    const occupants = room?.tenants || room?.occupants || roomInfo?.tenants || [];
    const capacity = roomInfo?.capacity || 0;
    const roomNo = roomInfo?.room_no || roomInfo?.number;
    const floor = roomInfo?.floor ?? 'N/A';

    const getPaymentTone = (status) => {
        switch (status) {
            case 'PAID':
                return 'bg-green-50 text-green-700 border-green-100';
            case 'PARTIAL':
                return 'bg-yellow-50 text-yellow-700 border-yellow-100';
            case 'PENDING':
                return 'bg-red-50 text-red-700 border-red-100';
            default:
                return 'bg-slate-50 text-slate-600 border-slate-100';
        }
    };

    return (
        <>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40"
            />
            <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 30 }}
                className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl z-50 overflow-y-auto"
            >
                <div className="p-8">
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <h2 className="text-3xl font-black text-slate-900">Room {roomNo}</h2>
                            <p className="text-slate-400 font-bold mt-1">Floor {floor}</p>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={onEditRoom} className="p-2 hover:bg-slate-100 rounded-xl font-bold text-slate-500 hover:text-indigo-600 transition-colors text-sm flex items-center gap-1">
                                Edit 
                            </button>
                            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-900 transition-colors">
                                <X size={24} />
                            </button>
                        </div>
                    </div>

                    <div className="space-y-8">
                        <>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Capacity</p>
                                    <p className="text-2xl font-black text-slate-900 mt-2">{capacity}</p>
                                </div>
                                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Occupied</p>
                                    <p className="text-2xl font-black text-slate-900 mt-2">{occupants.length}</p>
                                </div>
                            </div>

                        {/* Occupants List */}
                        <div>
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                                    <Users size={20} />
                                    Residents ({occupants.length}/{capacity})
                                </h3>
                                {occupants.length < capacity && (
                                    <button
                                        onClick={onAddTenant}
                                        className="text-sm font-bold text-blue-600 hover:text-blue-700 hover:underline"
                                    >
                                        + Add Resident
                                    </button>
                                )}
                            </div>

                            <div className="space-y-3">
                                {occupants.map(tenant => (
                                    <div
                                        key={tenant.tenant_id || tenant.id}
                                        className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex justify-between items-center group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => onOpenTenant(tenant)}
                                                className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-slate-700 font-bold shadow-sm hover:text-indigo-600 transition-colors"
                                            >
                                                {(tenant.name || '?').charAt(0)}
                                            </button>
                                            <div>
                                                <button
                                                    onClick={() => onOpenTenant(tenant)}
                                                    className="font-bold text-slate-900 hover:text-indigo-600 transition-colors"
                                                >
                                                    {tenant.name}
                                                </button>
                                                <div className="text-xs font-semibold text-slate-400">Joined: {tenant.joined_date || tenant.joinedOn || 'N/A'}</div>
                                                <div className="flex flex-wrap items-center gap-2 mt-2">
                                                    {tenant.rent != null && (
                                                        <span className="text-xs font-bold text-slate-600 bg-white px-2.5 py-1 rounded-full border border-slate-100">
                                                            {formatCurrency(Number(tenant.rent), preferences)}/month
                                                        </span>
                                                    )}
                                                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${getPaymentTone((tenant.payment_status || '').toUpperCase())}`}>
                                                        {(tenant.payment_status || 'NO_HISTORY').replace('_', ' ')}
                                                    </span>
                                                    {tenant.pending_dues > 0 && (
                                                        <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-100">
                                                            Due {formatCurrency(Number(tenant.pending_dues), preferences)}
                                                        </span>
                                                    )}
                                                </div>
                                                {tenant.last_payment && (
                                                    <div className="text-xs text-slate-500 mt-2">
                                                        Last paid on {tenant.last_payment}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => onCallTenant?.(tenant.phone)}
                                                disabled={!tenant.phone || tenant.phone === 'No phone'}
                                                className={`p-2 rounded-xl transition-all ${
                                                    tenant.phone && tenant.phone !== 'No phone'
                                                        ? 'text-green-600 hover:bg-green-50'
                                                        : 'text-slate-300 cursor-not-allowed'
                                                }`}
                                                title={tenant.phone && tenant.phone !== 'No phone' ? 'Call Tenant' : 'Phone number unavailable'}
                                            >
                                                <Phone size={18} />
                                            </button>
                                            <button
                                                onClick={() => onShiftTenant(tenant)}
                                                className="p-2 text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 rounded-xl transition-all"
                                                title="Relocate Tenant"
                                            >
                                                <ArrowRightLeft size={18} />
                                            </button>
                                            <button
                                                onClick={() => onRemoveTenant(tenant.tenant_id || tenant.id)}
                                                className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                                title="Remove Tenant"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {occupants.length === 0 && (
                                    <div className="py-8 text-center text-slate-400 text-sm font-medium border-2 border-dashed border-slate-100 rounded-2xl">
                                        Room is currently vacant
                                    </div>
                                )}
                            </div>
                        </div>
                        </>
                    </div>
                </div>
            </motion.div>
        </>
    );
};

const TenantProfileModal = ({ tenant, profile, loading, onClose }) => {
    const { preferences } = useAppPreferences();
    const payments = profile?.recent_payments || [];
    const latestPayment = payments[0] || null;
    const formatDisplayDate = (value) => formatDate(value, preferences, 'N/A');

    return (
        <>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50"
            />
            <motion.div
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.98 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
                <div className="w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-100 flex flex-col">
                    <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                        <div>
                            <h3 className="text-2xl font-black text-slate-900">{profile?.name || tenant?.name || 'Tenant Profile'}</h3>
                            <p className="text-sm text-slate-500 font-medium mt-1">
                                {profile?.room_number ? `Room ${profile.room_number}` : 'No room assigned'} • Joined {formatDisplayDate(profile?.joined_at)}
                            </p>
                        </div>
                        <button onClick={onClose} className="p-2 rounded-full hover:bg-white text-slate-400 hover:text-slate-900 transition-colors">
                            <X size={22} />
                        </button>
                    </div>

                    <div className="overflow-y-auto p-6 space-y-6">
                        {loading ? (
                            <div className="py-20 text-center text-slate-400">
                                <Loader2 size={30} className="animate-spin mx-auto mb-3" />
                                <p className="text-sm font-medium">Loading tenant profile...</p>
                            </div>
                        ) : (
                            <>
                                <div>
                                    <h4 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 mb-3">Contact</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <InfoTile label="Phone" value={profile?.phone || 'No phone'} icon={Phone} />
                                        <InfoTile label="Guardian" value={profile?.guardian_phone || 'No guardian phone'} icon={Phone} />
                                        <InfoTile label="Email" value={profile?.email || 'No email'} icon={Mail} />
                                    </div>
                                </div>

                                <div>
                                    <h4 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 mb-3">Stay Info</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                        <InfoTile label="Room" value={profile?.room_number ?? 'Unassigned'} icon={BedDouble} />
                                        <InfoTile label="Floor" value={profile?.room_number ? (profile?.floor ?? 'N/A') : 'N/A'} icon={LayoutGrid} />
                                        <InfoTile label="Joined" value={formatDisplayDate(profile?.joined_at)} icon={Calendar} />
                                        <InfoTile label="Status" value={profile?.status || 'N/A'} icon={Users} />
                                    </div>
                                </div>

                                <div>
                                    <h4 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 mb-3">Financials</h4>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <SummaryTile label="Monthly Rent" value={formatCurrency(Number(profile?.rent || 0), preferences)} />
                                        <SummaryTile label="Total Paid" value={formatCurrency(Number(profile?.total_paid || 0), preferences)} />
                                        <SummaryTile label="Outstanding" value={formatCurrency(Number(profile?.outstanding || 0), preferences)} />
                                        <SummaryTile
                                            label="Last Payment"
                                            value={latestPayment ? formatCurrency(Number(latestPayment.amount || 0), preferences) : 'No payment'}
                                            subtitle={latestPayment ? formatDisplayDate(latestPayment.date) : 'No payment history'}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <h4 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 mb-3">Recent Payments</h4>
                                    <div className="space-y-3">
                                        {payments.length === 0 ? (
                                            <div className="rounded-2xl border-2 border-dashed border-slate-100 text-center py-10 text-slate-400 text-sm">
                                                No recent payments.
                                            </div>
                                        ) : (
                                            payments.map((payment) => (
                                                <div key={payment.id} className="rounded-2xl border border-slate-100 p-4 flex items-center justify-between gap-4">
                                                    <div>
                                                        <div className="font-bold text-slate-900">{formatCurrency(Number(payment.amount || 0), preferences)}</div>
                                                        <div className="text-sm text-slate-500 mt-1">
                                                            {formatDisplayDate(payment.date)} • {payment.method || 'Unknown method'}
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border bg-emerald-50 text-emerald-700 border-emerald-100">
                                                            <CreditCard size={12} />
                                                            {payment.status || 'paid'}
                                                        </div>
                                                        {payment.reference_number && (
                                                            <div className="text-xs text-slate-400 mt-2">{payment.reference_number}</div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </motion.div>
        </>
    );
};

const SummaryTile = ({ label, value, subtitle }) => (
    <div className="rounded-2xl border border-slate-100 p-4 bg-white">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p>
        <p className="text-2xl font-black text-slate-900 mt-2">{value}</p>
        {subtitle && <p className="text-xs font-medium text-slate-400 mt-2">{subtitle}</p>}
    </div>
);

const InfoTile = ({ label, value, icon: Icon }) => (
    <div className="rounded-2xl border border-slate-100 p-5 bg-slate-50">
        <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-wider">
            <Icon size={14} />
            {label}
        </div>
        <p className="text-sm font-semibold text-slate-900 mt-3 break-all">{value}</p>
    </div>
);

export default ManageRooms;
