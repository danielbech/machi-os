import { createClient } from './client'
import type { ClientStatusDef } from '../types'

export async function loadClientStatuses(projectId: string): Promise<ClientStatusDef[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('client_statuses')
    .select('id, project_id, name, color, sort_order, treat_as_active, show_dotted_border, created_at')
    .eq('project_id', projectId)
    .order('sort_order')

  if (error) {
    console.error('Error loading client statuses:', error)
    return []
  }

  return (data || []).map(s => ({
    id: s.id,
    project_id: s.project_id,
    name: s.name,
    color: s.color,
    sort_order: s.sort_order,
    treat_as_active: s.treat_as_active,
    show_dotted_border: s.show_dotted_border ?? false,
    created_at: s.created_at,
  }))
}

export async function createClientStatus(
  projectId: string,
  name: string,
  color: string,
  sortOrder: number,
  treatAsActive: boolean = true,
  showDottedBorder: boolean = false,
): Promise<ClientStatusDef> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('client_statuses')
    .insert({
      project_id: projectId,
      name,
      color,
      sort_order: sortOrder,
      treat_as_active: treatAsActive,
      show_dotted_border: showDottedBorder,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating client status:', error)
    throw error
  }

  return {
    id: data.id,
    project_id: data.project_id,
    name: data.name,
    color: data.color,
    sort_order: data.sort_order,
    treat_as_active: data.treat_as_active,
    show_dotted_border: data.show_dotted_border ?? false,
    created_at: data.created_at,
  }
}

export async function updateClientStatus(
  statusId: string,
  updates: { name?: string; color?: string; sort_order?: number; treat_as_active?: boolean; show_dotted_border?: boolean }
): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from('client_statuses')
    .update(updates)
    .eq('id', statusId)

  if (error) {
    console.error('Error updating client status:', error)
    throw error
  }
}

export async function deleteClientStatus(statusId: string): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from('client_statuses')
    .delete()
    .eq('id', statusId)

  if (error) {
    console.error('Error deleting client status:', error)
    throw error
  }
}

const DEFAULT_STATUSES = [
  { name: 'Active', color: 'green', sort_order: 0, treat_as_active: true, show_dotted_border: false },
  { name: 'Upcoming', color: 'blue', sort_order: 1, treat_as_active: true, show_dotted_border: true },
  { name: 'Expected', color: 'amber', sort_order: 2, treat_as_active: true, show_dotted_border: true },
  { name: 'Idle', color: 'gray', sort_order: 3, treat_as_active: false, show_dotted_border: false },
]

export async function seedDefaultStatuses(projectId: string): Promise<ClientStatusDef[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('client_statuses')
    .insert(DEFAULT_STATUSES.map(s => ({ ...s, project_id: projectId })))
    .select()

  if (error) {
    console.error('Error seeding default statuses:', error)
    throw error
  }

  return (data || []).map(s => ({
    id: s.id,
    project_id: s.project_id,
    name: s.name,
    color: s.color,
    sort_order: s.sort_order,
    treat_as_active: s.treat_as_active,
    show_dotted_border: s.show_dotted_border ?? false,
    created_at: s.created_at,
  }))
}
