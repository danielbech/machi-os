import { useEffect, useState } from 'react'
import { createClient } from './client'
import type { Database } from './database.types'

type Project = Database['public']['Tables']['projects']['Row']
type Area = Database['public']['Tables']['areas']['Row']
type Task = Database['public']['Tables']['tasks']['Row']
type TeamMember = Database['public']['Tables']['team_members']['Row']

export function useProjects(userId: string | undefined) {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    if (!userId) {
      setProjects([])
      setLoading(false)
      return
    }

    async function fetchProjects() {
      const { data } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', userId)
        .order('created_at')

      if (data) setProjects(data)
      setLoading(false)
    }

    fetchProjects()

    // Real-time subscription
    const channel = supabase
      .channel('projects-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'projects',
          filter: `user_id=eq.${userId}`,
        },
        () => fetchProjects()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  return { projects, loading }
}

export function useAreas(projectId: string | undefined) {
  const [areas, setAreas] = useState<Area[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    if (!projectId) {
      setAreas([])
      setLoading(false)
      return
    }

    async function fetchAreas() {
      const { data } = await supabase
        .from('areas')
        .select('*')
        .eq('project_id', projectId)
        .order('sort_order')

      if (data) setAreas(data)
      setLoading(false)
    }

    fetchAreas()

    // Real-time subscription
    const channel = supabase
      .channel('areas-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'areas',
          filter: `project_id=eq.${projectId}`,
        },
        () => fetchAreas()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [projectId])

  return { areas, loading }
}

export function useTasks(areaId: string | undefined) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    if (!areaId) {
      setTasks([])
      setLoading(false)
      return
    }

    async function fetchTasks() {
      const { data } = await supabase
        .from('tasks')
        .select('*')
        .eq('area_id', areaId)
        .order('sort_order')

      if (data) setTasks(data)
      setLoading(false)
    }

    fetchTasks()

    // Real-time subscription
    const channel = supabase
      .channel('tasks-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `area_id=eq.${areaId}`,
        },
        () => fetchTasks()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [areaId])

  return { tasks, loading }
}

export function useTeamMembers(userId: string | undefined) {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    if (!userId) {
      setTeamMembers([])
      setLoading(false)
      return
    }

    async function fetchTeamMembers() {
      const { data } = await supabase
        .from('team_members')
        .select('*')
        .eq('user_id', userId)
        .order('created_at')

      if (data) setTeamMembers(data)
      setLoading(false)
    }

    fetchTeamMembers()

    // Real-time subscription
    const channel = supabase
      .channel('team-members-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'team_members',
          filter: `user_id=eq.${userId}`,
        },
        () => fetchTeamMembers()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  return { teamMembers, loading }
}

// Helper functions for CRUD operations
export async function createProject(data: Database['public']['Tables']['projects']['Insert']) {
  const supabase = createClient()
  return await supabase.from('projects').insert(data).select().single()
}

export async function updateProject(id: string, data: Database['public']['Tables']['projects']['Update']) {
  const supabase = createClient()
  return await supabase.from('projects').update(data).eq('id', id).select().single()
}

export async function deleteProject(id: string) {
  const supabase = createClient()
  return await supabase.from('projects').delete().eq('id', id)
}

export async function createArea(data: Database['public']['Tables']['areas']['Insert']) {
  const supabase = createClient()
  return await supabase.from('areas').insert(data).select().single()
}

export async function createTask(data: Database['public']['Tables']['tasks']['Insert']) {
  const supabase = createClient()
  return await supabase.from('tasks').insert(data).select().single()
}

export async function updateTask(id: string, data: Database['public']['Tables']['tasks']['Update']) {
  const supabase = createClient()
  return await supabase.from('tasks').update(data).eq('id', id).select().single()
}

export async function deleteTask(id: string) {
  const supabase = createClient()
  return await supabase.from('tasks').delete().eq('id', id)
}

export async function uploadLogo(file: File, projectId: string) {
  const supabase = createClient()
  const fileExt = file.name.split('.').pop()
  const fileName = `${projectId}.${fileExt}`
  const filePath = fileName

  const { data, error } = await supabase.storage
    .from('Project Logos')
    .upload(filePath, file, { upsert: true })

  if (error) throw error

  const { data: { publicUrl } } = supabase.storage
    .from('Project Logos')
    .getPublicUrl(filePath)

  return publicUrl
}
