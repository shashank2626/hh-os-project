import { NextResponse } from "next/server";
import { syncAutonomousTasks } from "@/lib/services/family-service";

export async function POST() {
  try {
    const result = await syncAutonomousTasks();
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Family autonomous sync error:", error);
    return NextResponse.json({ error: error.message || "Failed to sync autonomous tasks" }, { status: 500 });
  }
}
