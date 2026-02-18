import { MOCK_COMPLAINTS, MOCK_EXPENSES, MOCK_FLOORS } from './mockData';

const COMPLAINTS_KEY = 'hms_complaints_v2';

export const getComplaints = () => {
    const stored = localStorage.getItem(COMPLAINTS_KEY);
    if (!stored) {
        // Initialize with default mock data if empty
        localStorage.setItem(COMPLAINTS_KEY, JSON.stringify(MOCK_COMPLAINTS));
        return MOCK_COMPLAINTS;
    }
    return JSON.parse(stored);
};

export const saveComplaint = (complaint) => {
    const complaints = getComplaints();
    const updated = [complaint, ...complaints];
    localStorage.setItem(COMPLAINTS_KEY, JSON.stringify(updated));
    return updated;
};

export const updateComplaintStatus = (id, status) => {
    const complaints = getComplaints();
    const updated = complaints.map(c =>
        c.id === id ? { ...c, status } : c
    );
    localStorage.setItem(COMPLAINTS_KEY, JSON.stringify(updated));
    return updated;
};



export const deleteComplaint = (id) => {
    const complaints = getComplaints();
    const updated = complaints.filter(c => c.id !== id);
    localStorage.setItem(COMPLAINTS_KEY, JSON.stringify(updated));
    return updated;
};


const EXPENSES_KEY = 'hms_expenses';

export const getExpenses = () => {
    const stored = localStorage.getItem(EXPENSES_KEY);
    if (!stored) {
        localStorage.setItem(EXPENSES_KEY, JSON.stringify(MOCK_EXPENSES));
        return MOCK_EXPENSES;
    }
    return JSON.parse(stored);
};

export const saveExpense = (expense) => {
    const expenses = getExpenses();
    const updated = [expense, ...expenses];
    localStorage.setItem(EXPENSES_KEY, JSON.stringify(updated));
    return updated;
};

export const updateExpense = (updatedExpense) => {
    const expenses = getExpenses();
    const updated = expenses.map(e => e.id === updatedExpense.id ? updatedExpense : e);
    localStorage.setItem(EXPENSES_KEY, JSON.stringify(updated));
    return updated;
};

export const deleteExpense = (id) => {
    const expenses = getExpenses();
    const updated = expenses.filter(e => e.id !== id);
    localStorage.setItem(EXPENSES_KEY, JSON.stringify(updated));
    return updated;
};

const NOTIFICATIONS_KEY = 'hms_notifications';

const MOCK_NOTIFICATIONS = [
    { id: 1, type: 'payment', title: 'Payment Received', message: '₹8,500 from Shiva (Room 101)', time: '2 min ago', read: false },
    { id: 2, type: 'tenant', title: 'New Tenant Added', message: 'Sharan added to Room 204', time: '1 hour ago', read: false },
    { id: 3, type: 'complaint', title: 'New Complaint', message: 'WiFi issue reported in Block A', time: '3 hours ago', read: true },
    { id: 4, type: 'alert', title: 'Payment Overdue', message: 'Modi (Room 302) is late', time: '1 day ago', read: true },
];

export const getNotifications = () => {
    const stored = localStorage.getItem(NOTIFICATIONS_KEY);
    if (!stored) {
        localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(MOCK_NOTIFICATIONS));
        return MOCK_NOTIFICATIONS;
    }
    return JSON.parse(stored);
};

export const saveNotification = (notification) => {
    const notifications = getNotifications();
    const newNotification = {
        ...notification,
        id: Date.now(), // Simple ID generation
        time: 'Just now', // Initial time string
        read: false
    };
    const updated = [newNotification, ...notifications];
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(updated));
    return updated;
};

export const markNotificationAsRead = (id) => {
    const notifications = getNotifications();
    const updated = notifications.map(n =>
        n.id === id ? { ...n, read: true } : n
    );
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(updated));
    return updated;
};

export const markAllNotificationsAsRead = () => {
    const notifications = getNotifications();
    const updated = notifications.map(n => ({ ...n, read: true }));
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(updated));
    return updated;
};

const FLOORS_KEY = 'hms_floors';
const HISTORY_KEY = 'hms_tenant_history';

export const getFloors = () => {
    const stored = localStorage.getItem(FLOORS_KEY);
    if (!stored) {
        localStorage.setItem(FLOORS_KEY, JSON.stringify(MOCK_FLOORS));
        return MOCK_FLOORS;
    }
    return JSON.parse(stored);
};

export const getTenantHistory = () => {
    const stored = localStorage.getItem(HISTORY_KEY);
    return stored ? JSON.parse(stored) : [];
};

