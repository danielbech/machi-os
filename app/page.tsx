"use client";

import { useState, KeyboardEvent, useEffect, useRef } from "react";
import {
  initiateGoogleAuth,
  isGoogleCalendarConnected,
  storeAccessToken,
  clearAccessToken,
  getEventsGroupedByDay,
  type CalendarEvent,
} from "@/lib/google-calendar";
import { createClient } from "@/lib/supabase/client";
import { initializeUserData } from "@/lib/supabase/initialize";
import { loadTasksByDay, saveTask, deleteTask, updateDayTasks } from "@/lib/supabase/tasks-simple";
import { AuthForm } from "@/components/auth-form";
import type { User } from "@supabase/supabase-js";
import {
  Kanban,
  KanbanBoard,
  KanbanColumn,
  KanbanItem,
  KanbanItemHandle,
  KanbanOverlay,
} from "@/components/ui/kanban";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Check, GripVertical, Plus, X, Settings, Calendar } from "lucide-react";

interface Member {
  id: string;
  name: string;
  initials: string;
  color: string;
}

interface Client {
  id: string;
  name: string;
  key: string;
  className: string;
}

interface Task {
  id: string;
  title: string;
  description?: string;
  priority?: "low" | "medium" | "high";
  completed?: boolean;
  assignees?: string[]; // array of member ids
  client?: string; // client id
  day?: string; // monday, tuesday, etc.
}

const TEAM_MEMBERS: Member[] = [
  { id: "1", name: "Daniel", initials: "DB", color: "bg-blue-500" },
  { id: "2", name: "Casper", initials: "C", color: "bg-green-500" },
  { id: "3", name: "Jens", initials: "J", color: "bg-purple-500" },
  { id: "4", name: "Emil", initials: "E", color: "bg-orange-500" },
];

