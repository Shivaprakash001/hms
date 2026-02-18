import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, AlertCircle, Search, Users, Home, Bed, Filter, Loader2, Download, Plus } from 'lucide-react';
import RoomCard from '../../components/owner/rooms/RoomCard';
import RoomDetailsView from '../../components/owner/rooms/RoomDetailsView';
import AddTenantModal from '../../components/owner/rooms/AddTenantModal';
import ShiftTenantModal from '../../components/owner/rooms/ShiftTenantModal';
import AddFloorModal from '../../components/owner/rooms/AddFloorModal';
import AddRoomModal from '../../components/owner/rooms/AddRoomModal';
import { getFloors, removeTenant, addFloor, addRoom } from '../../utils/storageUtils';

const ManageRooms = () => {
    const [floors, setFloors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedRoom, setSelectedRoom] = useState(null);
    const [showAddTenant, setShowAddTenant] = useState(false);
    const [showShiftTenant, setShowShiftTenant] = useState(false);
    const [selectedTenant, setSelectedTenant] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isMockMode, setIsMockMode] = useState(false);

    // New Modal States
    const [showAddFloor, setShowAddFloor] = useState(false);
    const [showAddRoom, setShowAddRoom] = useState(false);
    const [selectedFloorForRoom, setSelectedFloorForRoom] = useState(null);

    const API_BASE_URL = "http://localhost:5000/api";

    const stats = useMemo(() => {
        let totalRooms = 0;
        let totalTenants = 0;
        let totalCapacity = 0;

        floors.forEach(f => {
            totalRooms += f.rooms.length;
            f.rooms.forEach(r => {
                totalTenants += r.occupied;
                totalCapacity += r.capacity;
            });
        });

        return {
            totalRooms,
            totalTenants,
            vacancy: totalCapacity - totalTenants,
            occupancyRate: totalCapacity ? Math.round((totalTenants / totalCapacity) * 100) : 0
        };
    }, [floors]);

    useEffect(() => {
        // Simulate loading
        setTimeout(() => {
            setFloors(getFloors());
            setLoading(false);
            setIsMockMode(false);
        }, 500);
    }, []);

    const refetchFloors = async () => {
        setFloors(getFloors());
    };

    const handleRemoveTenant = async (tenantId) => {
        if (!confirm('Vacate this resident?')) return;
        try {
            removeTenant(tenantId);
            const updatedFloors = getFloors();
            setFloors(updatedFloors);

            // Also update the selectedRoom view
            const updatedRoom = updatedFloors.flatMap(f => f.rooms).find(r => r.id === selectedRoom.id);
            setSelectedRoom(updatedRoom);

            alert('Tenant removed successfully');
        } catch (err) { alert(err.message); }
    };

    const handleAddFloor = (floorNumber) => {
        addFloor(floorNumber);
        refetchFloors();
    };

    const handleAddRoom = (roomData) => {
        if (!selectedFloorForRoom) return;
        addRoom(selectedFloorForRoom.id, roomData);
        refetchFloors();
    };

    const handleExport = () => {
        alert("Exporting data to CSV...");
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="mb-4 text-indigo-600"
                >
                    <Loader2 size={40} />
                </motion.div>
                <p className="text-slate-400 font-bold tracking-widest text-xs uppercase">Initializing Dashboard</p>
            </div>
        );
    }

    if (selectedRoom) {
        return (
            <AnimatePresence mode="wait">
                <RoomDetailsView
                    room={selectedRoom}
                    onBack={() => setSelectedRoom(null)}
                    onAddTenant={() => setShowAddTenant(true)}
                    onShiftTenant={(t) => { setSelectedTenant(t); setShowShiftTenant(true); }}
                    onRemoveTenant={handleRemoveTenant}
                    searchTerm={searchTerm}
                />
                {showAddTenant && (
                    <AddTenantModal
                        selectedRoom={selectedRoom}
                        onClose={() => setShowAddTenant(false)}
                        onSuccess={refetchFloors}
                        isMockMode={isMockMode}
                        API_BASE_URL={API_BASE_URL}
                        floors={floors}
                        setFloors={setFloors}
                        setSelectedRoom={setSelectedRoom}
                    />
                )}
                {showShiftTenant && (
                    <ShiftTenantModal
                        selectedTenant={selectedTenant}
                        selectedRoom={selectedRoom}
                        floors={floors}
                        onClose={() => { setShowShiftTenant(false); setSelectedTenant(null); }}
                        onSuccess={refetchFloors}
                        isMockMode={isMockMode}
                        API_BASE_URL={API_BASE_URL}
                        setFloors={setFloors}
                        setSelectedRoom={setSelectedRoom}
                    />
                )}
            </AnimatePresence>
        );
    }

    return (
        <AnimatePresence mode="wait">
            <motion.div
                key="list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-8"
            >
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Room Assets</h1>
                        <p className="text-slate-500 text-sm mt-1">Monitor occupancy and manage your hostel infrastructure.</p>
                    </div>

                    <div className="flex items-center gap-3">
                        {isMockMode && (
                            <span className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-bold border border-slate-200">
                                <AlertCircle size={14} /> Offline Mode
                            </span>
                        )}
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={16} />
                            <input
                                type="text"
                                placeholder="Search..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg w-full md:w-64 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all font-medium text-slate-700 placeholder:text-slate-400"
                            />
                        </div>
                        <button
                            onClick={() => setShowAddFloor(true)}
                            className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all text-sm font-semibold shadow-sm shadow-indigo-200"
                        >
                            <Plus size={16} /> Add Floor
                        </button>
                        <button
                            onClick={handleExport}
                            className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-all text-sm font-semibold"
                        >
                            <Download size={16} /> Export
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                    {[
                        { label: 'Total Units', val: stats.totalRooms, icon: Home, color: 'text-slate-900', bg: 'bg-slate-100' },
                        { label: 'Active Tenants', val: stats.totalTenants, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                        { label: 'Beds Available', val: stats.vacancy, icon: Bed, color: 'text-slate-600', bg: 'bg-white border border-slate-200' },
                        { label: 'Occupancy Rate', val: `${stats.occupancyRate}%`, icon: Building2, color: 'text-slate-900', bg: 'bg-slate-100' }
                    ].map((stat) => (
                        <motion.div
                            key={stat.label}
                            whileHover={{ y: -2 }}
                            className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between h-full"
                        >
                            <div className="flex items-center justify-between mb-2">
                                <div className={`w-10 h-10 ${stat.bg} ${stat.color} rounded-xl flex items-center justify-center`}>
                                    <stat.icon size={20} />
                                </div>
                                {/* Optional: Add trend arrow or simple dot here if needed */}
                            </div>
                            <div>
                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">{stat.label}</p>
                                <p className="text-3xl font-black text-slate-900 leading-none">{stat.val}</p>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Floors List */}
                <div className="space-y-24 pb-20">
                    {floors.map((floor) => (
                        <section key={floor.id} className="relative">
                            {/* Floor Header */}
                            <div className="flex items-center justify-center mb-10 relative">
                                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                                    <div className="w-full border-t border-slate-200"></div>
                                </div>
                                <div className="relative flex justify-center gap-4">
                                    <span className="bg-white px-8 py-2.5 rounded-full border border-slate-200 shadow-sm text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-3">
                                        <Building2 size={16} className="text-indigo-600" />
                                        Floor {floor.number}
                                    </span>
                                    <button
                                        onClick={() => { setSelectedFloorForRoom(floor); setShowAddRoom(true); }}
                                        className="absolute right-[-140px] top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-50 hover:text-indigo-600 transition-colors shadow-sm"
                                    >
                                        <Plus size={14} /> Add Room
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 lg:gap-8">
                                {floor.rooms && floor.rooms.length > 0 ? (
                                    floor.rooms
                                        .filter(room =>
                                            room.number.includes(searchTerm) ||
                                            room.tenants?.some(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()))
                                        )
                                        .map((room) => (
                                            <RoomCard
                                                key={room.id}
                                                room={room}
                                                onClick={setSelectedRoom}
                                            />
                                        ))
                                ) : (
                                    <div className="col-span-full flex flex-col items-center justify-center py-12 text-slate-400 border-2 border-dashed border-slate-100 rounded-2xl bg-slate-50/50">
                                        <Bed size={32} className="mb-2 opacity-50" />
                                        <p className="text-sm font-medium">No rooms on this floor yet</p>
                                        <button
                                            onClick={() => { setSelectedFloorForRoom(floor); setShowAddRoom(true); }}
                                            className="mt-2 text-xs font-bold text-indigo-600 hover:underline"
                                        >
                                            Add one now
                                        </button>
                                    </div>
                                )}
                            </div>
                        </section>
                    ))}
                </div>

                {/* Modals */}
                {showAddFloor && (
                    <AddFloorModal
                        onClose={() => setShowAddFloor(false)}
                        onAdd={handleAddFloor}
                    />
                )}
                {showAddRoom && selectedFloorForRoom && (
                    <AddRoomModal
                        floor={selectedFloorForRoom}
                        onClose={() => { setShowAddRoom(false); setSelectedFloorForRoom(null); }}
                        onAdd={handleAddRoom}
                    />
                )}
            </motion.div>
        </AnimatePresence>
    );
};

export default ManageRooms;