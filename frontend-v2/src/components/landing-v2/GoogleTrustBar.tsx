import { Star } from 'lucide-react';

export function GoogleTrustBar() {
  return (
    <div className="bg-[#FFFDF5] border-b border-[#F07B1D]/10 py-1.5 px-4 text-center flex items-center justify-center gap-1.5 text-xs text-[#2C2C2A] font-semibold">
      <Star className="w-3.5 h-3.5 fill-[#FBB040] text-[#FBB040]" />
      <span>4.2★ on Google</span>
      <span className="text-[#2C2C2A]/25">|</span>
      <span>51 reviews</span>
      <span className="text-[#2C2C2A]/25">|</span>
      <span>Since 2019</span>
    </div>
  );
}
