"use client";

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import type { Client, ClientGroup, ClientStatusDef, Member } from "@/lib/types";
import { loadClients } from "@/lib/supabase/clients";
import { loadClientGroups } from "@/lib/supabase/client-groups";
import { loadClientStatuses, seedDefaultStatuses } from "@/lib/supabase/client-statuses";
import { loadWorkspaceProfiles } from "@/lib/supabase/profiles";
import { getAreaIdForProject } from "@/lib/supabase/initialize";
import { useWorkspace } from "./workspace-context";

interface ProjectDataContextValue {
  clients: Client[];
  refreshClients: () => Promise<void>;
  clientGroups: ClientGroup[];
  refreshClientGroups: () => Promise<void>;
  clientStatuses: ClientStatusDef[];
  refreshClientStatuses: () => Promise<void>;
  teamMembers: Member[];
  refreshTeamMembers: () => Promise<void>;
  areaId: string | null;
}

const ProjectDataContext = createContext<ProjectDataContextValue | null>(null);

export function useProjectData() {
  const ctx = useContext(ProjectDataContext);
  if (!ctx) throw new Error("useProjectData must be used within ProjectDataProvider");
  return ctx;
}

export function ProjectDataProvider({ children }: { children: React.ReactNode }) {
  const { activeProjectId } = useWorkspace();

  const [clients, setClients] = useState<Client[]>([]);
  const [clientGroups, setClientGroups] = useState<ClientGroup[]>([]);
  const [clientStatuses, setClientStatuses] = useState<ClientStatusDef[]>([]);
  const [teamMembers, setTeamMembers] = useState<Member[]>([]);
  const [areaId, setAreaId] = useState<string | null>(null);

  const refreshClients = useCallback(async () => {
    if (!activeProjectId) { setClients([]); return; }
    try {
      const data = await loadClients(activeProjectId);
      setClients(data);
    } catch (error) {
      console.error("Error loading clients:", error);
    }
  }, [activeProjectId]);

  const refreshClientGroups = useCallback(async () => {
    if (!activeProjectId) { setClientGroups([]); return; }
    try {
      const data = await loadClientGroups(activeProjectId);
      setClientGroups(data);
    } catch (error) {
      console.error("Error loading client groups:", error);
    }
  }, [activeProjectId]);

  const refreshClientStatuses = useCallback(async () => {
    if (!activeProjectId) { setClientStatuses([]); return; }
    try {
      let data = await loadClientStatuses(activeProjectId);
      if (data.length === 0) {
        data = await seedDefaultStatuses(activeProjectId);
      }
      setClientStatuses(data);
    } catch (error) {
      console.error("Error loading client statuses:", error);
    }
  }, [activeProjectId]);

  const refreshTeamMembers = useCallback(async () => {
    if (!activeProjectId) { setTeamMembers([]); return; }
    try {
      const members = await loadWorkspaceProfiles(activeProjectId);
      setTeamMembers(members);
    } catch {
      setTeamMembers([]);
    }
  }, [activeProjectId]);

  // Load all project data in parallel when active project changes
  useEffect(() => {
    if (!activeProjectId) {
      setClients([]);
      setClientGroups([]);
      setClientStatuses([]);
      setTeamMembers([]);
      setAreaId(null);
      return;
    }

    Promise.all([
      refreshClients(),
      refreshClientGroups(),
      refreshClientStatuses(),
      refreshTeamMembers(),
      getAreaIdForProject(activeProjectId).then(setAreaId),
    ]);
  }, [activeProjectId, refreshClients, refreshClientGroups, refreshClientStatuses, refreshTeamMembers]);

  const value = useMemo(() => ({
    clients, refreshClients,
    clientGroups, refreshClientGroups,
    clientStatuses, refreshClientStatuses,
    teamMembers, refreshTeamMembers,
    areaId,
  }), [
    clients, refreshClients,
    clientGroups, refreshClientGroups,
    clientStatuses, refreshClientStatuses,
    teamMembers, refreshTeamMembers,
    areaId,
  ]);

  return (
    <ProjectDataContext.Provider value={value}>
      {children}
    </ProjectDataContext.Provider>
  );
}
