import { Phone, MessageCircle } from 'lucide-react';

export function OwnerCard() {
  return (
    <div className="bg-[#FFFDF5] rounded-2xl p-6 shadow-lg border-l-4 border-[#F07B1D]">
      <div className="flex items-center gap-4">
        <div className="relative flex-shrink-0">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#F07B1D]/20 to-[#1B2D5B]/20 flex items-center justify-center overflow-hidden border-4 border-white shadow-lg">
            <div className="w-full h-full flex items-center justify-center text-[#1B2D5B] font-bold text-2xl">
              SR
            </div>
          </div>
        </div>

        <div className="flex-1">
          <h3 className="font-semibold text-[#1B2D5B] text-lg">
            Srinivasa Rao
          </h3>
          <p className="text-sm text-[#2C2C2A]/60 mb-1">
            Owner, Sri Adithya Hostels
          </p>
          <p className="text-sm text-[#F07B1D] italic">
            Here to help you find your home near SNIST.
          </p>
        </div>
      </div>

      <div className="flex gap-3 mt-4 pt-4 border-t border-[#F07B1D]/20">
        <a
          href="tel:9392433422"
          className="flex items-center justify-center gap-2 flex-1 bg-[#F07B1D] text-white px-4 py-2.5 rounded-lg hover:bg-[#d96e18] transition-colors text-sm font-medium"
        >
          <Phone className="w-4 h-4" />
          <span>Call</span>
        </a>
        <a
          href="https://api.whatsapp.com/send?phone=919392433422"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 flex-1 bg-green-500 text-white px-4 py-2.5 rounded-lg hover:bg-green-600 transition-colors text-sm font-medium"
        >
          <MessageCircle className="w-4 h-4" />
          <span>WhatsApp</span>
        </a>
      </div>
    </div>
  );
}
