import { NextResponse } from "next/server";
import { getHouseholdMembersWithWorkload } from "@/lib/services/family-service";

export async function GET() {
  try {
    const data = await getHouseholdMembersWithWorkload();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Fetch household members error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch household members" }, { status: 500 });
  }
}
