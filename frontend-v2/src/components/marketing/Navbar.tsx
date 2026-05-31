import { Link } from 'react-router-dom';

export function Navbar() {
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <nav className="bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 no-underline">
            <img
              src="/android-chrome-512x512.png"
              alt="Adithya Boys Hostel"
              className="h-16 w-auto object-contain"
            />
            <span
              className="text-lg font-bold text-[#1B2D5B] leading-tight hidden sm:block"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Sri Adithya<br />Hostels
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-6">
            <button onClick={() => scrollToSection('home')} className="text-[#2C2C2A] hover:text-[#F07B1D] transition-colors">
              Home
            </button>
            <button onClick={() => scrollToSection('facilities')} className="text-[#2C2C2A] hover:text-[#F07B1D] transition-colors">
              Facilities
            </button>
            <button onClick={() => scrollToSection('rooms')} className="text-[#2C2C2A] hover:text-[#F07B1D] transition-colors">
              Rooms
            </button>
            <button onClick={() => scrollToSection('location')} className="text-[#2C2C2A] hover:text-[#F07B1D] transition-colors">
              Location
            </button>
            <button onClick={() => scrollToSection('contact')} className="text-[#2C2C2A] hover:text-[#F07B1D] transition-colors">
              Contact
            </button>
            <Link
              to="/login?signin=1"
              className="text-[#1B2D5B] hover:text-[#F07B1D] font-medium transition-colors no-underline text-sm"
            >
              Login
            </Link>
            <button
              onClick={() => scrollToSection('contact')}
              className="bg-[#F07B1D] text-white px-6 py-2 rounded-lg hover:bg-[#d96e18] transition-colors"
            >
              Enquire Now
            </button>
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <Link
              to="/login?signin=1"
              className="text-[#1B2D5B] font-semibold text-sm no-underline border border-[#1B2D5B] px-4 py-2 rounded-lg hover:bg-[#1B2D5B] hover:text-white transition-colors"
            >
              Login
            </Link>
            <button
              onClick={() => scrollToSection('contact')}
              className="bg-[#F07B1D] text-white px-4 py-2 rounded-lg hover:bg-[#d96e18] transition-colors text-sm font-semibold"
            >
              Enquire Now
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
