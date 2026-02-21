import { createClient } from './client'
import { getAreaIdForProject } from './initialize'
import type { BacklogFolder } from '../types'

async function resolveAreaId(projectId: string, areaId?: string | null): Promise<string | null> {
  if (areaId) return areaId
  return getAreaIdForProject(projectId)
}

export async function loadBacklogFolders(projectId: string, cachedAreaId?: string | null): Promise<BacklogFolder[]> {
  const supabase = createClient()
  const areaId = await resolveAreaId(projectId, cachedAreaId)
  if (!areaId) return []

  const { data, error } = await supabase
    .from('backlog_folders')
    .select('*')
    .eq('area_id', areaId)
    .order('sort_order')

  if (error) {
    console.error('Error loading backlog folders:', error)
    return []
  }

  return data as BacklogFolder[]
}

export async function createBacklogFolder(
  projectId: string,
  clientId: string,
  name: string,
  sortOrder: number = 0,
  cachedAreaId?: string | null
): Promise<BacklogFolder | null> {
  const supabase = createClient()
  const areaId = await resolveAreaId(projectId, cachedAreaId)
  if (!areaId) return null

  const { data, error } = await supabase
    .from('backlog_folders')
    .insert({
      area_id: areaId,
      client_id: clientId,
      name,
      sort_order: sortOrder,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating backlog folder:', error)
    return null
  }

  return data as BacklogFolder
}

export async function updateBacklogFolder(
  folderId: string,
  updates: { name?: string; sort_order?: number }
): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from('backlog_folders')
    .update(updates)
    .eq('id', folderId)

  if (error) {
    console.error('Error updating backlog folder:', error)
    throw error
  }
}

export async function deleteBacklogFolder(folderId: string): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from('backlog_folders')
    .delete()
    .eq('id', folderId)

  if (error) {
    console.error('Error deleting backlog folder:', error)
    throw error
  }
}
