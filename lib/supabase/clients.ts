import { createClient } from './client'
import type { Client } from '../types'

export async function loadClients(projectId: string): Promise<Client[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('clients')
    .select('id, project_id, name, slug, color, logo_url, sort_order')
    .eq('project_id', projectId)
    .order('sort_order')

  if (error) {
    console.error('Error loading clients:', error)
    return []
  }

  return (data || []).map(c => ({
    id: c.id,
    project_id: c.project_id,
    name: c.name,
    slug: c.slug,
    color: c.color,
    logo_url: c.logo_url || undefined,
    sort_order: c.sort_order,
  }))
}

export async function createClientRecord(
  projectId: string,
  client: { name: string; slug: string; color: string; logo_url?: string; sort_order: number }
): Promise<Client> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('clients')
    .insert({
      project_id: projectId,
      name: client.name,
      slug: client.slug,
      color: client.color,
      logo_url: client.logo_url || null,
      sort_order: client.sort_order,
    })
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
    sort_order: data.sort_order,
  }
}

export async function updateClientRecord(
  clientId: string,
  updates: { name?: string; slug?: string; color?: string; logo_url?: string | null; sort_order?: number }
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
