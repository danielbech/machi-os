import { createClient } from './client'
import type { ClientGroup } from '../types'

export async function loadClientGroups(projectId: string): Promise<ClientGroup[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('client_groups')
    .select('id, project_id, name, logo_url, sort_order, created_at')
    .eq('project_id', projectId)
    .order('sort_order')

  if (error) {
    console.error('Error loading client groups:', error)
    return []
  }

  return (data || []).map(g => ({
    id: g.id,
    project_id: g.project_id,
    name: g.name,
    logo_url: g.logo_url || undefined,
    sort_order: g.sort_order,
    created_at: g.created_at,
  }))
}

export async function createClientGroup(
  projectId: string,
  name: string,
  sortOrder: number
): Promise<ClientGroup> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('client_groups')
    .insert({
      project_id: projectId,
      name,
      sort_order: sortOrder,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating client group:', error)
    throw error
  }

  return {
    id: data.id,
    project_id: data.project_id,
    name: data.name,
    logo_url: data.logo_url || undefined,
    sort_order: data.sort_order,
    created_at: data.created_at,
  }
}

export async function updateClientGroup(
  groupId: string,
  updates: { name?: string; logo_url?: string | null; sort_order?: number }
): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from('client_groups')
    .update(updates)
    .eq('id', groupId)

  if (error) {
    console.error('Error updating client group:', error)
    throw error
  }
}

export async function deleteClientGroup(groupId: string): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from('client_groups')
    .delete()
    .eq('id', groupId)

  if (error) {
    console.error('Error deleting client group:', error)
    throw error
  }
}
