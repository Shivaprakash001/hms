export function StatsStrip() {
  const stats = [
    { number: '2', label: 'Hostel Buildings' },
    { number: '4', label: 'Sharing Rooms' },
    { number: '₹8,200', label: 'per month' },
    { number: '9+', label: 'Amenities' },
  ];

  return (
    <section className="bg-[#F07B1D] py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map((stat, index) => (
            <div key={index} className="text-center text-white">
              <div
                className="text-3xl md:text-4xl font-bold mb-1"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {stat.number}
              </div>
              <div className="text-sm md:text-base opacity-90">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
