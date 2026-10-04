"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import {
  CheckSquare,
  Plus,
  Clock,
  User,
  Sparkles,
  CheckCircle2,
  RotateCw,
  Trash2,
  Calendar,
} from "lucide-react";
import { formatIndianDate } from "@/lib/utils";

interface TaskItem {
  id: string;
  title: string;
  description?: string;
  priority: string;
  dueDate?: string;
  status: string;
  category: string;
  aiRecommendedMemberId?: string;
  aiReason?: string;
  assignedMember?: { id: string; name: string };
}

interface FamilyMember {
  id: string;
  name: string;
  role: string;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("PENDING");
  const [modalOpen, setModalOpen] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Form
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [category, setCategory] = useState("General");
  const [dueDate, setDueDate] = useState("");
  const [assignedMemberId, setAssignedMemberId] = useState("");

  const fetchData = async () => {
    try {
      setLoading(true);
      const [tasksRes, membersRes] = await Promise.all([
        fetch(`/api/tasks?status=${filter}`),
        fetch("/api/family"),
      ]);
      const tasksData = await tasksRes.json();
      const membersData = await membersRes.json();
      setTasks(tasksData.tasks || []);
      setMembers(membersData.members || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filter]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          priority,
          category,
          dueDate: dueDate || undefined,
          assignedMemberId: assignedMemberId || undefined,
        }),
      });

      if (res.ok) {
        setModalOpen(false);
        setTitle("");
        setDescription("");
        setSuccessNotice("Task created and prioritized!");
        fetchData();
        setTimeout(() => setSuccessNotice(null), 3000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleComplete = async (task: TaskItem) => {
    const newStatus = task.status === "COMPLETED" ? "PENDING" : "COMPLETED";
    try {
      await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: task.id, status: newStatus }),
      });
      setSuccessNotice(
        newStatus === "COMPLETED"
          ? `Completed "${task.title}"!`
          : `Reopened "${task.title}"`
      );
      fetchData();
      setTimeout(() => setSuccessNotice(null), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAssignMember = async (taskId: string, memberId: string) => {
    try {
      await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: taskId, assignedMemberId: memberId }),
      });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/tasks?id=${id}`, { method: "DELETE" });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-teal-700 uppercase">
              <CheckSquare className="w-3.5 h-3.5" />
              <span>Family Task Delegation</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
              Household Tasks &amp; Chores
            </h1>
            <p className="text-sm text-slate-500">
              AI-assisted chore assignment based on family member workload, availability, and preferences.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Task</span>
          </button>
        </div>

        {/* Success Notice */}
        {successNotice && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-medium flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{successNotice}</span>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex gap-2">
          {["PENDING", "COMPLETED", "ALL"].map((st) => (
            <button
              type="button"
              key={st}
              onClick={() => setFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                filter === st
                  ? "bg-slate-900 text-white"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {st === "PENDING" ? "Active Tasks" : st === "COMPLETED" ? "Resolved Tasks" : "All Tasks"}
            </button>
          ))}
        </div>

        {/* Tasks List */}
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
            <RotateCw className="w-4 h-4 animate-spin text-teal-600" />
            <span>Loading tasks...</span>
          </div>
        ) : tasks.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-xl border border-slate-200 text-slate-500 text-xs">
            No tasks found in this view.
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => {
              const isUrgent = task.priority === "URGENT";
              const isHigh = task.priority === "HIGH";

              return (
                <div
                  key={task.id}
                  className={`bg-white rounded-xl border p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
                    task.status === "COMPLETED" ? "opacity-60 bg-slate-50/50" : "hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => handleToggleComplete(task)}
                      className={`w-5 h-5 rounded-md border flex items-center justify-center mt-0.5 transition-colors cursor-pointer ${
                        task.status === "COMPLETED"
                          ? "bg-teal-600 border-teal-600 text-white"
                          : "border-slate-300 hover:border-teal-500 text-transparent"
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>

                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isUrgent
                              ? "bg-rose-100 text-rose-800"
                              : isHigh
                              ? "bg-amber-100 text-amber-800"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {task.priority}
                        </span>
                        <span className="text-[11px] font-medium text-slate-400">
                          {task.category}
                        </span>
                      </div>

                      <h3
                        className={`text-sm font-bold text-slate-900 mt-1 ${
                          task.status === "COMPLETED" ? "line-through text-slate-400" : ""
                        }`}
                      >
                        {task.title}
                      </h3>

                      {task.description && (
                        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                          {task.description}
                        </p>
                      )}

                      {/* AI Recommendation Reason */}
                      {task.aiReason && (
                        <div className="mt-2 text-[11px] text-teal-800 bg-teal-50 border border-teal-100 px-2 py-1 rounded-md inline-flex items-center gap-1.5">
                          <Sparkles className="w-3 h-3 text-teal-600 shrink-0" />
                          <span>AI Reason: {task.aiReason}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right side: Member assignment and due date */}
                  <div className="flex items-center gap-4 self-end md:self-center text-xs">
                    {task.dueDate && (
                      <div className="flex items-center gap-1 text-slate-500">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{formatIndianDate(task.dueDate)}</span>
                      </div>
                    )}

                    <select
                      value={task.assignedMember?.id || ""}
                      onChange={(e) => handleAssignMember(task.id, e.target.value)}
                      className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 font-medium"
                    >
                      <option value="">Unassigned</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.role})
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => handleDelete(task.id)}
                      className="text-slate-300 hover:text-rose-600 p-1 cursor-pointer transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal: Create Task */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 animate-in zoom-in-95">
              <h2 className="text-base font-bold text-slate-900">Create Household Task</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Delegate household maintenance, bill payments, or grocery chores.
              </p>

              <form onSubmit={handleCreateTask} className="mt-4 space-y-3 text-xs">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Task Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Schedule AC service, Order Atta from Blinkit"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Description &amp; Context
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Details about the task..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Priority</label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white"
                    >
                      <option value="LOW">LOW</option>
                      <option value="MEDIUM">MEDIUM</option>
                      <option value="HIGH">HIGH</option>
                      <option value="URGENT">URGENT</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Category</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white"
                    >
                      <option value="General">General Chore</option>
                      <option value="Maintenance">Maintenance</option>
                      <option value="Procurement">Procurement</option>
                      <option value="Bill Payment">Bill Payment</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Due Date</label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">
                      Assign Member
                    </label>
                    <select
                      value={assignedMemberId}
                      onChange={(e) => setAssignedMemberId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white"
                    >
                      <option value="">AI Auto-Recommend</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.role})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold cursor-pointer"
                  >
                    Create Task
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
