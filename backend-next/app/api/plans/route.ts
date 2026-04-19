import { NextRequest } from "next/server";
import { apiResponse } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  // Simple static plans for now
  const plans = [
    {
      id: "free",
      name: "Starter",
      description: "For small hostels (up to 50 rooms)",
      price: 0,
      currency: "INR",
      features: ["Up to 50 rooms", "1 Hostel", "Basic reporting", "Email support"],
      is_popular: false
    },
    {
      id: "pro",
      name: "Professional",
      description: "For established businesses",
      price: 999,
      currency: "INR",
      features: ["Unlimited rooms", "Up to 5 hostels", "Advanced analytics", "Priority support"],
      is_popular: true
    }
  ];

  return apiResponse(plans);
}
