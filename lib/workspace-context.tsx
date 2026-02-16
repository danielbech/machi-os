"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { User } from "@supabase/supabase-js";
import type { Project, Client } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { initializeUserData } from "@/lib/supabase/initialize";
import { getUserWorkspaces } from "@/lib/supabase/workspace";
import { loadClients } from "@/lib/supabase/clients";

interface WorkspaceContextValue {
  user: User | null;
  loading: boolean;
  userProjects: Project[];
  activeProjectId: string | null;
  setActiveProjectId: (id: string) => void;
  activeProject: Project | undefined;
  clients: Client[];
  refreshClients: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [userProjects, setUserProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectIdState] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);

  const setActiveProjectId = useCallback((id: string) => {
    setActiveProjectIdState(id);
    localStorage.setItem("machi-active-project", id);
  }, []);

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
        await initializeUserData(user!.id);
        const projects = await getUserWorkspaces();
        if (cancelled) return;

        setUserProjects(projects);

        const stored = localStorage.getItem("machi-active-project");
        const validStored = projects.find((p) => p.id === stored);
        const projectId = validStored?.id || projects[0]?.id || null;
        setActiveProjectIdState(projectId);
      } catch (error) {
        console.error("Error loading workspaces:", error);
      }
    }

    loadWorkspaces();
    return () => { cancelled = true; };
  }, [user]);

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
  }, [refreshClients]);

  const activeProject = userProjects.find((p) => p.id === activeProjectId);

  return (
    <WorkspaceContext.Provider
      value={{
        user,
        loading,
        userProjects,
        activeProjectId,
        setActiveProjectId,
        activeProject,
        clients,
        refreshClients,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}
