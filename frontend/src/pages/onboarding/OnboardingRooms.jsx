import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutGrid, Plus, Trash2, ArrowRight, ArrowLeft, Home, IndianRupee, Users } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useNavigate } from 'react-router-dom';

const sharingTypes = [
  { id: 'single', name: 'Single', icon: '1' },
  { id: 'double', name: 'Double', icon: '2' },
  { id: 'triple', name: 'Triple', icon: '3' },
  { id: 'dorm', name: 'Dorm', icon: 'D' }
];

export default function OnboardingRooms() {
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
    <div className="w-full">
      {!isGenerated ? (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-[3rem] shadow-2xl border border-slate-100 p-12 text-center"
        >
          <div className="w-24 h-24 bg-purple-50 text-purple-600 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-xl shadow-purple-50/50">
            <Home className="w-12 h-12" />
          </div>
          <h1 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">Room Generator</h1>
          <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mb-10 max-w-xs mx-auto">
            How many rooms would you like to auto-generate?
          </p>

          <div className="flex items-center justify-center gap-8 mb-12">
            <button 
              onClick={() => setRoomCount(Math.max(1, roomCount - 1))}
              className="w-16 h-16 rounded-2xl bg-white border border-slate-100 text-3xl font-black text-slate-400 hover:text-slate-900 hover:border-slate-300 transition-all active:scale-90"
            >
              -
            </button>
            <div className="text-8xl font-black text-slate-900 w-40 tracking-tighter tabular-nums">
              {roomCount}
            </div>
            <button 
              onClick={() => setRoomCount(roomCount + 1)}
              className="w-16 h-16 rounded-2xl bg-slate-900 text-3xl font-black text-white hover:bg-slate-800 shadow-xl shadow-slate-200 transition-all active:scale-90"
            >
              +
            </button>
          </div>

          <Button 
            onClick={generateRooms}
            className="h-16 px-12 bg-brand-gradient text-white rounded-2xl font-black text-xl shadow-2xl shadow-purple-200 flex items-center justify-center gap-4 mx-auto group hover:scale-[1.02] transition-all"
          >
            Generate My Rooms
            <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
          </Button>
        </motion.div>
      ) : (
        <div className="space-y-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-2">
            <div>
              <h1 className="text-4xl font-black text-slate-900 tracking-tight">Room Inventory</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-2">Manage your {rooms.length} generated rooms</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="h-12 px-6 rounded-xl border-slate-100 text-slate-400 font-bold hover:text-slate-900 hover:bg-slate-50 transition-all" onClick={() => setIsGenerated(false)}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Reset
              </Button>
              <Button className="h-12 px-6 bg-slate-900 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-slate-800 shadow-lg shadow-slate-200" onClick={() => setRooms([...rooms, { id: Date.now(), name: `${100 + rooms.length + 1}`, sharingType: 'double', rent: 8000, capacity: 2 }])}>
                <Plus className="w-4 h-4" />
                Add Room
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {rooms.map((room, idx) => (
                <motion.div
                  key={room.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-50 hover:shadow-2xl hover:shadow-purple-50 transition-all p-8 group relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-slate-50 rounded-bl-[3rem] -mr-8 -mt-8 transition-colors group-hover:bg-purple-50" />
                  
                  <div className="flex justify-between items-start mb-8 relative z-10">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center font-black text-purple-600 shadow-md">
                        {room.name[0]}
                      </div>
                      <input 
                        value={room.name}
                        onChange={(e) => updateRoom(room.id, 'name', e.target.value)}
                        className="bg-transparent text-xl font-black text-slate-900 outline-none w-20 border-b-2 border-transparent focus:border-purple-300 transition-all"
                      />
                    </div>
                    <button 
                      onClick={() => deleteRoom(room.id)}
                      className="w-10 h-10 rounded-xl text-slate-200 hover:text-rose-500 hover:bg-rose-50 flex items-center justify-center transition-all"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-6 relative z-10">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-3 px-1">Sharing Type</label>
                      <div className="flex gap-2">
                        {sharingTypes.map((type) => (
                          <button
                            key={type.id}
                            onClick={() => updateRoom(room.id, 'sharingType', type.id)}
                            className={`flex-1 h-10 rounded-xl text-[10px] font-black transition-all uppercase tracking-tight ${room.sharingType === type.id ? 'bg-purple-600 text-white shadow-lg shadow-purple-100' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                          >
                            {type.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block px-1">Monthly Rent</label>
                        <div className="relative">
                          <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                          <input 
                            type="number"
                            value={room.rent}
                            onChange={(e) => updateRoom(room.id, 'rent', e.target.value)}
                            className="w-full h-12 pl-9 pr-3 bg-slate-50/50 border border-slate-100 rounded-xl text-sm font-bold text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-purple-100 transition-all"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block px-1">Capacity</label>
                        <div className="relative">
                          <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                          <input 
                            type="number"
                            value={room.capacity}
                            onChange={(e) => updateRoom(room.id, 'capacity', e.target.value)}
                            className="w-full h-12 pl-9 pr-3 bg-slate-50/50 border border-slate-100 rounded-xl text-sm font-bold text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-purple-100 transition-all"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <div className="pt-12 flex justify-center">
            <Button 
              onClick={() => navigate('/onboarding/tenant')}
              className="h-16 px-16 bg-brand-gradient text-white rounded-2xl font-black text-xl shadow-2xl shadow-purple-200 flex items-center justify-center gap-4 group hover:scale-[1.02] active:scale-95 transition-all"
            >
              Save & Continue
              <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
