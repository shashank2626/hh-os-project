import { NextRequest, NextResponse } from "next/server";
import { runHouseholdAgent } from "@/lib/ai/agent";
import { prisma } from "@/lib/db/prisma";

export async function POST(req: NextRequest) {
  try {
    const { query, conversationId, history = [] } = await req.json();

    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    const household = await prisma.household.findFirst();
    if (!household) {
      return NextResponse.json({ error: "Household not found" }, { status: 404 });
    }

    // Upsert or retrieve conversation
    let convId = conversationId;
    if (!convId) {
      const conv = await prisma.aIConversation.create({
        data: {
          householdId: household.id,
          title: query.slice(0, 40) + "...",
        },
      });
      convId = conv.id;
    }

    // Save user message
    await prisma.aIMessage.create({
      data: {
        conversationId: convId,
        role: "user",
        content: query,
      },
    });

    // Run agent with tool calling and database interaction
    const response = await runHouseholdAgent(query, history);

    // Save assistant response
    await prisma.aIMessage.create({
      data: {
        conversationId: convId,
        role: "assistant",
        content: response.answer,
        toolCalls: JSON.stringify(response.steps),
      },
    });

    return NextResponse.json({
      conversationId: convId,
      answer: response.answer,
      steps: response.steps,
      suggestedActions: response.suggestedActions || [],
      cart: response.cart || null,
      replenishmentComparisons: response.replenishmentComparisons || null,
    });
  } catch (error) {
    console.error("AI Assistant error:", error);
    return NextResponse.json(
      { error: "Assistant could not process your request" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const conv = await prisma.aIConversation.findFirst({
      orderBy: { updatedAt: "desc" },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    return NextResponse.json({ conversation: conv });
  } catch (error) {
    console.error("Fetch assistant history error:", error);
    return NextResponse.json({ error: "Failed to fetch conversation" }, { status: 500 });
  }
}
