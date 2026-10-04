import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function POST() {
  try {
    await execAsync("npx tsx prisma/seed.ts");
    return NextResponse.json({ success: true, message: "Database reseeded successfully" });
  } catch (error) {
    console.error("Reseed API error:", error);
    return NextResponse.json({ error: "Failed to reseed database" }, { status: 500 });
  }
}
