"use client";

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import type { User } from "@supabase/supabase-js";
import type { Project, Client, Member, WeekMode, DayName } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { initializeUserData, getAreaIdForProject } from "@/lib/supabase/initialize";
import { getUserWorkspaces } from "@/lib/supabase/workspace";
import { loadWorkspaceProfiles } from "@/lib/supabase/profiles";
import { loadClients } from "@/lib/supabase/clients";
import { transitionWeek } from "@/lib/supabase/tasks-simple";

interface WorkspaceContextValue {
  user: User | null;
  loading: boolean;
  userProjects: Project[];
  activeProjectId: string | null;
  setActiveProjectId: (id: string) => void;
  activeProject: Project | undefined;
  clients: Client[];
  refreshClients: () => Promise<void>;
  teamMembers: Member[];
  refreshTeamMembers: () => Promise<void>;
  // Weekly transition
  transitionToNextWeek: () => Promise<{ deleted: number; carriedOver: number }>;
  transitionDay: number;
  transitionHour: number;
  transitionCount: number;
  setTransitionSchedule: (day: number, hour: number) => Promise<void>;
  displayMonday: Date;
  // Week mode
  weekMode: WeekMode;
  setWeekMode: (mode: WeekMode) => Promise<void>;
  weekDays: DayName[];
  refreshWorkspaces: () => Promise<void>;
  areaId: string | null;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}

