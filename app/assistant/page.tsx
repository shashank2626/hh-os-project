"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import {
  Bot,
  Send,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Wrench,
  Receipt,
  ShoppingCart,
  Calendar,
  Loader2,
  ChevronRight,
  Database,
  ArrowRight,
  RotateCw,
  MapPin,
} from "lucide-react";
import { RefillCartCard, CartData } from "@/components/assistant/refill-cart-card";
import { AddressModal, AddressItem } from "@/components/assistant/address-modal";

interface ToolStep {
  tool: string;
  status: "executing" | "completed" | "failed";
  label: string;
}

interface ActionProposal {
  id: string;
  label: string;
  actionType: string;
  payload: Record<string, unknown>;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  steps?: ToolStep[];
  suggestedActions?: ActionProposal[];
  cart?: CartData | null;
  replenishmentComparisons?: Array<{
    itemName: string;
    requiredQuantity: string;
    options: string[];
    bestOption: string;
    reasoning: string;
  }> | null;
  createdAt: string;
}

const SAMPLE_QUESTIONS = [
  "Refill inventory",
  "Refill inventory and also add deodorant under ₹500",
  "Add toothpaste, preferably Sensodyne",
  "Buy something for cleaning the bathroom",
  "Add two bottles of milk and a pack of biscuits",
  "What do I need to buy this week?",
  "Which appliances need maintenance?",
  "What bills are due in the next 7 days?",
  "Why did my electricity bill increase?",
  "What groceries will run out soon?",
];

function AssistantPageContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const swiggyConnected = searchParams.get("swiggy_connected");
  const swiggyError = searchParams.get("swiggy_error");

  const [input, setInput] = useState("");
  const [swiggyStatus, setSwiggyStatus] = useState<{
    connected: boolean;
    provider?: string;
    selectedAddressName?: string;
  } | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "msg-1",
      role: "assistant",
      content:
        "Namaste Ayush! I am your AI Household Operating Assistant. I continuously monitor your pantry inventory, appliance maintenance schedules, family chores, Indian utility bills, and live Swiggy Instamart replenishment.\n\nAsk me anything about your household or select one of the suggested prompts below.",
      createdAt: new Date().toISOString(),
    },
  ]);
  const [activeSteps, setActiveSteps] = useState<ToolStep[]>([]);
  const [loading, setLoading] = useState(false);
  const [executingActionId, setExecutingActionId] = useState<string | null>(null);
  const [actionSuccessNotice, setActionSuccessNotice] = useState<string | null>(null);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check Swiggy connection status
    fetch("/api/auth/swiggy/status")
      .then((res) => res.json())
      .then((data) => setSwiggyStatus(data))
      .catch((err) => console.error("Error checking Swiggy status:", err));

    if (swiggyConnected === "true") {
      setActionSuccessNotice(
        "✓ Swiggy Instamart connected successfully! Live product discovery and cart syncing are now active."
      );
    } else if (swiggyError) {
      setActionSuccessNotice(`Notice from Swiggy OAuth: ${swiggyError}`);
    }
  }, [swiggyConnected, swiggyError]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeSteps]);

  useEffect(() => {
    if (initialQuery) {
      handleSend(initialQuery);
    }
  }, [initialQuery]);

  const handleSend = async (queryText?: string) => {
    const text = queryText || input;
    if (!text.trim() || loading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    // Initial tool execution state for user feedback
    setActiveSteps([
      {
        tool: "orchestrator",
        status: "executing",
        label: "Analyzing query & determining database tools...",
      },
    ]);

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: text }),
      });
      const data = await res.json();

      setActiveSteps(data.steps || []);

      const assistantMessage: Message = {
        id: `asst-${Date.now()}`,
        role: "assistant",
        content: data.answer || "I could not retrieve an answer from the database.",
        steps: data.steps,
        suggestedActions: data.suggestedActions,
        cart: data.cart,
        replenishmentComparisons: data.replenishmentComparisons,
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: "Failed to connect to the household intelligence engine.",
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => setActiveSteps([]), 2000);
    }
  };

  const handleExecuteAction = async (action: ActionProposal) => {
    if (action.actionType === "CONTINUE_TO_MERCHANT" && action.payload?.url) {
      window.open(action.payload.url as string, "_blank", "noopener,noreferrer");
      return;
    }

    if (action.actionType === "CONNECT_SWIGGY") {
      window.location.href = (action.payload?.url as string) || "/api/auth/swiggy/connect";
      return;
    }

    if (action.actionType === "ADD_ADDRESS") {
      setIsAddressModalOpen(true);
      return;
    }

    setExecutingActionId(action.id);
    try {
      const res = await fetch("/api/actions/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionType: action.actionType,
          payload: action.payload,
        }),
      });

      const resData = await res.json();
      if (res.ok) {
        setActionSuccessNotice(
          resData.message || `Action executed: ${action.label}`
        );
        // Add confirmation message in chat
        setMessages((prev) => [
          ...prev,
          {
            id: `sys-${Date.now()}`,
            role: "assistant",
            content: `✓ **Action Executed:** ${action.label}\n${resData.message || "Database state updated successfully."}`,
            createdAt: new Date().toISOString(),
          },
        ]);
        setTimeout(() => setActionSuccessNotice(null), 4000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setExecutingActionId(null);
    }
  };

  return (
    <AppShell>
      <div className="flex flex-col h-[calc(100vh-8rem)] bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Assistant Header */}
        <div className="p-4 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-600 flex items-center justify-center text-white shadow-md shadow-teal-950">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-sm flex items-center gap-2">
                Household OS AI Agent
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 font-medium border border-teal-500/30">
                  Gemini Function Calling
                </span>
              </div>
              <div className="text-xs text-slate-400">
                Connected directly to Prisma database tools &amp; live household state
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {swiggyStatus?.connected ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs text-orange-300 bg-orange-950/70 border border-orange-500/40 px-2.5 py-1 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
                  <span>Swiggy MCP: Connected</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddressModalOpen(true)}
                  className="flex items-center gap-1 text-xs text-orange-200 bg-orange-950/60 hover:bg-orange-900 border border-orange-500/40 px-2.5 py-1 rounded-full transition-colors cursor-pointer"
                  title="View or change delivery address"
                >
                  <MapPin className="w-3 h-3 text-orange-400" />
                  <span className="truncate max-w-[120px]">
                    {swiggyStatus.selectedAddressName ? swiggyStatus.selectedAddressName.split(",")[0] : "Address"}
                  </span>
                </button>
              </div>
            ) : (
              <a
                href="/api/auth/swiggy/connect"
                className="flex items-center gap-1.5 text-xs text-amber-200 bg-amber-950/60 hover:bg-amber-900 border border-amber-600/40 px-2.5 py-1 rounded-full transition-colors cursor-pointer"
                title="Connect real Swiggy Instamart account via OAuth 2.1"
              >
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span>Connect Swiggy</span>
              </a>
            )}

            <div className="flex items-center gap-2 text-xs text-emerald-400 bg-slate-800/80 px-2.5 py-1 rounded-full border border-slate-700">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>DB Tools Active</span>
            </div>
          </div>
        </div>

        {/* Global Action Success Notice */}
        {actionSuccessNotice && (
          <div className="p-3 bg-emerald-50 border-b border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{actionSuccessNotice}</span>
          </div>
        )}

        {/* Chat History Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {m.role === "assistant" && (
                <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center text-white shrink-0 mt-1 shadow-xs">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-2xl rounded-2xl p-4 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-slate-900 text-white rounded-br-xs shadow-xs"
                    : "bg-white text-slate-800 border border-slate-200/80 rounded-bl-xs shadow-xs"
                }`}
              >
                {/* Tool execution steps display */}
                {m.steps && m.steps.length > 0 && (
                  <div className="mb-3 pb-3 border-b border-slate-100 space-y-1.5">
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Database className="w-3 h-3 text-teal-600" />
                      <span>Tools Executed Against Database:</span>
                    </div>
                    {m.steps.map((st, i) => (
                      <div
                        key={i}
                        className="text-xs text-slate-600 flex items-center gap-2 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-100"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="font-medium text-slate-700">{st.label}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Message text */}
                <div className="whitespace-pre-wrap">{m.content}</div>

                {/* Refill Cart Display */}
                {m.cart && m.cart.items && m.cart.items.length > 0 && (
                  <RefillCartCard
                    initialCart={m.cart}
                    comparisons={m.replenishmentComparisons}
                  />
                )}

                {/* Suggested Action Confirmation Proposals */}
                {m.suggestedActions && m.suggestedActions.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                    <div className="text-[11px] font-semibold text-teal-700 uppercase tracking-wider flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      <span>Proposed Actions (User Confirmation Required):</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {m.suggestedActions.map((act) => (
                        <button
                          type="button"
                          key={act.id}
                          onClick={() => handleExecuteAction(act)}
                          disabled={executingActionId === act.id}
                          className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          {executingActionId === act.id ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              <span>Executing Tool...</span>
                            </>
                          ) : (
                            <>
                              <span>{act.label}</span>
                              <ChevronRight className="w-3 h-3" />
                            </>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Active Tool Execution Indicator */}
          {loading && (
            <div className="flex gap-3 justify-start animate-in fade-in">
              <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center text-white shrink-0 mt-1">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-xs p-4 max-w-md shadow-xs space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-teal-700">
                  <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
                  <span>Agent Reasoning &amp; Executing Tools...</span>
                </div>
                {activeSteps.map((st, i) => (
                  <div key={i} className="text-xs text-slate-500 pl-6 animate-pulse">
                    • {st.label}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Prompts Carousel */}
        <div className="px-6 py-2 bg-slate-50 border-t border-slate-200 flex items-center gap-2 overflow-x-auto text-xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider shrink-0">
            Suggested Prompts:
          </span>
          {SAMPLE_QUESTIONS.map((q, i) => (
            <button
              type="button"
              key={i}
              onClick={() => handleSend(q)}
              className="px-3 py-1 rounded-full bg-white border border-slate-200 hover:border-teal-400 hover:bg-teal-50/50 text-slate-700 whitespace-nowrap transition-colors cursor-pointer text-xs"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Chat Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="p-4 bg-white border-t border-slate-200 flex items-center gap-3"
        >
          <input
            type="text"
            placeholder="Ask anything about groceries, upcoming bills, appliance service, or family tasks..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:border-teal-500 focus:bg-white text-slate-900 transition-colors"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-5 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm shadow-xs disabled:opacity-50 transition-colors flex items-center gap-2 cursor-pointer"
          >
            <span>Ask</span>
            <Send className="w-4 h-4" />
          </button>
        </form>

        {/* Address Selection & Management Modal */}
        <AddressModal
          isOpen={isAddressModalOpen}
          onClose={() => setIsAddressModalOpen(false)}
          onAddressSelected={(addr: AddressItem) => {
            setSwiggyStatus((prev) => (prev ? { ...prev, selectedAddressName: addr.formattedAddress } : null));
            setActionSuccessNotice(`Delivery address set to: ${addr.formattedAddress}`);
            setTimeout(() => setActionSuccessNotice(null), 4000);
          }}
        />
      </div>
    </AppShell>
  );
}

export default function AssistantPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <div className="p-12 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
            <RotateCw className="w-4 h-4 animate-spin text-teal-600" />
            <span>Loading AI Household Assistant...</span>
          </div>
        </AppShell>
      }
    >
      <AssistantPageContent />
    </Suspense>
  );
}
