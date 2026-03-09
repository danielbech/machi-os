import { getAreaIdForProject } from './initialize'

/**
 * Resolve the area ID for a project. If an area ID is already cached, return it.
 * Otherwise, look it up from the database.
 */
export async function resolveAreaId(projectId: string, areaId?: string | null): Promise<string | null> {
  if (areaId) return areaId
  return getAreaIdForProject(projectId)
}
