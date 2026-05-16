import { useMemo, useEffect } from 'react';
import { useRooms as useRoomsQuery } from '../../../hooks/useRooms';
import { normalizeFloors, findRoomById, calculateRoomStats } from '../utils/roomHelpers';

export const useRooms = ({ hostelId, filterStatus, selectedRoom, setSelectedRoom }) => {
    // 1. Data Fetching
    const {
        data: floorsData,
        isLoading: loading,
        error: fetchError,
        refetch: refetchRooms
    } = useRoomsQuery(hostelId, { grouped: true });

    // 2. Derived State: Normalized Floors
    const floors = useMemo(() => normalizeFloors(floorsData), [floorsData]);
    const error = fetchError ? "Failed to load room data. Please try again." : null;

    // 3. Derived State: Stats
    const stats = useMemo(() => calculateRoomStats(floors), [floors]);

    // 4. Derived State: Filtered Floors/Rooms
    const filteredFloors = useMemo(() => {
        if (!floors || floors.length === 0) return [];
        return floors.map(floor => ({
            ...floor,
            rooms: floor.rooms.filter(room => filterStatus === 'All' || room.status === filterStatus)
        }));
    }, [floors, filterStatus]);

    // 5. Selection Synchronization
    useEffect(() => {
        if (selectedRoom && floors.length > 0) {
            const updatedRoom = findRoomById(floors, selectedRoom.id);
            if (updatedRoom && JSON.stringify(updatedRoom) !== JSON.stringify(selectedRoom)) {
                if (setSelectedRoom) setSelectedRoom(updatedRoom);
            }
        }
    }, [floors, selectedRoom?.id, setSelectedRoom]);

    return {
        floors,
        filteredFloors,
        stats,
        loading,
        error,
        refetchRooms,
    };
};
