import { useState, useEffect, useRef } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Bed, Building2, UtensilsCrossed, Tv, Wifi, Shield } from 'lucide-react';
import type { TourVideoContent } from '@lib/sanity/landingContent';

interface TourVideo {
  id: string;
  label: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  bed: Bed,
  building: Building2,
  utensils: UtensilsCrossed,
  tv: Tv,
  wifi: Wifi,
  security: Shield,
};

const FALLBACK_VIDEOS: TourVideo[] = [
  {
    id: 'room',
    label: 'Room',
    url: 'https://www.w3schools.com/html/mov_bbb.mp4',
    icon: Bed,
  },
  {
    id: 'common',
    label: 'Common',
    url: 'https://media.w3.org/2010/05/sintel/trailer_hd.mp4',
    icon: Building2,
  },
  {
    id: 'dining',
    label: 'Dining',
    url: 'https://media.w3.org/2010/05/bunny/trailer.mp4',
    icon: UtensilsCrossed,
  },
];

interface VideoPlayerProps {
  videos?: TourVideoContent[];
}

export function VideoPlayer({ videos }: VideoPlayerProps) {
  // Map input videos from Sanity to resolved TourVideo items using the icon map
  const tourVideos: TourVideo[] = Array.isArray(videos) && videos.length > 0
    ? videos.map((v) => ({
        id: v.id,
        label: v.label,
        url: v.url,
        icon: ICON_MAP[v.icon] || Bed,
      }))
    : FALLBACK_VIDEOS;

  const [activeTab, setActiveTab] = useState<string>('');

  // Sync activeTab when videos load or change
  useEffect(() => {
    if (tourVideos.length > 0) {
      setActiveTab(tourVideos[0].id);
    }
  }, [videos]);

  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [progress, setProgress] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<string>('0:00');
  const [duration, setDuration] = useState<string>('0:00');
  const [showControls, setShowControls] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const activeVideo = tourVideos.find((v) => v.id === activeTab) || tourVideos[0] || FALLBACK_VIDEOS[0];

  // AutoPlay / Reset state on tab change
  useEffect(() => {
    if (videoRef.current && activeVideo?.url) {
      videoRef.current.load();
      videoRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  }, [activeTab, activeVideo?.url]);

  // Handle pointer/mouse movement to show/hide controls
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 2500);
  };

  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [isPlaying]);

  const togglePlay = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
      setShowControls(true);
    } else {
      videoRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(console.error);
    }
  };

  const toggleMute = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const current = videoRef.current.currentTime;
    const total = videoRef.current.duration || 0;
    if (total > 0) {
      setProgress((current / total) * 100);
    }
    setCurrentTime(formatTime(current));
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    setDuration(formatTime(videoRef.current.duration));
  };

  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const percentage = clickX / width;
    const newTime = percentage * videoRef.current.duration;
    videoRef.current.currentTime = newTime;
    setProgress(percentage * 100);
  };

  const handleFullscreen = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(console.error);
    } else {
      containerRef.current.requestFullscreen().catch(console.error);
    }
  };

  const formatTime = (timeInSeconds: number) => {
    if (isNaN(timeInSeconds)) return '0:00';
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  return (
    <div className="w-full space-y-4">
      {/* Premium Tab Bar for Tour Scenes */}
      <div className="flex bg-[#1B2D5B]/5 p-1 rounded-xl border border-[#1B2D5B]/10 max-w-md mx-auto sm:max-w-none">
        {tourVideos.map((tab) => {
          const TabIcon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-1 rounded-lg text-[10px] sm:text-xs font-semibold transition-all duration-300 ${
                isActive
                  ? 'bg-white text-[#1B2D5B] shadow-md scale-[1.02]'
                  : 'text-[#1B2D5B]/70 hover:text-[#1B2D5B] hover:bg-white/40'
              }`}
            >
              <TabIcon className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-[#F07B1D]' : 'text-[#1B2D5B]/60'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Video Container */}
      <div
        ref={containerRef}
        className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden shadow-2xl bg-black border border-[#1B2D5B]/10 group"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => isPlaying && setShowControls(false)}
        onClick={togglePlay}
      >
        <video
          ref={videoRef}
          src={activeVideo.url}
          className="w-full h-full object-cover"
          autoPlay
          muted={isMuted}
          loop
          playsInline
          preload="metadata"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
        />

        {/* Video Overlay Darkener (Top & Bottom gradients) */}
        <div className={`absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 transition-opacity duration-300 pointer-events-none ${showControls ? 'opacity-100' : 'opacity-0'}`} />

        {/* Big Glassmorphic Play button when Paused */}
        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center animate-pulse shadow-lg">
              <Play className="w-8 h-8 text-white fill-current translate-x-0.5" />
            </div>
          </div>
        )}

        {/* Muted Watermark Overlay when Muted & Playing */}
        {isMuted && isPlaying && !showControls && (
          <button
            onClick={toggleMute}
            className="absolute bottom-4 right-4 flex items-center gap-1.5 bg-black/60 hover:bg-black/80 backdrop-blur-sm text-white text-[11px] font-semibold py-1.5 px-3 rounded-full border border-white/20 shadow transition-all duration-300"
          >
            <VolumeX className="w-3.5 h-3.5 text-white" />
            <span>Muted — Click to unmute</span>
          </button>
        )}

        {/* Custom Controller Bar */}
        <div
          className={`absolute bottom-0 left-0 right-0 p-4 space-y-3 transition-all duration-300 flex flex-col justify-end ${
            showControls ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0 pointer-events-none'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Progress Bar */}
          <div
            className="group/progress h-1.5 hover:h-2.5 w-full bg-white/20 rounded-full cursor-pointer transition-all duration-200"
            onClick={handleProgressBarClick}
          >
            <div
              className="h-full bg-gradient-to-r from-[#F07B1D] to-orange-400 rounded-full relative"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover/progress:opacity-100 shadow transition-opacity duration-150" />
            </div>
          </div>

          {/* Button Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={togglePlay}
                className="text-white hover:text-[#F07B1D] transition-colors p-1"
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
              </button>

              <button
                onClick={toggleMute}
                className="text-white hover:text-[#F07B1D] transition-colors p-1"
                aria-label={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>

              <span className="text-white text-xs font-mono font-medium">
                {currentTime} <span className="opacity-50">/</span> {duration}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Tour badge */}
              <span className="hidden sm:inline bg-[#F07B1D] text-white text-[10px] uppercase font-bold tracking-widest px-2.5 py-1 rounded">
                Live Tour
              </span>

              <button
                onClick={handleFullscreen}
                className="text-white hover:text-[#F07B1D] transition-colors p-1"
                aria-label="Fullscreen"
              >
                <Maximize className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
