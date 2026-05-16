export const normalizeFloors = (floorsData) => (
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

export const findRoomById = (floorsList, roomId) => (
    (floorsList || []).flatMap((floor) => floor.rooms).find((room) => room.id === roomId) || null
);

export const calculateRoomStats = (floors) => {
    const safeFloors = floors || [];
    const totalRooms = safeFloors.reduce((acc, f) => acc + (f.rooms?.length || 0), 0);
    const totalCapacity = safeFloors.reduce((acc, f) => acc + (f.rooms || []).reduce((rAcc, r) => rAcc + (r.capacity || 0), 0), 0);
    const totalOccupants = safeFloors.reduce((acc, f) => acc + (f.rooms || []).reduce((rAcc, r) => rAcc + (r.tenants?.length || 0), 0), 0);
    const occupancyRate = totalCapacity > 0 ? Math.round((totalOccupants / totalCapacity) * 100) : 0;

    return {
        totalRooms,
        totalCapacity,
        totalOccupants,
        occupancyRate
    };
};