export const addToHistory = (tenant) => {
    const history = getTenantHistory();
    history.push({ ...tenant, vacatedDate: new Date().toISOString().split('T')[0] });
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
};

export const saveFloors = (floors) => {
    localStorage.setItem(FLOORS_KEY, JSON.stringify(floors));
    return floors;
};

export const addFloor = (floorNumber) => {
    const floors = getFloors();
    if (floors.some(f => f.number === floorNumber)) {
        throw new Error(`Floor ${floorNumber} already exists`);
    }
    const newFloor = {
        id: `floor_${floorNumber}_${Date.now()}`,
        number: floorNumber,
        rooms: []
    };
    // Sort floors by number
    const updatedFloors = [...floors, newFloor].sort((a, b) => a.number - b.number);
    saveFloors(updatedFloors);
    return updatedFloors;
};

export const addRoom = (floorId, roomData) => {
    const floors = getFloors();
    const floorIndex = floors.findIndex(f => f.id === floorId);
    if (floorIndex === -1) throw new Error('Floor not found');

    const newRoom = {
        id: `room_${roomData.number}_${Date.now()}`,
        number: roomData.number,
        capacity: parseInt(roomData.capacity),
        occupied: 0,
        type: roomData.type,
        rent: parseInt(roomData.rent),
        amenities: roomData.amenities || ['WiFi', 'Cupboard'],
        tenants: []
    };

    const updatedFloors = [...floors];
    updatedFloors[floorIndex] = {
        ...updatedFloors[floorIndex],
        rooms: [...updatedFloors[floorIndex].rooms, newRoom].sort((a, b) => a.number.localeCompare(b.number))
    };

    saveFloors(updatedFloors);
    return updatedFloors;
};

// Helper to find a room and update it
export const addTenantToRoom = (roomId, tenant) => {
    const floors = getFloors();
    let tenantAdded = false;

    const updatedFloors = floors.map(floor => ({
        ...floor,
        rooms: floor.rooms.map(room => {
            if (room.id === roomId) {
                // Check capacity
                if (room.occupied >= room.capacity) {
                    throw new Error('Room is full');
                }
                tenantAdded = true;
                return {
                    ...room,
                    occupied: room.occupied + 1,
                    tenants: [...(room.tenants || []), {
                        ...tenant,
                        id: Date.now().toString(),
                        joinDate: tenant.joinDate || new Date().toISOString().split('T')[0],
                        status: 'Paid' // Default status
                    }]
                };
            }
            return room;
        })
    }));

    if (!tenantAdded) throw new Error('Room not found');
    saveFloors(updatedFloors);
    return updatedFloors;
};

export const updateTenant = (tenantId, updates) => {
    const floors = getFloors();
    let tenantFound = false;

    const updatedFloors = floors.map(floor => {
        const floorHasTenant = floor.rooms.some(r => r.tenants?.some(t => t.id === tenantId));
        if (!floorHasTenant) return floor;

        return {
            ...floor,
            rooms: floor.rooms.map(room => {
                const tenantInRoom = room.tenants?.find(t => t.id === tenantId);
                if (tenantInRoom) {
                    tenantFound = true;
                    return {
                        ...room,
                        tenants: room.tenants.map(t =>
                            t.id === tenantId ? { ...t, ...updates } : t
                        )
                    };
                }
                return room;
            })
        };
    });

    if (!tenantFound) throw new Error('Tenant not found');
    saveFloors(updatedFloors);
    return updatedFloors;
};

export const removeTenant = (tenantId) => {
    const floors = getFloors();
    let tenantRemoved = false;

    const updatedFloors = floors.map(floor => ({
        ...floor,
        rooms: floor.rooms.map(room => {
            const tenant = room.tenants?.find(t => t.id === tenantId);
            if (tenant) {
                // Add to history with status Vacated
                addToHistory({ ...tenant, status: 'Vacated', roomId: room.number, floorId: floor.number });
                tenantRemoved = true;
                return {
                    ...room,
                    occupied: Math.max(0, room.occupied - 1),
                    tenants: room.tenants.filter(t => t.id !== tenantId)
                };
            }
            return room;
        })
    }));

    if (tenantRemoved) {
        saveFloors(updatedFloors);
    }
    return updatedFloors;
};

export const getTenantById = (tenantId) => {
    const floors = getFloors();
    for (const floor of floors) {
        for (const room of floor.rooms) {
            const tenant = room.tenants?.find(t => t.id === tenantId);
            if (tenant) {
                return { ...tenant, roomId: room.number, floorId: floor.number };
            }
        }
    }
    return null;
};

