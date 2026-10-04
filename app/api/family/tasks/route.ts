import { NextRequest, NextResponse } from "next/server";
import {
  getFamilyTasks,
  createFamilyTask,
  reassignFamilyTask,
  updateFamilyTaskStatus,
} from "@/lib/services/family-service";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const memberId = searchParams.get("memberId") || undefined;
    const priority = searchParams.get("priority") || undefined;
    const status = searchParams.get("status") || undefined;
    const category = searchParams.get("category") || undefined;

    const tasks = await getFamilyTasks(undefined, {
      memberId,
      priority,
      status,
      category,
    });

    return NextResponse.json({ tasks });
  } catch (error: any) {
    console.error("Fetch family tasks error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch family tasks" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const task = await createFamilyTask(body);
    return NextResponse.json({ task }, { status: 201 });
  } catch (error: any) {
    console.error("Create family task error:", error);
    return NextResponse.json({ error: error.message || "Failed to create family task" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { taskId, action, newMemberId, status } = body;

    if (!taskId) {
      return NextResponse.json({ error: "taskId is required" }, { status: 400 });
    }

    if (action === "REASSIGN") {
      if (!newMemberId) {
        return NextResponse.json({ error: "newMemberId is required for reassignment" }, { status: 400 });
      }
      const updated = await reassignFamilyTask(taskId, newMemberId);
      return NextResponse.json({ task: updated });
    }

    if (action === "UPDATE_STATUS" || status) {
      const targetStatus = status || (action === "COMPLETE" ? "COMPLETED" : "IN_PROGRESS");
      const updated = await updateFamilyTaskStatus(taskId, targetStatus);
      return NextResponse.json({ task: updated });
    }

    return NextResponse.json({ error: "Invalid action or parameters" }, { status: 400 });
  } catch (error: any) {
    console.error("Update family task error:", error);
    return NextResponse.json({ error: error.message || "Failed to update family task" }, { status: 500 });
  }
}
