import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutGrid, Plus, Trash2, ArrowRight, ArrowLeft, Home, IndianRupee, Users } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import OnboardingLayout from '@/components/onboarding/OnboardingLayout';
import { useNavigate } from 'react-router-dom';

const sharingTypes = [
  { id: 'single', name: 'Single', icon: '1' },
  { id: 'double', name: 'Double', icon: '2' },
  { id: 'triple', name: 'Triple', icon: '3' },
  { id: 'dorm', name: 'Dorm', icon: 'D' }
];

const RoomSetup = () => {
  const [roomCount, setRoomCount] = useState(5);
  const [rooms, setRooms] = useState([]);
  const [isGenerated, setIsGenerated] = useState(false);
  const navigate = useNavigate();

  const generateRooms = () => {
    const newRooms = Array.from({ length: roomCount }, (_, i) => ({
      id: i + 1,
      name: `${101 + i}`,
      sharingType: 'double',
      rent: 8000,
      capacity: 2
    }));
    setRooms(newRooms);
    setIsGenerated(true);
  };

  const updateRoom = (id, field, value) => {
    setRooms(rooms.map(room => room.id === id ? { ...room, [field]: value } : room));
  };

  const deleteRoom = (id) => {
    setRooms(rooms.filter(room => room.id !== id));
  };

  return (
    <OnboardingLayout>
      <div className="w-full max-w-5xl mx-auto">
        {!isGenerated ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 p-12 text-center"
          >
            <div className="w-20 h-20 bg-purple-100 text-purple-600 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-sm">
              <Home className="w-10 h-10" />
            </div>
            <h1 className="text-3xl font-black text-slate-900 mb-4">Quick Room Generator</h1>
            <p className="text-slate-500 mb-10 max-w-md mx-auto">
              How many rooms would you like to auto-generate for your hostel? You can edit them later.
            </p>

            <div className="flex items-center justify-center gap-6 mb-12">
              <button 
                onClick={() => setRoomCount(Math.max(1, roomCount - 1))}
                className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-200 text-2xl font-bold text-slate-600 hover:bg-slate-100 transition-all"
              >
                -
              </button>
              <div className="text-6xl font-black text-purple-600 w-32 tracking-tighter">
                {roomCount}
              </div>
              <button 
                onClick={() => setRoomCount(roomCount + 1)}
                className="w-16 h-16 rounded-2xl bg-purple-600 text-2xl font-bold text-white hover:bg-purple-700 shadow-lg shadow-purple-100 transition-all"
              >
                +
              </button>
            </div>

            <Button 
              onClick={generateRooms}
              className="h-16 px-12 bg-brand-gradient text-white rounded-2xl font-black text-xl shadow-xl shadow-purple-200 flex items-center justify-center gap-3 mx-auto group"
            >
              Generate Rooms
              <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
            </Button>
          </motion.div>
        ) : (
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Room Inventory</h1>
                <p className="text-slate-500">Customize your {rooms.length} generated rooms</p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="h-12 px-6 rounded-xl border-slate-200 font-bold flex items-center gap-2" onClick={() => setIsGenerated(false)}>
                  <ArrowLeft className="w-4 h-4" />
                  Reset
                </Button>
                <Button className="h-12 px-6 bg-slate-900 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-slate-800" onClick={() => setRooms([...rooms, { id: Date.now(), name: `${100 + rooms.length + 1}`, sharingType: 'double', rent: 8000, capacity: 2 }])}>
                  <Plus className="w-4 h-4" />
                  Add Room
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <AnimatePresence>
                {rooms.map((room, idx) => (
                  <motion.div
                    key={room.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ delay: idx * 0.05 }}
                    className="bg-white rounded-[2rem] border border-slate-100 shadow-xl hover:shadow-2xl transition-all p-6 group"
                  >
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center font-black">
                          {room.name[0]}
                        </div>
                        <input 
                          value={room.name}
                          onChange={(e) => updateRoom(room.id, 'name', e.target.value)}
                          className="bg-transparent text-lg font-black text-slate-900 outline-none w-20 border-b border-transparent focus:border-purple-300 transition-all"
                        />
                      </div>
                      <button 
                        onClick={() => deleteRoom(room.id)}
                        className="w-8 h-8 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 flex items-center justify-center transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2 px-1">Sharing Type</label>
                        <div className="flex gap-2">
                          {sharingTypes.map((type) => (
                            <button
                              key={type.id}
                              onClick={() => updateRoom(room.id, 'sharingType', type.id)}
                              className={`flex-1 h-10 rounded-xl text-[10px] font-black transition-all ${room.sharingType === type.id ? 'bg-purple-600 text-white shadow-md' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                            >
                              {type.name}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2 px-1">Rent</label>
                          <div className="relative">
                            <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                            <input 
                              type="number"
                              value={room.rent}
                              onChange={(e) => updateRoom(room.id, 'rent', e.target.value)}
                              className="w-full h-10 pl-8 pr-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-purple-100 transition-all"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2 px-1">Capacity</label>
                          <div className="relative">
                            <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                            <input 
                              type="number"
                              value={room.capacity}
                              onChange={(e) => updateRoom(room.id, 'capacity', e.target.value)}
                              className="w-full h-10 pl-8 pr-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-purple-100 transition-all"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            <div className="pt-8 flex justify-center">
              <Button 
                onClick={() => navigate('/onboarding/tenant-setup')}
                className="h-16 px-12 bg-brand-gradient text-white rounded-2xl font-black text-xl shadow-xl shadow-purple-200 flex items-center justify-center gap-3 group"
              >
                Save & Continue
                <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </OnboardingLayout>
  );
};

export default RoomSetup;
