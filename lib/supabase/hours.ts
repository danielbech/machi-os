import { createClient } from './client'
import type { InvoiceGroup, HourEntry } from '../types'

// ─── Invoice Groups ─────────────────────────────────────────────────────────

export async function loadInvoiceGroups(projectId: string): Promise<InvoiceGroup[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('invoice_groups')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error loading invoice groups:', error)
    return []
  }

  return (data || []).map(mapInvoiceGroup)
}

export async function createInvoiceGroup(
  projectId: string,
  clientId: string,
  name: string,
  hourlyRate: number,
): Promise<InvoiceGroup> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('invoice_groups')
    .insert({
      project_id: projectId,
      client_id: clientId,
      name,
      hourly_rate: hourlyRate,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating invoice group:', error)
    throw error
  }

  return mapInvoiceGroup(data)
}

export async function updateInvoiceGroup(
  groupId: string,
  updates: { name?: string; invoice_number?: string | null; hourly_rate?: number; status?: 'active' | 'closed' },
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('invoice_groups')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', groupId)

  if (error) {
    console.error('Error updating invoice group:', error)
    throw error
  }
}

export async function deleteInvoiceGroup(groupId: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('invoice_groups')
    .delete()
    .eq('id', groupId)

  if (error) {
    console.error('Error deleting invoice group:', error)
    throw error
  }
}

// ─── Hour Entries ───────────────────────────────────────────────────────────

export async function loadHourEntries(
  projectId: string,
  filters?: { client_id?: string; invoice_group_id?: string },
): Promise<HourEntry[]> {
  const supabase = createClient()
  let query = supabase
    .from('hour_entries')
    .select('*')
    .eq('project_id', projectId)
    .order('date', { ascending: true })
    .order('created_at', { ascending: true })

  if (filters?.client_id) query = query.eq('client_id', filters.client_id)
  if (filters?.invoice_group_id) query = query.eq('invoice_group_id', filters.invoice_group_id)

  const { data, error } = await query

  if (error) {
    console.error('Error loading hour entries:', error)
    return []
  }

  return (data || []).map(mapHourEntry)
}

export async function createHourEntry(
  entry: {
    invoice_group_id: string;
    client_id: string;
    project_id: string;
    description: string;
    duration: number;
    date: string;
    logged_by: string;
  },
): Promise<HourEntry> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('hour_entries')
    .insert(entry)
    .select()
    .single()

  if (error) {
    console.error('Error creating hour entry:', error)
    throw error
  }

  return mapHourEntry(data)
}

export async function updateHourEntry(
  entryId: string,
  updates: { description?: string; duration?: number; date?: string },
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('hour_entries')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', entryId)

  if (error) {
    console.error('Error updating hour entry:', error)
    throw error
  }
}

export async function deleteHourEntry(entryId: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('hour_entries')
    .delete()
    .eq('id', entryId)

  if (error) {
    console.error('Error deleting hour entry:', error)
    throw error
  }
}

// ─── Shared view (server-side, bypasses RLS) ────────────────────────────────

export async function loadInvoiceGroupByShareToken(token: string): Promise<{
  group: InvoiceGroup;
  entries: HourEntry[];
  clientName: string;
} | null> {
  // This is called from a server component — import admin client dynamically
  const { createAdminClient } = await import('./server')
  const supabase = createAdminClient()

  const { data: group, error: groupError } = await supabase
    .from('invoice_groups')
    .select('*')
    .eq('share_token', token)
    .single()

  if (groupError || !group) return null

  const [{ data: entries }, { data: client }] = await Promise.all([
    supabase
      .from('hour_entries')
      .select('*')
      .eq('invoice_group_id', group.id)
      .order('date', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase
      .from('client_groups')
      .select('name')
      .eq('id', group.client_id)
      .single(),
  ])

  return {
    group: mapInvoiceGroup(group),
    entries: (entries || []).map(mapHourEntry),
    clientName: client?.name || 'Unknown',
  }
}

// ─── Mappers ────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapInvoiceGroup(row: any): InvoiceGroup {
  return {
    id: row.id,
    project_id: row.project_id,
    client_id: row.client_id,
    name: row.name,
    invoice_number: row.invoice_number || null,
    hourly_rate: row.hourly_rate,
    status: row.status,
    share_token: row.share_token,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapHourEntry(row: any): HourEntry {
  return {
    id: row.id,
    invoice_group_id: row.invoice_group_id,
    client_id: row.client_id,
    project_id: row.project_id,
    description: row.description,
    duration: row.duration,
    date: row.date,
    logged_by: row.logged_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}
