import { Link } from 'react-router-dom';
import hostelLogo from './assets/hostel_icon.jpeg';

export function Navbar() {
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <nav className="bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={hostelLogo}
              alt="Sri Adithya Hostels Logo"
              className="w-12 h-12 object-contain"
            />
            <div>
              <h1 className="text-xl font-semibold text-[#1B2D5B]" style={{ fontFamily: 'var(--font-display)' }}>
                Sri Adithya Hostels
              </h1>
            </div>
          </div>

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
              className="text-[#2C2C2A] hover:text-[#F07B1D] transition-colors border border-[#F07B1D] px-4 py-2 rounded-lg"
            >
              Login
            </Link>
            <button
              onClick={() => scrollToSection('contact')}
              className="bg-[#F07B1D] text-white px-6 py-2 rounded-lg hover:bg-[#d96e18] transition-colors relative"
            >
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-600 rounded-full animate-pulse" />
              Enquire Now
            </button>
          </div>

          <div className="md:hidden flex items-center gap-2">
            <Link
              to="/login?signin=1"
              className="text-[#2C2C2A] border border-[#F07B1D] px-3 py-2 rounded-lg text-sm"
            >
              Login
            </Link>
            <button
              onClick={() => scrollToSection('contact')}
              className="bg-[#F07B1D] text-white px-4 py-2 rounded-lg hover:bg-[#d96e18] transition-colors text-sm relative"
            >
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-600 rounded-full animate-pulse" />
              Enquire Now
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
