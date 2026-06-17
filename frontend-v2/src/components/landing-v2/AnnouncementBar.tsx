import { Megaphone } from 'lucide-react';

interface AnnouncementBarProps {
  text: string;
  linkText?: string;
}

export function AnnouncementBar({ text, linkText }: AnnouncementBarProps) {
  const handleScroll = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    document.getElementById('rooms')?.scrollIntoView({ behavior: 'smooth' });
  };

  const cleanLinkText = linkText ? linkText.replace(/[→\->\s]+$/, '') : '';

  return (
    <div className="bg-[#F07B1D] text-[#1B2D5B] py-1.5 px-4 shadow-sm relative z-40 border-b border-[#1B2D5B]/10">
      <div className="max-w-7xl mx-auto flex items-center justify-center gap-1.5 text-center text-xs md:text-sm font-semibold select-none flex-wrap">
        <Megaphone className="w-3.5 h-3.5 md:w-4 md:h-4 animate-bounce shrink-0" />
        <span>{text}</span>
        {cleanLinkText && (
          <a
            href="#rooms"
            onClick={handleScroll}
            className="underline hover:text-[#1B2D5B]/80 transition-colors ml-1 inline-flex items-center gap-0.5 font-bold"
          >
            {cleanLinkText} &rarr;
          </a>
        )}
      </div>
    </div>
  );
}
