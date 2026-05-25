import { MapPin, Navigation } from 'lucide-react';

export function Location() {
  return (
    <section id="location" className="py-16 md:py-24 bg-[#FFFDF5]">
      <div className="max-w-7xl mx-auto px-4">
        <h2
          className="text-3xl md:text-4xl text-center text-[#1B2D5B] mb-4"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Prime Location
        </h2>
        <p className="text-center text-[#2C2C2A] mb-12 max-w-2xl mx-auto">
          Conveniently located near SNIST — your daily commute is just a 5-minute walk
        </p>

        <div className="grid md:grid-cols-2 gap-8 items-start">
          <div className="bg-white p-8 rounded-xl shadow-lg space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-[#F07B1D] rounded-full flex items-center justify-center flex-shrink-0">
                <MapPin className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-[#1B2D5B] mb-2">Address</h3>
                <p className="text-[#2C2C2A]">
                  Sri Adithya Hostels<br />
                  FM37+P3V, Yamnampet<br />
                  Secunderabad, Telangana — 501301
                </p>
              </div>
            </div>

            <div className="bg-[#FBB040]/10 border border-[#FBB040] rounded-lg p-4">
              <div className="flex items-center gap-3">
                <Navigation className="w-6 h-6 text-[#F07B1D]" />
                <div>
                  <div className="font-semibold text-[#1B2D5B]">Just 400m from SNIST</div>
                  <div className="text-sm text-[#2C2C2A]">5 minute walk to campus gate</div>
                </div>
              </div>
            </div>

            <div className="pt-4">
              <a
                href="https://maps.app.goo.gl/8HdNTVcwywb2LXWB9"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full bg-[#1B2D5B] text-white py-3 rounded-lg hover:bg-[#152442] transition-colors"
              >
                <MapPin className="w-5 h-5" />
                <span>Get Directions</span>
              </a>
            </div>
          </div>

          <div className="rounded-xl overflow-hidden shadow-lg h-[400px]">
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3805.6476583849657!2d78.66027477516413!3d17.454272983432726!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bcb770dd641583b%3A0xde3e95b9afb8c1b1!2sSri%20Adithya%20Boys%20Hostel!5e0!3m2!1sen!2sin!4v1716500000000!5m2!1sen!2sin"
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Sri Adithya Hostels Location"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
