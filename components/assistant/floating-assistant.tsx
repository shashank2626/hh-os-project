"use client";

import { useState } from "react";
import { Bot, X, Send, Sparkles, Loader2, ArrowUpRight } from "lucide-react";
import Link from "next/link";

export function FloatingAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([
    {
      role: "assistant",
      content:
        "Hello Ayush! I'm your Indian Household OS assistant. How can I help you manage your home today?",
    },
  ]);
  const [loading, setLoading] = useState(false);

  const handleSend = async (textToSend?: string) => {
    const text = textToSend || query;
    if (!text.trim() || loading) return;

    const userMsg = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setQuery("");
    setLoading(true);

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: text }),
      });
      const data = await res.json();
      if (data.answer) {
        setMessages((prev) => [...prev, { role: "assistant", content: data.answer }]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "I encountered an error querying the household state." },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Network error connecting to assistant service." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 px-4 py-3 rounded-full bg-slate-900 text-white shadow-xl hover:bg-slate-800 hover:scale-105 transition-all border border-slate-700 cursor-pointer group"
        >
          <div className="w-6 h-6 rounded-full bg-teal-500/20 flex items-center justify-center text-teal-300">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <span className="text-sm font-semibold tracking-tight">Ask Household OS</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        </button>
      )}

      {/* Floating Dialog Drawer */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-96 max-w-[calc(100vw-3rem)] h-[520px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200">
          {/* Header */}
          <div className="p-3.5 bg-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center text-white">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold">Household Assistant</div>
                <div className="text-[10px] text-teal-300 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Live Connected
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Link
                href="/assistant"
                title="Open Full Assistant"
                className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <ArrowUpRight className="w-4 h-4" />
              </Link>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs bg-slate-50">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-xl p-3 leading-relaxed whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-teal-600 text-white rounded-br-none shadow-xs"
                      : "bg-white text-slate-800 border border-slate-200 rounded-bl-none shadow-xs"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-slate-500 text-xs py-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-600" />
                <span>Checking real household database...</span>
              </div>
            )}
          </div>

          {/* Quick Prompts */}
          <div className="px-3 py-2 bg-white border-t border-slate-100 flex gap-1.5 overflow-x-auto text-[11px]">
            <button
              type="button"
              onClick={() => handleSend("Refill inventory")}
              className="px-2 py-1 rounded bg-teal-50 hover:bg-teal-100 text-teal-800 font-medium border border-teal-200 whitespace-nowrap"
            >
              🛒 Refill Inventory
            </button>
            <button
              type="button"
              onClick={() => handleSend("What do I need to buy this week?")}
              className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 whitespace-nowrap"
            >
              📦 Low Stock
            </button>
            <button
              type="button"
              onClick={() => handleSend("Which appliances need maintenance?")}
              className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 whitespace-nowrap"
            >
              🔧 Maintenance
            </button>
            <button
              type="button"
              onClick={() => handleSend("What bills are due in the next 7 days?")}
              className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 whitespace-nowrap"
            >
              ⚡ Bills
            </button>
          </div>

          {/* Input Box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="p-3 bg-white border-t border-slate-200 flex items-center gap-2"
          >
            <input
              type="text"
              placeholder="Ask anything about your home..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-teal-500 focus:bg-white text-slate-900"
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="p-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
