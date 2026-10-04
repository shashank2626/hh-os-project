import { NextRequest, NextResponse } from "next/server";
import { getVendorById, updateVendor, deleteVendor } from "@/lib/services/vendor-service";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const vendor = await getVendorById(id);
    if (!vendor) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }
    return NextResponse.json({ vendor });
  } catch (error: any) {
    console.error("Get vendor error:", error);
    return NextResponse.json({ error: error.message || "Failed to get vendor" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const updated = await updateVendor(id, body);
    return NextResponse.json({ vendor: updated });
  } catch (error: any) {
    console.error("Update vendor error:", error);
    return NextResponse.json({ error: error.message || "Failed to update vendor" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await deleteVendor(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Delete vendor error:", error);
    return NextResponse.json({ error: error.message || "Failed to delete vendor" }, { status: 500 });
  }
}