// Helper: get the raw current week's Monday (no transition offset)
function getCurrentMonday() {
  const today = new Date();
  const currentDay = today.getDay();
  const monday = new Date(today);
  const offset = currentDay === 0 ? -6 : 1 - currentDay;
  monday.setDate(today.getDate() + offset);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

// Helper: check if we should show next week (transition ran + still on/after transition day)
function isTransitionedToNextWeek(transitionDay: number) {
  if (typeof window === "undefined") return false;
  const monday = getCurrentMonday();
  const marker = localStorage.getItem("flowie-last-transition");
  const currentDay = new Date().getDay();
  const inPostTransitionWindow = transitionDay === 0
    ? currentDay === 0
    : currentDay >= transitionDay || currentDay === 0;
  return marker === monday.toISOString() && inPostTransitionWindow;
}

// Helper: get the display week's Monday, accounting for transition offset
function getDisplayMonday(transitionDay: number) {
  const monday = getCurrentMonday();
  if (isTransitionedToNextWeek(transitionDay)) {
    monday.setDate(monday.getDate() + 7);
  }
  return monday;
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [userProjects, setUserProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectIdState] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [teamMembers, setTeamMembers] = useState<Member[]>([]);
  const [areaId, setAreaId] = useState<string | null>(null);

  // Week mode
  const [weekMode, setWeekModeState] = useState<WeekMode>("5-day");

  // Transition schedule
  const [transitionDay, setTransitionDayState] = useState(5);
  const [transitionHour, setTransitionHourState] = useState(17);
  const [transitionCount, setTransitionCount] = useState(0);

  const ALL_FIVE_DAYS: DayName[] = ["monday", "tuesday", "wednesday", "thursday", "friday"];
  const ALL_SEVEN_DAYS: DayName[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  const weekDays = weekMode === "7-day" ? ALL_SEVEN_DAYS : ALL_FIVE_DAYS;

  const setActiveProjectId = useCallback((id: string) => {
    setActiveProjectIdState(id);
    localStorage.setItem("flowie-active-project", id);
  }, []);

  const refreshWorkspaces = useCallback(async () => {
    const projects = await getUserWorkspaces();
    setUserProjects(projects);
    const activeStillExists = projects.find((p) => p.id === activeProjectId);
    if (!activeStillExists && projects.length > 0) {
      const newId = projects[0].id;
      setActiveProjectIdState(newId);
      localStorage.setItem("flowie-active-project", newId);
    }
  }, [activeProjectId]);

  // Auth check
  useEffect(() => {
    const supabase = createClient();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    }).catch((err) => {
      console.error("Session check error:", err);
      setLoading(false);
    });

    return () => { subscription.unsubscribe(); };
  }, []);

  // Initialize user data and load workspaces
  useEffect(() => {
    if (!user) {
      setUserProjects([]);
      setActiveProjectIdState(null);
      setClients([]);
      return;
    }

    let cancelled = false;

    async function loadWorkspaces() {
      try {
        // Run init and workspace load in parallel — for returning users
        // initializeUserData returns early (just a membership check), so
        // getUserWorkspaces can safely run alongside it. For brand-new users
        // we retry if the first load returns empty.
        const [, projects] = await Promise.all([
          initializeUserData(user!.id),
          getUserWorkspaces(),
        ]);

        let finalProjects = projects;
        if (finalProjects.length === 0) {
          // New user — init just created their workspace, fetch again
          finalProjects = await getUserWorkspaces();
        }

        if (cancelled) return;

        setUserProjects(finalProjects);

        const stored = localStorage.getItem("flowie-active-project");
        const validStored = finalProjects.find((p) => p.id === stored);
        const projectId = validStored?.id || finalProjects[0]?.id || null;
        setActiveProjectIdState(projectId);
      } catch (error) {
        console.error("Error loading workspaces:", error);
      }
    }

    loadWorkspaces();
    return () => { cancelled = true; };
  }, [user]);

  // Sync weekMode + transition schedule from active project
  useEffect(() => {
    const project = userProjects.find((p) => p.id === activeProjectId);
    if (project) {
      setWeekModeState(project.week_mode || "5-day");
      setTransitionDayState(project.transition_day ?? 5);
      setTransitionHourState(project.transition_hour ?? 17);
    }
  }, [activeProjectId, userProjects]);

  // setWeekMode: update Supabase + local state, auto-adjust transition day
  const setWeekMode = useCallback(async (mode: WeekMode) => {
    setWeekModeState(mode);
    if (!activeProjectId) return;
    const supabase = createClient();
    const updates: Record<string, any> = { week_mode: mode };

    let newTransitionDay = transitionDay;
    if (transitionDay === 5 && mode === "7-day") {
      newTransitionDay = 0;
      updates.transition_day = 0;
      setTransitionDayState(0);
    } else if (transitionDay === 0 && mode === "5-day") {
      newTransitionDay = 5;
      updates.transition_day = 5;
      setTransitionDayState(5);
    }

    await supabase.from("projects").update(updates).eq("id", activeProjectId);
    setUserProjects((prev) =>
      prev.map((p) => (p.id === activeProjectId ? { ...p, week_mode: mode, transition_day: newTransitionDay } : p))
    );
  }, [activeProjectId, transitionDay]);

  // setTransitionSchedule: update day + hour in Supabase + local state
  const setTransitionSchedule = useCallback(async (day: number, hour: number) => {
    setTransitionDayState(day);
    setTransitionHourState(hour);
    if (!activeProjectId) return;
    const supabase = createClient();
    await supabase.from("projects").update({ transition_day: day, transition_hour: hour }).eq("id", activeProjectId);
    setUserProjects((prev) =>
      prev.map((p) => (p.id === activeProjectId ? { ...p, transition_day: day, transition_hour: hour } : p))
    );
  }, [activeProjectId]);

  // Refresh team members (workspace profiles)
  const refreshTeamMembers = useCallback(async () => {
    if (!activeProjectId) {
      setTeamMembers([]);
      return;
    }
    try {
      const members = await loadWorkspaceProfiles(activeProjectId);
      setTeamMembers(members);
    } catch {
      setTeamMembers([]);
    }
  }, [activeProjectId]);

  // Load clients when active project changes
  const refreshClients = useCallback(async () => {
    if (!activeProjectId) {
      setClients([]);
      return;
    }
    try {
      const data = await loadClients(activeProjectId);
      setClients(data);
    } catch (error) {
      console.error("Error loading clients:", error);
    }
  }, [activeProjectId]);

  useEffect(() => {
    refreshClients();
    if (activeProjectId) {
      loadWorkspaceProfiles(activeProjectId).then(setTeamMembers).catch(() => setTeamMembers([]));
      getAreaIdForProject(activeProjectId).then(setAreaId);
    } else {
      setTeamMembers([]);
      setAreaId(null);
    }
  }, [refreshClients, activeProjectId]);

  // --- Weekly Transition ---

  const transitionToNextWeek = useCallback(async () => {
    if (!activeProjectId) return { deleted: 0, carriedOver: 0 };
    const result = await transitionWeek(activeProjectId, areaId);
    const monday = getCurrentMonday();
    localStorage.setItem("flowie-last-transition", monday.toISOString());
    setTransitionCount((c) => c + 1);
    return result;
  }, [activeProjectId, areaId]);

  // Auto-trigger: every 60s check if it's transition day >= transition hour and hasn't run this week
  useEffect(() => {
    if (!activeProjectId) return;

    const check = () => {
      const now = new Date();
      if (now.getDay() !== transitionDay || now.getHours() < transitionHour) return;

      const monday = getCurrentMonday();
      const marker = localStorage.getItem("flowie-last-transition");
      if (marker === monday.toISOString()) return;

      transitionToNextWeek();
    };

    check();
    const interval = setInterval(check, 60 * 1000);
    return () => clearInterval(interval);
  }, [activeProjectId, transitionToNextWeek, transitionDay, transitionHour]);

  const activeProject = userProjects.find((p) => p.id === activeProjectId);
  const displayMonday = getDisplayMonday(transitionDay);

  const value = useMemo(() => ({
    user, loading, userProjects, activeProjectId, setActiveProjectId,
    activeProject, clients, refreshClients, teamMembers, refreshTeamMembers,
    transitionToNextWeek, transitionDay, transitionHour, transitionCount,
    setTransitionSchedule, displayMonday, weekMode, setWeekMode, weekDays,
    refreshWorkspaces, areaId,
  }), [
    user, loading, userProjects, activeProjectId, setActiveProjectId,
    activeProject, clients, refreshClients, teamMembers, refreshTeamMembers,
    transitionToNextWeek, transitionDay, transitionHour, transitionCount,
    setTransitionSchedule, displayMonday, weekMode, setWeekMode, weekDays,
    refreshWorkspaces, areaId,
  ]);

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}
