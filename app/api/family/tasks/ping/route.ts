import { NextRequest, NextResponse } from "next/server";
import { generateFamilyTaskPing } from "@/lib/services/family-service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { taskId } = body;

    if (!taskId) {
      return NextResponse.json({ error: "taskId is required" }, { status: 400 });
    }

    const ping = await generateFamilyTaskPing(taskId);
    return NextResponse.json(ping);
  } catch (error: any) {
    console.error("Family task ping error:", error);
    return NextResponse.json({ error: error.message || "Failed to generate family ping" }, { status: 500 });
  }
}
