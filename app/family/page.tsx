"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import {
  Users,
  Plus,
  CheckCircle2,
  Phone,
  RotateCw,
  CheckSquare,
  MessageCircle,
  ExternalLink,
  Sparkles,
  Zap,
  Clock,
  ArrowRight,
  AlertCircle,
  UserCheck,
} from "lucide-react";
import { MemberWorkload } from "@/lib/services/family-service";

interface FamilyTask {
  id: string;
  title: string;
  description?: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  dueDate?: string;
  category: string;
  status: string;
  sourceType?: string;
  estimatedCost?: number;
  aiReason?: string;
  assignedMember?: {
    id: string;
    name: string;
    phone?: string;
    role: string;
  };
}

export default function FamilyPage() {
  const [members, setMembers] = useState<MemberWorkload[]>([]);
  const [tasks, setTasks] = useState<FamilyTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  // Filters
  const [selectedMemberId, setSelectedMemberId] = useState<string>("ALL");
  const [selectedPriority, setSelectedPriority] = useState<string>("ALL");

  // Modals
  const [addMemberModalOpen, setAddMemberModalOpen] = useState(false);
  const [addTaskModalOpen, setAddTaskModalOpen] = useState(false);
  const [reassignModalTask, setReassignModalTask] = useState<FamilyTask | null>(null);

  // Add Member form fields
  const [name, setName] = useState("");
  const [role, setRole] = useState("Member");
  const [phone, setPhone] = useState("+91 ");
  const [responsibilities, setResponsibilities] = useState("");
  const [preferences, setPreferences] = useState("");

  // Add Task form fields
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskPriority, setTaskPriority] = useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("MEDIUM");
  const [taskCategory, setTaskCategory] = useState("General");
  const [taskAssignee, setTaskAssignee] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");

  const fetchData = async () => {
    try {
      setLoading(true);
      const [membersRes, tasksRes] = await Promise.all([
        fetch("/api/family/members"),
        fetch("/api/family/tasks"),
      ]);
      const membersData = await membersRes.json();
      const tasksData = await tasksRes.json();
      setMembers(membersData.members || []);
      setTasks(tasksData.tasks || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSyncAutonomous = async () => {
    try {
      setSyncing(true);
      const res = await fetch("/api/family/sync", { method: "POST" });
      const data = await res.json();
      setSyncNotice(`Synced autonomous tasks: ${data.createdTasksCount} new task(s) generated from bills, assets & inventory.`);
      setTimeout(() => setSyncNotice(null), 5000);
      fetchData();
    } catch (e) {
      console.error(e);
    } finally {
      setSyncing(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/family", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          role,
          phone,
          responsibilities,
          preferences,
        }),
      });

      if (res.ok) {
        setAddMemberModalOpen(false);
        setName("");
        setPhone("+91 ");
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/family/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: taskTitle,
          description: taskDesc,
          priority: taskPriority,
          category: taskCategory,
          assignedMemberId: taskAssignee || undefined,
          dueDate: taskDueDate || undefined,
        }),
      });

      if (res.ok) {
        setAddTaskModalOpen(false);
        setTaskTitle("");
        setTaskDesc("");
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleReassign = async (taskId: string, newMemberId: string) => {
    try {
      const res = await fetch("/api/family/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          action: "REASSIGN",
          newMemberId,
        }),
      });

      if (res.ok) {
        setReassignModalTask(null);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkComplete = async (taskId: string) => {
    try {
      const res = await fetch("/api/family/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          action: "COMPLETE",
        }),
      });

      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleWhatsAppPing = async (taskId: string) => {
    try {
      const res = await fetch("/api/family/tasks/ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId }),
      });
      const data = await res.json();
      if (data.whatsappUrl) {
        window.open(data.whatsappUrl, "_blank");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredTasks = tasks.filter((t) => {
    if (selectedMemberId !== "ALL" && t.assignedMember?.id !== selectedMemberId) return false;
    if (selectedPriority !== "ALL" && t.priority !== selectedPriority) return false;
    return true;
  });

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-teal-700 uppercase">
              <Users className="w-3.5 h-3.5" />
              <span>Family Coordination &bull; Execution Layer</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
              Family &amp; Household Delegation
            </h1>
            <p className="text-sm text-slate-500">
              Balanced workload distribution, automated event-to-task sync, and one-tap WhatsApp task reminders.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleSyncAutonomous}
              disabled={syncing}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-teal-50 border border-teal-200 text-teal-800 hover:bg-teal-100 text-xs font-semibold shadow-xs cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 text-teal-600" />
              <span>{syncing ? "Syncing..." : "Sync Household Events"}</span>
            </button>

            <button
              type="button"
              onClick={() => setAddTaskModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Assign Task</span>
            </button>

            <button
              type="button"
              onClick={() => setAddMemberModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs cursor-pointer"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Add Member</span>
            </button>
          </div>
        </div>

        {/* Sync Notification */}
        {syncNotice && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-medium flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{syncNotice}</span>
          </div>
        )}

        {/* Members Workload Overview Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {members.map((m) => {
            const isSelected = selectedMemberId === m.id;
            return (
              <div
                key={m.id}
                onClick={() => setSelectedMemberId(isSelected ? "ALL" : m.id)}
                className={`p-4 rounded-xl border transition-all cursor-pointer bg-white shadow-xs ${
                  isSelected
                    ? "border-teal-600 ring-2 ring-teal-500/20 shadow-md"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center">
                    {m.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </div>

                  <span className="text-[10px] font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-100">
                    {m.role}
                  </span>
                </div>

                <div className="mt-3">
                  <h3 className="text-sm font-bold text-slate-900">{m.name}</h3>
                  <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                    {m.responsibilities || "General household"}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-bold block">Active</span>
                    <span className="font-bold text-slate-900">{m.activeTaskCount} tasks</span>
                  </div>

                  {m.urgentTaskCount > 0 && (
                    <div className="text-right">
                      <span className="text-rose-600 text-[10px] uppercase font-bold block">Urgent</span>
                      <span className="font-bold text-rose-700">🚨 {m.urgentTaskCount}</span>
                    </div>
                  )}

                  <div className="text-right">
                    <span className="text-slate-400 text-[10px] uppercase font-bold block">Resolved</span>
                    <span className="font-semibold text-emerald-700">{m.completedTaskCount}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Task Management Section */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Section Header & Filters */}
          <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Coordinated Tasks ({filteredTasks.length})
              </h2>
              <p className="text-xs text-slate-500">
                Prioritized execution pipeline with direct WhatsApp ping triggers
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={selectedMemberId}
                onChange={(e) => setSelectedMemberId(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-700"
              >
                <option value="ALL">All Members</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>

              <select
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-700"
              >
                <option value="ALL">All Priorities</option>
                <option value="URGENT">🚨 Urgent</option>
                <option value="HIGH">⚠️ High</option>
                <option value="MEDIUM">📌 Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>
          </div>

          {/* Task List */}
          {loading ? (
            <div className="p-12 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
              <RotateCw className="w-4 h-4 animate-spin text-teal-600" />
              <span>Loading family coordination pipeline...</span>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-500">
              No active tasks found matching the selected filters.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredTasks.map((task) => {
                const priorityBadge =
                  task.priority === "URGENT"
                    ? "bg-rose-50 text-rose-700 border-rose-200"
                    : task.priority === "HIGH"
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : "bg-slate-100 text-slate-700 border-slate-200";

                return (
                  <div key={task.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Task Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${priorityBadge}`}>
                          {task.priority}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-500 uppercase">
                          {task.category}
                        </span>
                        {task.sourceType && (
                          <span className="text-[9px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                            via {task.sourceType}
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm font-bold text-slate-900 mt-1">{task.title}</h3>
                      {task.description && (
                        <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">{task.description}</p>
                      )}

                      {task.aiReason && (
                        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-teal-700">
                          <Sparkles className="w-3 h-3 text-teal-600" />
                          <span>{task.aiReason}</span>
                        </div>
                      )}
                    </div>

                    {/* Assignee & Action Buttons */}
                    <div className="flex items-center gap-2 shrink-0">
                      {task.assignedMember ? (
                        <div className="text-right mr-2">
                          <div className="text-xs font-bold text-slate-900">
                            {task.assignedMember.name}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {task.assignedMember.phone || task.assignedMember.role}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-amber-600 font-medium mr-2">Unassigned</span>
                      )}

                      {/* WhatsApp Ping Button */}
                      {task.assignedMember?.phone && (
                        <button
                          type="button"
                          onClick={() => handleWhatsAppPing(task.id)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100 text-xs font-bold cursor-pointer"
                          title="Send WhatsApp Ping Reminder"
                        >
                          <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Ping</span>
                        </button>
                      )}

                      {/* Reassign Button */}
                      <button
                        type="button"
                        onClick={() => setReassignModalTask(task)}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-medium cursor-pointer"
                      >
                        Reassign
                      </button>

                      {/* Complete Button */}
                      <button
                        type="button"
                        onClick={() => handleMarkComplete(task.id)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer shadow-xs"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Done</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal: Reassign Task */}
        {reassignModalTask && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-sm w-full p-6 animate-in zoom-in-95">
              <h2 className="text-base font-bold text-slate-900">Reassign Task</h2>
              <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                &ldquo;{reassignModalTask.title}&rdquo;
              </p>

              <div className="mt-4 space-y-2">
                <span className="text-xs font-medium text-slate-700 block">Select new member:</span>
                {members.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleReassign(reassignModalTask.id, m.id)}
                    className="w-full text-left p-2.5 rounded-lg border border-slate-200 hover:border-teal-500 hover:bg-teal-50/50 flex items-center justify-between text-xs transition-colors cursor-pointer"
                  >
                    <div>
                      <span className="font-bold text-slate-900 block">{m.name}</span>
                      <span className="text-[10px] text-slate-500">{m.role} &bull; {m.activeTaskCount} active tasks</span>
                    </div>
                    <UserCheck className="w-4 h-4 text-slate-400" />
                  </button>
                ))}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 text-right">
                <button
                  type="button"
                  onClick={() => setReassignModalTask(null)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Add Task */}
        {addTaskModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 animate-in zoom-in-95">
              <h2 className="text-base font-bold text-slate-900">Assign Family Task</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Create a task with automatic AI assignment based on member roles and current workload.
              </p>

              <form onSubmit={handleAddTask} className="mt-4 space-y-3 text-xs">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Task Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Verify morning dairy delivery, Check RO water TDS"
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Description / Notes</label>
                  <textarea
                    rows={2}
                    placeholder="Optional notes or details..."
                    value={taskDesc}
                    onChange={(e) => setTaskDesc(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Category</label>
                    <select
                      value={taskCategory}
                      onChange={(e) => setTaskCategory(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white"
                    >
                      <option value="General">General</option>
                      <option value="Kitchen">Kitchen / Pantry</option>
                      <option value="Groceries">Groceries &amp; Supplies</option>
                      <option value="Maintenance">Maintenance &amp; Repairs</option>
                      <option value="Bill Payment">Bill Payment</option>
                      <option value="Cleaning">Cleaning &amp; Housekeeping</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Priority</label>
                    <select
                      value={taskPriority}
                      onChange={(e) => setTaskPriority(e.target.value as any)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white"
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="URGENT">Urgent</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Assignee (Leave blank for AI Role Matching)
                  </label>
                  <select
                    value={taskAssignee}
                    onChange={(e) => setTaskAssignee(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white"
                  >
                    <option value="">✨ AI Auto-Assign (Recommended)</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.role} - {m.activeTaskCount} active)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setAddTaskModalOpen(false)}
                    className="px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold cursor-pointer shadow-xs"
                  >
                    Create &amp; Assign
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Add Member */}
        {addMemberModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 animate-in zoom-in-95">
              <h2 className="text-base font-bold text-slate-900">Add Household Member</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Register a family member or domestic staff to delegate tasks.
              </p>

              <form onSubmit={handleAddMember} className="mt-4 space-y-3 text-xs">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Priya Sharma, Sunita Devi"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Role</label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white"
                    >
                      <option value="Admin">Admin</option>
                      <option value="Member">Family Member</option>
                      <option value="Parent">Parent / Senior</option>
                      <option value="Helper">Domestic Staff / Cook</option>
                      <option value="Child">Child</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Phone</label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Responsibilities</label>
                  <input
                    type="text"
                    placeholder="e.g. Kitchen supplies, Plant watering"
                    value={responsibilities}
                    onChange={(e) => setResponsibilities(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Preferences &amp; Timings</label>
                  <input
                    type="text"
                    placeholder="e.g. Works 9am - 1pm"
                    value={preferences}
                    onChange={(e) => setPreferences(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                  />
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setAddMemberModalOpen(false)}
                    className="px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold cursor-pointer"
                  >
                    Add Member
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