const CLIENTS: Client[] = [
  { id: "acme", name: "Acme", key: "a", className: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
  { id: "techstart", name: "TechStart", key: "t", className: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300" },
  { id: "designco", name: "DesignCo", key: "d", className: "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300" },
  { id: "innovate", name: "Innovate", key: "i", className: "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300" },
];

const initialData: Record<string, Task[]> = {
  monday: [
    { 
      id: "1", 
      title: "Team standup",
      description: "9:00 AM - Weekly planning",
      priority: "high"
    },
    { 
      id: "2", 
      title: "Design review",
      description: "Review board interface mockups",
      priority: "medium"
    },
  ],
  tuesday: [
    { 
      id: "3", 
      title: "Database setup",
      description: "Configure Supabase tables and RLS",
      priority: "high"
    },
    { 
      id: "4", 
      title: "Client meeting",
      description: "2:00 PM - Project kickoff",
      priority: "high"
    },
  ],
  wednesday: [
    { 
      id: "5", 
      title: "Build Kanban component",
      description: "Implement drag and drop",
      priority: "high"
    },
  ],
  thursday: [
    { 
      id: "6", 
      title: "Author management",
      description: "User/group assignment system",
      priority: "medium"
    },
    { 
      id: "7", 
      title: "Code review",
      description: "Review pull requests",
      priority: "low"
    },
  ],
  friday: [
    { 
      id: "8", 
      title: "Weekly demo",
      description: "Show progress to stakeholders",
      priority: "high"
    },
  ],
};

const columnTitles: Record<string, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
};

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [columns, setColumns] = useState<Record<string, Task[]>>({
    monday: [], tuesday: [], wednesday: [], thursday: [], friday: []
  });
  const [addingToColumn, setAddingToColumn] = useState<string | null>(null);
  const [addingAtIndex, setAddingAtIndex] = useState<number | null>(null);
  const [newCardTitle, setNewCardTitle] = useState("");
  const [newlyCreatedCardId, setNewlyCreatedCardId] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editingColumn, setEditingColumn] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [googleCalendarConnected, setGoogleCalendarConnected] = useState(false);
  const [calendarEvents, setCalendarEvents] = useState<Record<string, CalendarEvent[]>>({});

  // Auth check
  useEffect(() => {
    const supabase = createClient();
    let mounted = true;
    
    // Timeout safety net
    const timeout = setTimeout(() => {
      if (mounted) {
        console.warn('Auth check timeout - forcing end of loading state');
        setLoading(false);
      }
    }, 5000);
    
    // Check current user
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!mounted) return;
      clearTimeout(timeout);
      
      setUser(user);
      if (user) {
        try {
          await initializeUserData(user.id);
          // Load tasks from Supabase
          const tasks = await loadTasksByDay(user.id);
          if (mounted) {
            setColumns(tasks);
          }
        } catch (error) {
          console.error('Error loading user data:', error);
        }
      }
      if (mounted) {
        setLoading(false);
      }
    }).catch((error) => {
      console.error('Error checking auth:', error);
      clearTimeout(timeout);
      if (mounted) {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          await initializeUserData(session.user.id);
          const tasks = await loadTasksByDay(session.user.id);
          setColumns(tasks);
        } else {
          setColumns({
            monday: [], tuesday: [], wednesday: [], thursday: [], friday: []
          });
        }
      }
    );

    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  // Check if Google Calendar is connected on mount
  useEffect(() => {
    setGoogleCalendarConnected(isGoogleCalendarConnected());
  }, []);

  // Handle OAuth callback messages
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      
      if (event.data.type === 'GOOGLE_AUTH_SUCCESS') {
        storeAccessToken(event.data.accessToken, event.data.expiresIn);
        setGoogleCalendarConnected(true);
        syncCalendarEvents();
      } else if (event.data.type === 'GOOGLE_AUTH_FAILED') {
        alert('Failed to connect Google Calendar');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Sync calendar events
  const syncCalendarEvents = async () => {
    if (!isGoogleCalendarConnected()) return;

    try {
      // Get Monday of current week
      const today = new Date();
      const currentDay = today.getDay();
      const monday = new Date(today);
      const offset = currentDay === 0 ? -6 : 1 - currentDay;
      monday.setDate(today.getDate() + offset);
      monday.setHours(0, 0, 0, 0);

      // Get Friday of current week
      const friday = new Date(monday);
      friday.setDate(monday.getDate() + 4);
      friday.setHours(23, 59, 59, 999);

      const events = await getEventsGroupedByDay(monday, friday);
      setCalendarEvents(events);
    } catch (error) {
      console.error('Failed to sync calendar events:', error);
      if (error instanceof Error && error.message === 'Authentication expired') {
        setGoogleCalendarConnected(false);
        setCalendarEvents({});
      }
    }
  };

  // Initial sync when connected
  useEffect(() => {
    if (googleCalendarConnected) {
      syncCalendarEvents();
    }
  }, [googleCalendarConnected]);

  // Auto-sync every 30 minutes
  useEffect(() => {
    if (!googleCalendarConnected) return;

    const interval = setInterval(() => {
      syncCalendarEvents();
    }, 30 * 60 * 1000); // 30 minutes

    return () => clearInterval(interval);
  }, [googleCalendarConnected]);

  // Get current week's dates (Monday - Friday)
  const getWeekDates = () => {
    const today = new Date();
    const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const monday = new Date(today);
    
    // Calculate offset to get to Monday (if today is Sunday, go back 6 days)
    const offset = currentDay === 0 ? -6 : 1 - currentDay;
    monday.setDate(today.getDate() + offset);

    const weekDates: Record<string, string> = {};
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    
    days.forEach((day, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);
      weekDates[day] = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    return weekDates;
  };

  const weekDates = getWeekDates();

  // Get current day name
  const getTodayName = () => {
    const today = new Date();
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[today.getDay()];
  };

  // Force Friday for testing (TODO: remove)
  const todayName = 'friday'; // getTodayName();

  const handleAddCard = async (columnId: string, index?: number) => {
    if (!newCardTitle.trim() || !user) return;

    const newCard: Task = {
      id: `task-${Date.now()}`,
      title: newCardTitle.trim(),
      priority: "medium",
      day: columnId,
    };

    const columnItems = [...columns[columnId]];
    if (index !== undefined && index !== null) {
      columnItems.splice(index, 0, newCard);
    } else {
      columnItems.push(newCard);
    }

    setColumns({
      ...columns,
      [columnId]: columnItems,
    });

    // Save to Supabase
    await saveTask(user.id, newCard);

    setNewCardTitle("");
    setAddingToColumn(null);
    setAddingAtIndex(null);
    setNewlyCreatedCardId(newCard.id);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, columnId: string, index?: number) => {
    if (e.key === "Enter") {
      handleAddCard(columnId, index);
    } else if (e.key === "Escape") {
      setAddingToColumn(null);
      setAddingAtIndex(null);
      setNewCardTitle("");
    }
  };

  const toggleComplete = async (taskId: string) => {
    if (!user) return;

    const updated = { ...columns };
    let updatedTask: Task | null = null;

    for (const col of Object.keys(updated)) {
      const idx = updated[col].findIndex((t) => t.id === taskId);
      if (idx !== -1) {
        updated[col] = [...updated[col]];
        updated[col][idx] = { ...updated[col][idx], completed: !updated[col][idx].completed, day: col };
        updatedTask = updated[col][idx];
        break;
      }
    }
    
    setColumns(updated);
    
    // Save to Supabase
    if (updatedTask) {
      await saveTask(user.id, updatedTask);
    }
  };

  const toggleAssignee = async (taskId: string, memberId: string) => {
    if (!user) return;

    const updated = { ...columns };
    let updatedTask: Task | null = null;

    for (const col of Object.keys(updated)) {
      const idx = updated[col].findIndex((t) => t.id === taskId);
      if (idx !== -1) {
        updated[col] = [...updated[col]];
        const task = updated[col][idx];
        const assignees = task.assignees || [];
        const isAssigned = assignees.includes(memberId);
        
        updated[col][idx] = {
          ...task,
          assignees: isAssigned
            ? assignees.filter(id => id !== memberId)
            : [...assignees, memberId],
          day: col
        };
        updatedTask = updated[col][idx];
        break;
      }
    }
    
    setColumns(updated);

    // Save to Supabase
    if (updatedTask) {
      await saveTask(user.id, updatedTask);
    }
  };

  const toggleClient = async (taskId: string, clientId: string) => {
    if (!user) return;

    const updated = { ...columns };
    let updatedTask: Task | null = null;

    for (const col of Object.keys(updated)) {
      const idx = updated[col].findIndex((t) => t.id === taskId);
      if (idx !== -1) {
        updated[col] = [...updated[col]];
        const task = updated[col][idx];
        
        updated[col][idx] = {
          ...task,
          client: task.client === clientId ? undefined : clientId,
          day: col
        };
        updatedTask = updated[col][idx];
        break;
      }
    }
    
    setColumns(updated);

    // Save to Supabase
    if (updatedTask) {
      await saveTask(user.id, updatedTask);
    }
  };

  const saveEditedTask = async (updatedTask: Task) => {
    if (!editingColumn || !user) return;
    
    const updated = { ...columns };
    const idx = updated[editingColumn].findIndex((t) => t.id === updatedTask.id);
    if (idx !== -1) {
      updated[editingColumn] = [...updated[editingColumn]];
      updated[editingColumn][idx] = { ...updatedTask, day: editingColumn };
      setColumns(updated);
      
      // Save to Supabase
      await saveTask(user.id, { ...updatedTask, day: editingColumn });
    }
    
    setEditingTask(null);
    setEditingColumn(null);
  };

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black/50">
        <div className="text-white/60">Loading...</div>
      </div>
    );
  }

  // Show auth form if not logged in
  if (!user) {
    return <AuthForm />;
  }

  return (
    <main className="flex min-h-screen flex-col p-4 md:p-8 bg-black/50">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/logo.svg" alt="Machi OS" className="w-10 h-10" />
          <h1 className="text-3xl font-bold">Machi OS</h1>
        </div>
        <button
          onClick={() => setShowSettings(true)}
          className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-colors"
        >
          <Settings className="size-5" />
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        <Kanban
          value={columns}
          onValueChange={async (newColumns) => {
            setColumns(newColumns);
            
            // Save reordered tasks to Supabase
            if (user) {
              // Update all changed columns
              for (const [day, tasks] of Object.entries(newColumns)) {
                await updateDayTasks(user.id, day, tasks);
              }
            }
          }}
          getItemValue={(item) => item.id}
        >
          <KanbanBoard className="h-[calc(100vh-12rem)] overflow-x-auto p-1 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:hover:bg-white/20">
            {Object.entries(columns).map(([columnId, items]) => (
              <KanbanColumn
                key={columnId}
                value={columnId}
                className={`w-[280px] shrink-0 ${columnId === todayName ? 'ring-2 ring-white/20 rounded-lg' : ''}`}
              >
                <div className="mb-3 px-1">
                  <div className="flex items-baseline gap-2">
                    <h2 className={`font-semibold ${columnId === todayName ? 'text-white' : ''}`}>
                      {columnTitles[columnId] || columnId}
                    </h2>
                    <span className="text-xs text-white/40">
                      {weekDates[columnId]}
                    </span>
                    {columnId === todayName && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400">
                        Today
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-1 overflow-y-auto">
                  {/* Calendar Events */}
                  {calendarEvents[columnId]?.map((event) => (
                    <div
                      key={event.id}
                      className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-2 cursor-default"
                    >
                      <div className="flex items-start gap-2">
                        <Calendar className="size-3.5 text-blue-400 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-blue-100">
                            {event.summary}
                          </div>
                          <div className="text-xs text-blue-300/60 mt-0.5">
                            {new Date(event.start).toLocaleTimeString('en-US', {
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12: true
                            })}
                            {event.location && ` • ${event.location}`}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Divider between calendar events and tasks */}
                  {calendarEvents[columnId]?.length > 0 && (
                    <div className="my-1 border-t border-dotted border-white/10" />
                  )}

                  {items.map((item, index) => (
                    <div key={item.id}>
                      {/* Inline add card divider between items */}
                      {addingToColumn === columnId && addingAtIndex === index ? (
                        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 mb-1">
                          <input
                            type="text"
                            value={newCardTitle}
                            onChange={(e) => setNewCardTitle(e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, columnId, index)}
                            onBlur={() => {
                              if (newCardTitle.trim()) {
                                handleAddCard(columnId, index);
                              } else {
                                setAddingToColumn(null);
                                setAddingAtIndex(null);
                              }
                            }}
                            placeholder="Task title..."
                            autoFocus
                            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/40"
                          />
                          <div className="mt-2 flex gap-2 text-xs text-muted-foreground/60">
                            <span>↵ Save</span>
                            <span>⎋ Cancel</span>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setAddingToColumn(columnId);
                            setAddingAtIndex(index);
                            setNewCardTitle("");
                          }}
                          className="group/add flex h-1 w-full items-center justify-center rounded transition-all hover:h-8 hover:bg-white/[0.02]"
                        >
                          <div className="w-full h-px bg-transparent group-hover/add:bg-white/20 transition-colors" />
                        </button>
                      )}

                      <KanbanItem
                      value={item.id}
                      className="group rounded-lg border border-white/5 bg-white/[0.02] p-2 text-card-foreground shadow-[0_1px_3px_rgba(0,0,0,0.3)] hover:bg-white/[0.04] hover:border-white/10 hover:shadow-[0_2px_6px_rgba(0,0,0,0.4)] transition-all duration-200 focus:outline-none cursor-pointer"
                      tabIndex={0}
                      onClick={(e: any) => {
                        // Only open dialog if clicking on the card itself, not drag handle or checkbox
                        if (e.target === e.currentTarget || e.target.closest('[data-card-content]')) {
                          setEditingTask(item);
                          setEditingColumn(columnId);
                        }
                      }}
                      ref={(el: HTMLDivElement | null) => {
                        if (el && item.id === newlyCreatedCardId) {
                          setTimeout(() => {
                            el.focus();
                            setNewlyCreatedCardId(null);
                          }, 100);
                        }
                      }}
                      onMouseEnter={(e: any) => e.currentTarget.focus()}
                      onKeyDown={(e: any) => {
                        const key = e.key;
                        if (key === ' ') {
                          e.preventDefault();
                          toggleComplete(item.id);
                        } else if (key >= '1' && key <= '9') {
                          const memberIndex = parseInt(key) - 1;
                          if (memberIndex < TEAM_MEMBERS.length) {
                            e.preventDefault();
                            toggleAssignee(item.id, TEAM_MEMBERS[memberIndex].id);
                          }
                        } else {
                          const client = CLIENTS.find(c => c.key === key.toLowerCase());
                          if (client) {
                            e.preventDefault();
                            toggleClient(item.id, client.id);
                          }
                        }
                      }}
                    >
                      <div className="relative flex gap-2">
                        <KanbanItemHandle className="shrink-0 opacity-50 hover:opacity-100 transition-opacity">
                          <GripVertical className="size-3.5 text-muted-foreground" />
                        </KanbanItemHandle>

                        <div data-card-content className={`flex-1 transition-opacity ${item.completed ? "opacity-50" : ""}`}>
                          <div className={`text-sm pr-6 ${item.completed ? "line-through" : ""}`}>{item.title}</div>
                          {(item.client || (item.assignees && item.assignees.length > 0)) && (
                            <div className="flex gap-1.5 mt-1.5 items-center flex-wrap">
                              {item.client && (() => {
                                const client = CLIENTS.find(c => c.id === item.client);
                                return client ? (
                                  <Badge key={client.id} className={client.className}>
                                    {client.name}
                                  </Badge>
                                ) : null;
                              })()}
                              {item.assignees && item.assignees.length > 0 && (
                                <>
                                  {item.assignees.map(assigneeId => {
                                    const member = TEAM_MEMBERS.find(m => m.id === assigneeId);
                                    return member ? (
                                      <div
                                        key={member.id}
                                        className={`flex items-center justify-center w-5 h-5 rounded-full ${member.color} text-[10px] font-semibold text-white`}
                                        title={member.name}
                                      >
                                        {member.initials}
                                      </div>
                                    ) : null;
                                  })}
                                </>
                              )}
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleComplete(item.id);
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                          className="absolute top-0.5 right-0 shrink-0"
                        >
                          <div
                            className={`flex size-4 items-center justify-center rounded-full border transition-all ${
                              item.completed
                                ? "border-green-500/80 bg-green-500/80"
                                : "border-white/20 hover:border-white/40"
                            }`}
                          >
                            {item.completed && (
                              <Check className="size-3 text-white" strokeWidth={3} />
                            )}
                          </div>
                        </button>
                      </div>
                    </KanbanItem>
                    </div>
                  ))}

                  {addingToColumn === columnId && addingAtIndex === null ? (
                    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
                      <input
                        type="text"
                        value={newCardTitle}
                        onChange={(e) => setNewCardTitle(e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, columnId)}
                        onBlur={() => {
                          if (newCardTitle.trim()) {
                            handleAddCard(columnId);
                          } else {
                            setAddingToColumn(null);
                            setAddingAtIndex(null);
                          }
                        }}
                        placeholder="Task title..."
                        autoFocus
                        className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/40"
                      />
                      <div className="mt-2 flex gap-2 text-xs text-muted-foreground/60">
                        <span>↵ Save</span>
                        <span>⎋ Cancel</span>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setAddingToColumn(columnId);
                        setAddingAtIndex(null);
                        setNewCardTitle("");
                      }}
                      className="flex items-center gap-2 rounded-lg border border-transparent bg-transparent p-2 text-xs text-muted-foreground/40 transition-colors hover:text-muted-foreground/60"
                    >
                      <Plus className="size-3.5" />
                      Add card
                    </button>
                  )}
                </div>
              </KanbanColumn>
            ))}
          </KanbanBoard>

          <KanbanOverlay>
            {({ value }) => {
              const task = Object.values(columns)
                .flat()
                .find((item) => item.id === value);

              if (!task) return null;

              return (
                <div className="w-80 rounded-lg border border-white/5 bg-card p-3 shadow-lg">
                  <div className="flex gap-2">
                    <div
                      className={`mt-1 flex size-4 shrink-0 items-center justify-center rounded-full border ${
                        task.completed
                          ? "border-green-500/80 bg-green-500/80"
                          : "border-white/20"
                      }`}
                    >
                      {task.completed && (
                        <Check className="size-3 text-white" strokeWidth={3} />
                      )}
                    </div>
                    <GripVertical className="mt-1 size-4 shrink-0 text-muted-foreground opacity-50" />
                    <div className={`flex-1 space-y-2 ${task.completed ? "opacity-50" : ""}`}>
                      <div className={`font-medium ${task.completed ? "line-through" : ""}`}>{task.title}</div>
                      {task.description && (
                        <p className={`text-sm text-muted-foreground ${task.completed ? "line-through" : ""}`}>
                          {task.description}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            }}
          </KanbanOverlay>
        </Kanban>
      </div>

      <Dialog open={editingTask !== null} onOpenChange={(open) => {
        if (!open) {
          setEditingTask(null);
          setEditingColumn(null);
        }
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
          </DialogHeader>
          {editingTask && (
            <div className="space-y-4 py-4">
              {/* Title */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Title</label>
                <input
                  type="text"
                  value={editingTask.title}
                  onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
                  className="w-full rounded-md border border-white/10 bg-white/[0.02] px-3 py-2 text-sm outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20"
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <textarea
                  value={editingTask.description || ""}
                  onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })}
                  placeholder="Optional description..."
                  rows={3}
                  className="w-full rounded-md border border-white/10 bg-white/[0.02] px-3 py-2 text-sm outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 resize-none"
                />
              </div>

              {/* Client */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Client</label>
                <div className="flex flex-wrap gap-2">
                  {CLIENTS.map((client) => (
                    <button
                      key={client.id}
                      type="button"
                      onClick={() => {
                        setEditingTask({
                          ...editingTask,
                          client: editingTask.client === client.id ? undefined : client.id
                        });
                      }}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                        editingTask.client === client.id
                          ? client.className
                          : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60'
                      }`}
                    >
                      {client.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Team Members */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Team Members</label>
                <div className="flex flex-wrap gap-2">
                  {TEAM_MEMBERS.map((member) => {
                    const isAssigned = editingTask.assignees?.includes(member.id);
                    return (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => {
                          const assignees = editingTask.assignees || [];
                          setEditingTask({
                            ...editingTask,
                            assignees: isAssigned
                              ? assignees.filter(id => id !== member.id)
                              : [...assignees, member.id]
                          });
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                          isAssigned
                            ? 'bg-white/10 text-white'
                            : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60'
                        }`}
                      >
                        <div className={`flex items-center justify-center w-4 h-4 rounded-full ${member.color} text-[9px] font-semibold text-white`}>
                          {member.initials}
                        </div>
                        {member.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setEditingTask(null);
                    setEditingColumn(null);
                  }}
                  className="px-4 py-2 rounded-md text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => saveEditedTask(editingTask)}
                  className="px-4 py-2 rounded-md text-sm font-medium bg-white text-black hover:bg-white/90 transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Integrations Section */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Integrations</h3>
              
              {/* Google Calendar */}
              <div className="flex items-center justify-between p-3 rounded-lg border border-white/5 bg-white/[0.02]">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/5">
                    <Calendar className="size-4" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">Google Calendar</div>
                    <div className="text-xs text-white/40">
                      {googleCalendarConnected ? 'Connected' : 'Sync your calendar events'}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (googleCalendarConnected) {
                      clearAccessToken();
                      setGoogleCalendarConnected(false);
                      setCalendarEvents({});
                    } else {
                      initiateGoogleAuth();
                    }
                  }}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    googleCalendarConnected
                      ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                      : 'bg-white text-black hover:bg-white/90'
                  }`}
                >
                  {googleCalendarConnected ? 'Disconnect' : 'Connect'}
                </button>
              </div>
            </div>

            {/* Account Section */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Account</h3>
              
              <div className="flex items-center justify-between p-3 rounded-lg border border-white/5 bg-white/[0.02]">
                <div>
                  <div className="text-sm font-medium">Sign Out</div>
                  <div className="text-xs text-white/40">
                    {user?.email || 'Not signed in'}
                  </div>
                </div>
                <button
                  onClick={async () => {
                    try {
                      const supabase = createClient();
                      const { error } = await supabase.auth.signOut();
                      if (error) {
                        console.error('Sign out error:', error);
                      } else {
                        // Clear local state
                        setUser(null);
                        setColumns({
                          monday: [], tuesday: [], wednesday: [], thursday: [], friday: []
                        });
                        setShowSettings(false);
                      }
                    } catch (err) {
                      console.error('Sign out failed:', err);
                    }
                  }}
                  className="px-3 py-1.5 rounded-md text-xs font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
