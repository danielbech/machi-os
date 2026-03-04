import { createClient } from './client'
import type { Client } from '../types'

export async function loadClients(projectId: string): Promise<Client[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order')

  if (error) {
    console.error('Error loading clients:', error)
    return []
  }

  return (data || []).map((c: any) => ({
    id: c.id,
    project_id: c.project_id,
    name: c.name,
    slug: c.slug,
    color: c.color,
    logo_url: c.logo_url || undefined,
    icon: c.icon || undefined,
    sort_order: c.sort_order,
    active: c.active ?? true,
    status_id: c.status_id || undefined,
    client_group_id: c.client_group_id || undefined,
      }))
}

export async function createClientRecord(
  projectId: string,
  client: { name: string; slug: string; color: string; logo_url?: string; icon?: string; sort_order: number; active?: boolean; status_id?: string; client_group_id?: string }
): Promise<Client> {
  const supabase = createClient()

  const row: Record<string, any> = {
    project_id: projectId,
    name: client.name,
    slug: client.slug,
    color: client.color,
    logo_url: client.logo_url || null,
    icon: client.icon || null,
    sort_order: client.sort_order,
    active: client.active ?? true,
    client_group_id: client.client_group_id || null,
  }
  if (client.status_id) row.status_id = client.status_id

  const { data, error } = await supabase
    .from('clients')
    .insert(row)
    .select()
    .single()

  if (error) {
    console.error('Error creating client:', error)
    throw error
  }

  return {
    id: data.id,
    project_id: data.project_id,
    name: data.name,
    slug: data.slug,
    color: data.color,
    logo_url: data.logo_url || undefined,
    icon: data.icon || undefined,
    sort_order: data.sort_order,
    active: data.active ?? true,
    status_id: (data as any).status_id || undefined,
    client_group_id: data.client_group_id || undefined,
      }
}

export async function updateClientRecord(
  clientId: string,
  updates: { name?: string; slug?: string; color?: string; logo_url?: string | null; icon?: string | null; sort_order?: number; active?: boolean; status_id?: string | null; client_group_id?: string | null }
): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from('clients')
    .update(updates)
    .eq('id', clientId)

  if (error) {
    console.error('Error updating client:', error)
    throw error
  }
}

export async function deleteClientRecord(clientId: string): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from('clients')
    .delete()
    .eq('id', clientId)

  if (error) {
    console.error('Error deleting client:', error)
    throw error
  }
}
