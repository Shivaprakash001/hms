import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Layers, LayoutGrid, Users, DoorOpen, BedDouble, Trash2, ArrowRightLeft, X, Phone, Calendar, CreditCard, Mail, Loader2 } from 'lucide-react';
import AddRoomModal from '../../components/owner/rooms/AddRoomModal';
import AddTenantModal from '../../components/owner/rooms/AddTenantModal';
import ShiftTenantModal from '../../components/owner/rooms/ShiftTenantModal';
import { roomService, allocationService, studentService } from '../../api/services';

const ManageRooms = () => {
    // State
    const [floors, setFloors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedRoom, setSelectedRoom] = useState(null);
    const [showAddRoomModal, setShowAddRoomModal] = useState(false);
    const [showAddFloorModal, setShowAddFloorModal] = useState(false); // We'll reuse AddRoomModal for this
    const [showAddTenantModal, setShowAddTenantModal] = useState(false);
    const [showShiftTenantModal, setShowShiftTenantModal] = useState(false);
    const [selectedTenantForShift, setSelectedTenantForShift] = useState(null);
    const [selectedTenant, setSelectedTenant] = useState(null);
    const [selectedTenantProfile, setSelectedTenantProfile] = useState(null);
    const [tenantProfileLoading, setTenantProfileLoading] = useState(false);
    const [filterStatus, setFilterStatus] = useState('All');

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

    // Fetch Data — grouped rooms is the single source of truth for cards and drawer
    const fetchData = async (roomIdToKeepOpen = null) => {
        setLoading(true);
        try {
            const floorsData = await roomService.getAll({ grouped: true });
            const normalised = normalizeFloors(floorsData);

            setFloors(normalised);
            setError(null);

            const targetRoomId = roomIdToKeepOpen || selectedRoom?.id;
            if (targetRoomId) {
                setSelectedRoom(findRoomById(normalised, targetRoomId));
            }

            return normalised;
        } catch (err) {
            console.error("Error fetching room data:", err);
            setError("Failed to load room data. Please try again.");
            return [];
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const openRoomDetails = async (room) => {
        setSelectedRoom(room);
    };

    const openTenantProfile = async (tenant) => {
        if (!tenant?.student_id && !tenant?.id) return;

        const tenantId = tenant.student_id || tenant.id;
        setSelectedTenant({ id: tenantId, name: tenant.name });
        setSelectedTenantProfile(null);
        setTenantProfileLoading(true);

        try {
            const overview = await studentService.getOwnerTenantOverview(tenantId);
            setSelectedTenantProfile(overview);
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
            await roomService.create({
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
            let studentId;

            // 1. Get or Create Student Record
            try {
                // Check if student already has a record by profile_id
                const existingStudent = await studentService.getByProfileId(tenantData.profile_id);
                studentId = existingStudent.id;

                // If student exists but is LEFT, we must reactivate them
                if (existingStudent.status === 'LEFT') {
                    await studentService.reactivate(studentId, {
                        monthly_rent: parseFloat(tenantData.rent) || 0,
                        joined_on: tenantData.joinDate || new Date().toISOString().split('T')[0]
                    });
                }
            } catch (err) {
                // If 404, student doesn't exist, create it
                if (err.response?.status === 404) {
                    const studentData = {
                        profile_id: tenantData.profile_id,
                        monthly_rent: tenantData.rent || 0,
                        joined_on: tenantData.joinDate || new Date().toISOString().split('T')[0],
                        status: 'ACTIVE'
                    };
                    const studentResponse = await studentService.create(studentData);
                    studentId = studentResponse.id;
                } else {
                    throw err;
                }
            }

            // 2. Allocate Room
            try {
                const today = new Date();
                const localDate = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
                await allocationService.allocate({
                    student_id: studentId,
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
                        await allocationService.shift({
                            student_id: studentId,
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

            await fetchData(room.id);
            setShowAddTenantModal(false);
        } catch (err) {
            console.error(err);
            const detail = err.response?.data?.detail;
            const msg = detail?.message || detail || err.message || 'Unknown error';
            alert("Failed to add resident: " + msg);
        }
    };

    const handleRemoveTenant = async (tenantId) => {
        if (!window.confirm("Are you sure you want to remove this tenant? This will mark them as LEFT.")) return;

        try {
            // Soft delete student -> triggers auto-end allocation
            await studentService.delete(tenantId);
            await fetchData(selectedRoom?.id);
        } catch (err) {
            alert("Failed to remove tenant: " + err.message);
        }
    };

    const handleShiftTenant = async (studentId, newRoomId) => {
        try {
            const today = new Date();
            const localDate = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
            await allocationService.shift({
                student_id: studentId,
                new_room_id: newRoomId,
                shift_date: localDate
            });
            await fetchData(selectedRoom?.id);
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard icon={<DoorOpen />} label="Total Rooms" value={totalRooms} color="blue" />
                <StatCard icon={<Users />} label="Total Occupants" value={totalOccupants} color="purple" />
                <StatCard icon={<BedDouble />} label="Total Capacity" value={totalCapacity} color="indigo" />
                <StatCard icon={<LayoutGrid />} label="Occupancy Rate" value={`${occupancyRate}%`} color="emerald" />
            </div>

            {/* Controls */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-sm overflow-x-auto max-w-full">
                    {['All', 'Occupied', 'Vacant', 'Full'].map((status) => (
                        <button
                            key={status}
                            onClick={() => setFilterStatus(status)}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${filterStatus === status
                                ? 'bg-slate-900 text-white shadow-md'
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
                        className="px-6 py-3 bg-white text-slate-700 border border-slate-200 rounded-xl font-bold hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm"
                    >
                        <Layers size={18} />
                        Add Floor
                    </button>
                    <button
                        onClick={() => setShowAddRoomModal(true)}
                        className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-black transition-all flex items-center gap-2 shadow-lg shadow-slate-200"
                    >
                        <Plus size={18} />
                        Add Room
                    </button>
                </div>
            </div>

            {/* Floors and Rooms */}
            <div className="space-y-8">
                {floors.map((floor) => (
                    <div key={floor.id} className="bg-white rounded-[24px] border border-slate-100 shadow-sm overflow-hidden">
                        <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-700 font-black shadow-sm">
                                    {floor.number}
                                </div>
                                <h3 className="text-lg font-bold text-slate-800">Floor {floor.number}</h3>
                            </div>
                            <span className="text-sm font-medium text-slate-400">
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
                                    className="h-[180px] rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-3 text-slate-400 hover:border-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all group"
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
                    <div className="text-center py-20 bg-white rounded-[32px] border border-dashed border-slate-200">
                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
                            <Layers size={40} />
                        </div>
                        <h3 className="text-xl font-black text-slate-900 mb-2">No Rooms Found</h3>
                        <p className="text-slate-500 max-w-sm mx-auto mb-8">
                            Get started by adding floors and rooms to your property structure.
                        </p>
                        <button
                            onClick={() => setShowAddFloorModal(true)}
                            className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-black transition-all shadow-xl shadow-slate-200"
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
                        onAddTenant={() => setShowAddTenantModal(true)}
                        onRemoveTenant={handleRemoveTenant}
                        onShiftTenant={(tenant) => {
                            setSelectedTenantForShift({
                                ...tenant,
                                id: tenant.student_id || tenant.id
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

const StatCard = ({ icon, label, value, color }) => (
    <div className={`bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all`}>
        <div className={`absolute top-0 right-0 p-4 opacity-10 text-${color}-500 group-hover:scale-110 transition-transform`}>
            {React.cloneElement(icon, { size: 48 })}
        </div>
        <div className="relative z-10">
            <div className={`w-12 h-12 rounded-2xl bg-${color}-50 flex items-center justify-center text-${color}-600 mb-4 group-hover:scale-110 transition-transform`}>
                {icon}
            </div>
            <h4 className="text-slate-400 font-bold text-sm uppercase tracking-wider mb-1">{label}</h4>
            <div className="text-3xl font-black text-slate-900">{value}</div>
        </div>
    </div>
);

const RoomCard = ({ room, onClick }) => {
    const getStatusColor = (status) => {
        switch (status) {
            case 'Vacant': return 'emerald';
            case 'Full': return 'rose';
            default: return 'amber';
        }
    };
    const statusColor = getStatusColor(room.status);

    return (
        <motion.div
            whileHover={{ y: -4 }}
            onClick={onClick}
            className={`cursor-pointer group relative bg-white rounded-2xl border-2 border-transparent hover:border-${statusColor}-100 shadow-sm hover:shadow-xl transition-all p-5`}
        >
            <div className="flex justify-between items-start mb-4">
                <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Room</span>
                    <span className="text-2xl font-black text-slate-900">{room.room_no}</span>
                </div>
                <div className={`px-3 py-1 rounded-full bg-${statusColor}-50 text-${statusColor}-600 text-xs font-bold uppercase tracking-wide`}>
                    {room.status}
                </div>
            </div>

            <div className="space-y-3">
                <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
                    <Users size={16} />
                    <span>{room.tenants.length} / {room.capacity} Occupants</span>
                </div>
                {/* Progress bar */}
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                        className={`h-full bg-${statusColor}-500 transition-all duration-500`}
                        style={{ width: `${(room.tenants.length / room.capacity) * 100}%` }}
                    />
                </div>
            </div>
        </motion.div>
    );
}

const RoomDetailSidebar = ({ room, onClose, onAddTenant, onRemoveTenant, onShiftTenant, onOpenTenant }) => {
    const roomInfo = room?.room || room;
    const occupants = room?.tenants || room?.occupants || roomInfo?.tenants || [];
    const capacity = roomInfo?.capacity || 0;
    const roomNo = roomInfo?.room_no || roomInfo?.number;
    const floor = roomInfo?.floor ?? (roomNo?.length >= 3 ? roomNo.substring(0, roomNo.length - 2) : 'G');

    const getPaymentTone = (status) => {
        switch (status) {
            case 'PAID':
                return 'bg-emerald-50 text-emerald-700 border-emerald-100';
            case 'PARTIAL':
                return 'bg-amber-50 text-amber-700 border-amber-100';
            case 'PENDING':
                return 'bg-rose-50 text-rose-700 border-rose-100';
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
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-900 transition-colors">
                            <ArrowRightLeft size={24} />
                        </button>
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
                                        key={tenant.student_id || tenant.id}
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
                                                            ₹{Number(tenant.rent).toLocaleString()}/month
                                                        </span>
                                                    )}
                                                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${getPaymentTone((tenant.payment_status || '').toUpperCase())}`}>
                                                        {(tenant.payment_status || 'NO_HISTORY').replace('_', ' ')}
                                                    </span>
                                                    {tenant.pending_dues > 0 && (
                                                        <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-100">
                                                            Due ₹{Number(tenant.pending_dues).toLocaleString()}
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
                                                onClick={() => onShiftTenant(tenant)}
                                                className="p-2 text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 rounded-xl transition-all"
                                                title="Relocate Tenant"
                                            >
                                                <ArrowRightLeft size={18} />
                                            </button>
                                            <button
                                                onClick={() => onRemoveTenant(tenant.student_id || tenant.id)}
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
    const payments = profile?.recent_payments || [];

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
                                {profile?.room_number ? `Room ${profile.room_number}` : 'No room assigned'} • Joined {profile?.joined_at || 'N/A'}
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
                                        <InfoTile label="Room" value={profile?.room_number || 'Unassigned'} icon={BedDouble} />
                                        <InfoTile label="Floor" value={profile?.floor || 'G'} icon={LayoutGrid} />
                                        <InfoTile label="Joined" value={profile?.joined_at || 'N/A'} icon={Calendar} />
                                        <InfoTile label="Status" value={profile?.status || 'N/A'} icon={Users} />
                                    </div>
                                </div>

                                <div>
                                    <h4 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 mb-3">Financials</h4>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <SummaryTile label="Monthly Rent" value={`₹${Number(profile?.rent || 0).toLocaleString()}`} />
                                        <SummaryTile label="Total Paid" value={`₹${Number(profile?.total_paid || 0).toLocaleString()}`} />
                                        <SummaryTile label="Total Due" value={`₹${Number(profile?.total_due || 0).toLocaleString()}`} />
                                        <SummaryTile label="Outstanding" value={`₹${Number(profile?.outstanding || 0).toLocaleString()}`} />
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
                                                        <div className="font-bold text-slate-900">₹{Number(payment.amount || 0).toLocaleString()}</div>
                                                        <div className="text-sm text-slate-500 mt-1">
                                                            {payment.date || 'No date'} • {payment.method || 'Unknown method'}
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

const SummaryTile = ({ label, value }) => (
    <div className="rounded-2xl border border-slate-100 p-4 bg-white">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p>
        <p className="text-2xl font-black text-slate-900 mt-2">{value}</p>
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
