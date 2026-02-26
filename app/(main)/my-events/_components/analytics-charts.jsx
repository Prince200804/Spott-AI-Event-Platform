"use client";

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import {
  TrendingUp,
  MapPin,
  CreditCard,
  CalendarDays,
  Clock,
  Users,
} from "lucide-react";

const COLORS = ["#8b5cf6", "#06b6d4", "#f59e0b", "#22c55e", "#ef4444", "#ec4899", "#3b82f6", "#14b8a6"];

// Custom tooltip
function CustomTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background border rounded-lg p-3 shadow-lg">
        <p className="font-medium text-sm">{label}</p>
        {payload.map((entry, i) => (
          <p key={i} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
}

// Registration Trend Chart
export function RegistrationTrendChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <Card className="py-0">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-purple-500" />
            <h3 className="font-semibold">Registration Trend</h3>
          </div>
          <div className="h-[250px] flex items-center justify-center text-muted-foreground">
            No registration data yet
          </div>
        </CardContent>
      </Card>
    );
  }

  // Format date labels
  const formatted = data.map((d) => ({
    ...d,
    label: new Date(d.date + "T00:00:00").toLocaleDateString("en-IN", {
      month: "short",
      day: "numeric",
    }),
  }));

  return (
    <Card className="py-0">
      <CardContent className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-purple-500" />
          <h3 className="font-semibold">Registration Trend</h3>
        </div>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={formatted}>
              <defs>
                <linearGradient id="colorReg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
              <XAxis dataKey="label" fontSize={12} />
              <YAxis fontSize={12} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Area
                type="monotone"
                dataKey="cumulative"
                stroke="#8b5cf6"
                fill="url(#colorReg)"
                name="Total Registrations"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="registrations"
                stroke="#06b6d4"
                fill="transparent"
                name="Daily New"
                strokeWidth={2}
                strokeDasharray="5 5"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// Payment Breakdown Pie Chart
export function PaymentBreakdownChart({ data }) {
  if (!data || (!data.statusData?.length && !data.methodData?.length)) {
    return (
      <Card className="py-0">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="w-5 h-5 text-green-500" />
            <h3 className="font-semibold">Payment Breakdown</h3>
          </div>
          <div className="h-[250px] flex items-center justify-center text-muted-foreground">
            No payment data yet
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="py-0">
      <CardContent className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard className="w-5 h-5 text-green-500" />
          <h3 className="font-semibold">Payment Breakdown</h3>
        </div>
        <div className="h-[250px] flex gap-4">
          {/* Payment Status */}
          <div className="flex-1">
            <p className="text-xs text-muted-foreground text-center mb-2">
              Status
            </p>
            <ResponsiveContainer width="100%" height="85%">
              <PieChart>
                <Pie
                  data={data.statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {data.statusData.map((entry, index) => (
                    <Cell key={index} fill={entry.fill || COLORS[index]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend fontSize={12} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {/* Payment Method */}
          {data.methodData?.length > 0 && (
            <div className="flex-1">
              <p className="text-xs text-muted-foreground text-center mb-2">
                Method
              </p>
              <ResponsiveContainer width="100%" height="85%">
                <PieChart>
                  <Pie
                    data={data.methodData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {data.methodData.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend fontSize={12} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Geographic Distribution Bar Chart
export function GeographicChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <Card className="py-0">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="w-5 h-5 text-orange-500" />
            <h3 className="font-semibold">Attendee Locations</h3>
          </div>
          <div className="h-[250px] flex items-center justify-center text-muted-foreground">
            No location data yet
          </div>
        </CardContent>
      </Card>
    );
  }

  // Take top 8 cities
  const top = data.slice(0, 8);

  return (
    <Card className="py-0">
      <CardContent className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="w-5 h-5 text-orange-500" />
          <h3 className="font-semibold">Attendee Locations</h3>
        </div>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={top} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
              <XAxis type="number" fontSize={12} allowDecimals={false} />
              <YAxis
                dataKey="city"
                type="category"
                fontSize={12}
                width={80}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar
                dataKey="count"
                fill="#f59e0b"
                name="Attendees"
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// Check-in Timeline Chart
export function CheckInTimelineChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <Card className="py-0">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-cyan-500" />
            <h3 className="font-semibold">Check-in Timeline</h3>
          </div>
          <div className="h-[250px] flex items-center justify-center text-muted-foreground">
            No check-in data yet
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="py-0">
      <CardContent className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-cyan-500" />
          <h3 className="font-semibold">Check-in Timeline</h3>
        </div>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
              <XAxis dataKey="time" fontSize={12} />
              <YAxis fontSize={12} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar
                dataKey="checkIns"
                fill="#06b6d4"
                name="Check-ins"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// Registration Day Pattern
export function RegistrationDayChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <Card className="py-0">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <CalendarDays className="w-5 h-5 text-blue-500" />
            <h3 className="font-semibold">Registration by Day of Week</h3>
          </div>
          <div className="h-[250px] flex items-center justify-center text-muted-foreground">
            No data yet
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="py-0">
      <CardContent className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <CalendarDays className="w-5 h-5 text-blue-500" />
          <h3 className="font-semibold">Registration by Day of Week</h3>
        </div>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
              <XAxis dataKey="day" fontSize={12} />
              <YAxis fontSize={12} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="registrations" name="Registrations" radius={[4, 4, 0, 0]}>
                {data.map((_, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// Summary Stats Cards for Analytics
export function AnalyticsSummary({ stats, trendData }) {
  // Calculate growth metrics
  const totalDays = trendData?.length || 1;
  const avgPerDay =
    stats.totalRegistrations > 0
      ? (stats.totalRegistrations / totalDays).toFixed(1)
      : "0";

  // Peak day
  const peakDay = trendData?.reduce(
    (max, d) => (d.registrations > (max?.registrations || 0) ? d : max),
    null
  );

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <Card className="py-0">
        <CardContent className="p-4 text-center">
          <Users className="w-5 h-5 mx-auto mb-1 text-purple-500" />
          <p className="text-2xl font-bold">{avgPerDay}</p>
          <p className="text-xs text-muted-foreground">Avg/Day</p>
        </CardContent>
      </Card>
      <Card className="py-0">
        <CardContent className="p-4 text-center">
          <TrendingUp className="w-5 h-5 mx-auto mb-1 text-green-500" />
          <p className="text-2xl font-bold">{stats.checkInRate}%</p>
          <p className="text-xs text-muted-foreground">Check-in Rate</p>
        </CardContent>
      </Card>
      <Card className="py-0">
        <CardContent className="p-4 text-center">
          <CalendarDays className="w-5 h-5 mx-auto mb-1 text-cyan-500" />
          <p className="text-2xl font-bold">
            {peakDay
              ? new Date(peakDay.date + "T00:00:00").toLocaleDateString("en-IN", {
                  month: "short",
                  day: "numeric",
                })
              : "—"}
          </p>
          <p className="text-xs text-muted-foreground">Peak Day</p>
        </CardContent>
      </Card>
      <Card className="py-0">
        <CardContent className="p-4 text-center">
          <CreditCard className="w-5 h-5 mx-auto mb-1 text-amber-500" />
          <p className="text-2xl font-bold">
            {stats.totalRevenue > 0 ? `₹${stats.totalRevenue}` : "Free"}
          </p>
          <p className="text-xs text-muted-foreground">Total Revenue</p>
        </CardContent>
      </Card>
    </div>
  );
}
