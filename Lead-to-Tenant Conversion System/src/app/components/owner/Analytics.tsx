import { TrendingUp, TrendingDown, Users, Eye, Heart, CheckCircle } from "lucide-react";
import { Card } from "../ui/card";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export function Analytics() {
  // Funnel Data - This Month vs Last Month
  const funnelData = [
    { id: "visitors", stage: "Visitors", thisMonth: 145, lastMonth: 132 },
    { id: "interested", stage: "Interested", thisMonth: 58, lastMonth: 48 },
    { id: "reserved", stage: "Reserved", thisMonth: 23, lastMonth: 19 },
    { id: "invited", stage: "Invited", thisMonth: 15, lastMonth: 12 },
    { id: "joined", stage: "Joined", thisMonth: 12, lastMonth: 10 },
  ];

  // Visitors Over Time (Last 30 Days)
  const visitorsOverTime = [
    { id: "may-1", date: "May 1", visitors: 3 },
    { id: "may-3", date: "May 3", visitors: 5 },
    { id: "may-5", date: "May 5", visitors: 4 },
    { id: "may-7", date: "May 7", visitors: 7 },
    { id: "may-9", date: "May 9", visitors: 6 },
    { id: "may-11", date: "May 11", visitors: 8 },
    { id: "may-13", date: "May 13", visitors: 5 },
    { id: "may-15", date: "May 15", visitors: 9 },
    { id: "may-17", date: "May 17", visitors: 7 },
    { id: "may-19", date: "May 19", visitors: 11 },
    { id: "may-21", date: "May 21", visitors: 8 },
    { id: "may-23", date: "May 23", visitors: 10 },
    { id: "may-25", date: "May 25", visitors: 12 },
    { id: "may-27", date: "May 27", visitors: 9 },
    { id: "may-29", date: "May 29", visitors: 14 },
  ];

  // Most Viewed Rooms
  const mostViewedRooms = [
    { id: "room-101", room: "Room 101", views: 45 },
    { id: "room-201", room: "Room 201", views: 38 },
    { id: "room-203", room: "Room 203", views: 32 },
    { id: "room-102", room: "Room 102", views: 28 },
    { id: "room-202", room: "Room 202", views: 24 },
  ];

  // Lost Reasons
  const lostReasons = [
    { id: "expensive", reason: "Too Expensive", count: 12, color: "var(--danger-red)" },
    { id: "vacancy", reason: "No Vacancy", count: 8, color: "var(--alert-amber)" },
    { id: "location", reason: "Location", count: 5, color: "var(--brand-saffron)" },
    { id: "other", reason: "Other", count: 3, color: "var(--neutral-gray)" },
  ];

  // Peak Visit Hours (Heatmap Data)
  const peakHours = [
    { id: "mon", day: "Mon", "9AM": 2, "12PM": 4, "3PM": 5, "6PM": 3 },
    { id: "tue", day: "Tue", "9AM": 3, "12PM": 5, "3PM": 6, "6PM": 4 },
    { id: "wed", day: "Wed", "9AM": 1, "12PM": 3, "3PM": 4, "6PM": 2 },
    { id: "thu", day: "Thu", "9AM": 4, "12PM": 6, "3PM": 7, "6PM": 5 },
    { id: "fri", day: "Fri", "9AM": 3, "12PM": 7, "3PM": 8, "6PM": 6 },
    { id: "sat", day: "Sat", "9AM": 5, "12PM": 8, "3PM": 9, "6PM": 7 },
    { id: "sun", day: "Sun", "9AM": 4, "12PM": 6, "3PM": 7, "6PM": 5 },
  ];

  const conversionRate = ((12 / 145) * 100).toFixed(1);
  const avgDaysToConvert = 4.2;
  const changeFromLastMonth = ((12 - 10) / 10) * 100;

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      {/* Header */}
      <div className="bg-[var(--brand-navy)] text-white px-6 py-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold mb-1">Analytics</h1>
          <p className="text-white/70 text-sm">Performance insights and conversion metrics</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm text-[var(--neutral-gray)] mb-1">Conversion Rate</p>
                <div className="flex items-baseline gap-2">
                  <span
                    className="text-4xl font-bold text-[var(--success-green)]"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {conversionRate}%
                  </span>
                  <div className="flex items-center gap-1 text-[var(--success-green)] text-sm">
                    <TrendingUp className="w-4 h-4" />
                    <span>{changeFromLastMonth.toFixed(0)}%</span>
                  </div>
                </div>
              </div>
              <div className="w-12 h-12 rounded-lg bg-[var(--success-green)]/10 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-[var(--success-green)]" />
              </div>
            </div>
            <p className="text-xs text-[var(--neutral-gray)]">
              {funnelData[0].thisMonth} visitors → {funnelData[4].thisMonth} joined this month
            </p>
          </Card>

          <Card className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm text-[var(--neutral-gray)] mb-1">Avg. Days to Convert</p>
                <div className="flex items-baseline gap-2">
                  <span
                    className="text-4xl font-bold text-[var(--brand-saffron)]"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {avgDaysToConvert}
                  </span>
                  <span className="text-sm text-[var(--neutral-gray)]">days</span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-lg bg-[var(--brand-saffron)]/10 flex items-center justify-center">
                <Heart className="w-6 h-6 text-[var(--brand-saffron)]" />
              </div>
            </div>
            <p className="text-xs text-[var(--neutral-gray)]">From first visit to joining</p>
          </Card>

          <Card className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm text-[var(--neutral-gray)] mb-1">Total Visitors</p>
                <div className="flex items-baseline gap-2">
                  <span
                    className="text-4xl font-bold text-[var(--brand-navy)]"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {funnelData[0].thisMonth}
                  </span>
                  <div className="flex items-center gap-1 text-[var(--success-green)] text-sm">
                    <TrendingUp className="w-4 h-4" />
                    <span>
                      {(
                        ((funnelData[0].thisMonth - funnelData[0].lastMonth) /
                          funnelData[0].lastMonth) *
                        100
                      ).toFixed(0)}
                      %
                    </span>
                  </div>
                </div>
              </div>
              <div className="w-12 h-12 rounded-lg bg-[var(--brand-navy)]/10 flex items-center justify-center">
                <Users className="w-6 h-6 text-[var(--brand-navy)]" />
              </div>
            </div>
            <p className="text-xs text-[var(--neutral-gray)]">This month vs last month</p>
          </Card>
        </div>

        {/* Admission Funnel Comparison */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-[var(--brand-navy)] mb-6">
            Admission Funnel — This Month vs Last Month
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={funnelData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
              <XAxis dataKey="stage" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar key="bar-this-month" dataKey="thisMonth" fill="var(--brand-saffron)" name="This Month" />
              <Bar key="bar-last-month" dataKey="lastMonth" fill="var(--brand-navy)" name="Last Month" opacity={0.6} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Visitors Over Time */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-[var(--brand-navy)] mb-6">
            Visitors Over Time (Last 30 Days)
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={visitorsOverTime}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line
                key="line-visitors"
                type="monotone"
                dataKey="visitors"
                stroke="var(--brand-saffron)"
                strokeWidth={3}
                dot={{ fill: "var(--brand-saffron)", r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Most Viewed Rooms */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-[var(--brand-navy)] mb-6 flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Most Viewed Rooms
            </h2>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={mostViewedRooms} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                <XAxis type="number" />
                <YAxis dataKey="room" type="category" width={80} />
                <Tooltip />
                <Bar key="bar-views" dataKey="views" fill="var(--brand-navy)" />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Lost Reasons */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-[var(--brand-navy)] mb-6">Lost Reasons</h2>
            <div className="flex items-center justify-between">
              <ResponsiveContainer width="50%" height={250}>
                <PieChart>
                  <Pie
                    data={lostReasons}
                    dataKey="count"
                    nameKey="reason"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label
                  >
                    {lostReasons.map((entry) => (
                      <Cell key={entry.id} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>

              <div className="flex-1 space-y-3">
                {lostReasons.map((reason) => (
                  <div key={reason.id} className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: reason.color }}
                    ></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[var(--deep-charcoal)]">
                        {reason.reason}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-[var(--neutral-gray)]">
                      {reason.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* Peak Visit Hours Heatmap */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-[var(--brand-navy)] mb-6">
            Peak Visit Hours (By Day & Time)
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left text-sm font-semibold text-[var(--neutral-gray)] pb-3">
                    Day
                  </th>
                  <th className="text-center text-sm font-semibold text-[var(--neutral-gray)] pb-3">
                    9 AM
                  </th>
                  <th className="text-center text-sm font-semibold text-[var(--neutral-gray)] pb-3">
                    12 PM
                  </th>
                  <th className="text-center text-sm font-semibold text-[var(--neutral-gray)] pb-3">
                    3 PM
                  </th>
                  <th className="text-center text-sm font-semibold text-[var(--neutral-gray)] pb-3">
                    6 PM
                  </th>
                </tr>
              </thead>
              <tbody>
                {peakHours.map((row) => (
                  <tr key={row.id}>
                    <td className="py-2 font-medium text-[var(--deep-charcoal)]">{row.day}</td>
                    {["9AM", "12PM", "3PM", "6PM"].map((time) => {
                      const value = row[time as keyof typeof row] as number;
                      const intensity = Math.min((value / 10) * 100, 100);
                      return (
                        <td key={`${row.id}-${time}`} className="py-2">
                          <div className="flex justify-center">
                            <div
                              className="w-16 h-12 rounded flex items-center justify-center font-mono font-semibold text-sm"
                              style={{
                                backgroundColor: `rgba(240, 123, 29, ${intensity / 100})`,
                                color: intensity > 50 ? "white" : "var(--deep-charcoal)",
                              }}
                            >
                              {value}
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-[var(--neutral-gray)] mt-4 text-center">
            Darker cells indicate higher visitor activity
          </p>
        </Card>
      </div>
    </div>
  );
}
