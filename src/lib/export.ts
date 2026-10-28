import { getInventoryWorkspace } from "./inventory";
import { getPlanData } from "./planning";

export async function buildAuthorizedExport(userId: string, organizationId: string, cycleId: string) {
  const [plan, operation] = await Promise.all([
    getPlanData(userId, organizationId, cycleId),
    getInventoryWorkspace(userId, organizationId, cycleId),
  ]);
  return { formatVersion: 1, generatedAt: new Date().toISOString(), organizationId, cycleId, plan, operation };
}
