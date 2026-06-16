import { useState } from 'react';
import { Phone, Mail, MessageCircle, Send } from 'lucide-react';

export function EnquiryForm() {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    moveInDate: '',
    message: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const whatsappMessage = encodeURIComponent(
      `Hi! I'm interested in Sri Adithya Boys Hostel.\n\nName: ${formData.name}\nPhone: ${formData.phone}\nPreferred Move-in Date: ${formData.moveInDate}\n\nMessage: ${formData.message}`,
    );

    window.open(`https://wa.me/919392433422?text=${whatsappMessage}`, '_blank');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <section id="contact" className="py-16 md:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4">
        <h2
          className="text-3xl md:text-4xl text-center text-[#1B2D5B] mb-4"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Get in Touch
        </h2>
        <p className="text-center text-[#2C2C2A] mb-12 max-w-2xl mx-auto">
          Have questions? We're here to help. Contact us today!
        </p>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="bg-[#FFFDF5] p-8 rounded-xl shadow-lg">
              <h3 className="text-xl font-semibold text-[#1B2D5B] mb-6">Contact Information</h3>

              <div className="space-y-4">
                <a
                  href="tel:9392433422"
                  className="flex items-center gap-4 p-4 bg-white rounded-lg hover:shadow-md transition-shadow group"
                >
                  <div className="w-12 h-12 bg-[#F07B1D] rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Phone className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="text-sm text-[#2C2C2A]">Phone</div>
                    <div className="font-semibold text-[#1B2D5B]">9392433422</div>
                  </div>
                </a>

                <a
                  href="https://wa.me/919392433422"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 p-4 bg-white rounded-lg hover:shadow-md transition-shadow group"
                >
                  <div className="w-12 h-12 bg-[#F07B1D] rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                    <MessageCircle className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="text-sm text-[#2C2C2A]">WhatsApp</div>
                    <div className="font-semibold text-[#1B2D5B]">Chat with us</div>
                  </div>
                </a>

                <div className="flex items-center gap-4 p-4 bg-white rounded-lg">
                  <div className="w-12 h-12 bg-[#1B2D5B] rounded-full flex items-center justify-center">
                    <Mail className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="text-sm text-[#2C2C2A]">Address</div>
                    <div className="font-semibold text-[#1B2D5B]">Yamnampet, Secunderabad</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[#F07B1D] text-white p-6 rounded-xl">
              <p className="text-center font-medium">Available 24/7 for enquiries and bookings</p>
            </div>
          </div>

          <div className="bg-[#FFFDF5] p-8 rounded-xl shadow-lg">
            <h3 className="text-xl font-semibold text-[#1B2D5B] mb-6">Send us a message</h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="enq-name" className="block text-sm font-medium text-[#2C2C2A] mb-2">
                  Full Name *
                </label>
                <input
                  type="text"
                  id="enq-name"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-white border border-[#F07B1D]/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F07B1D] text-[#2C2C2A]"
                  placeholder="Enter your name"
                />
              </div>

              <div>
                <label htmlFor="enq-phone" className="block text-sm font-medium text-[#2C2C2A] mb-2">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  id="enq-phone"
                  name="phone"
                  required
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-white border border-[#F07B1D]/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F07B1D] text-[#2C2C2A]"
                  placeholder="Enter your phone number"
                />
              </div>

              <div>
                <label htmlFor="enq-date" className="block text-sm font-medium text-[#2C2C2A] mb-2">
                  Preferred Move-in Date
                </label>
                <input
                  type="date"
                  id="enq-date"
                  name="moveInDate"
                  value={formData.moveInDate}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-white border border-[#F07B1D]/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F07B1D] text-[#2C2C2A]"
                />
              </div>

              <div>
                <label htmlFor="enq-message" className="block text-sm font-medium text-[#2C2C2A] mb-2">
                  Message
                </label>
                <textarea
                  id="enq-message"
                  name="message"
                  rows={4}
                  value={formData.message}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-white border border-[#F07B1D]/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F07B1D] text-[#2C2C2A] resize-none"
                  placeholder="Any specific questions or requirements?"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-[#F07B1D] text-white py-4 rounded-lg hover:bg-[#d96e18] transition-colors font-semibold flex items-center justify-center gap-2"
              >
                <Send className="w-5 h-5" />
                <span>Send Enquiry via WhatsApp</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
