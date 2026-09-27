import "server-only";

import type { Prisma } from "@/lib/generated/prisma";
import { Role } from "@/lib/generated/prisma";

/// Approval-workflow resolution + step generation. Shared by the "submit"
/// server actions. All functions take a transaction client so the caller can
/// wrap request mutation + step creation in one atomic `$transaction`.

type Tx = Prisma.TransactionClient;

/// Picks the active workflow whose amount band contains `estimatedTotal`
/// (minAmount inclusive, maxAmount exclusive; null maxAmount = open-ended).
/// Falls back to the highest band, or null when no workflow is configured.
export async function resolveWorkflow(tx: Tx, estimatedTotal: number) {
  const workflows = await tx.approvalWorkflow.findMany({
    where: { isActive: true },
    orderBy: { minAmount: "asc" },
  });
  if (workflows.length === 0) return null;

  const match = workflows.find(
    (w) =>
      Number(w.minAmount) <= estimatedTotal &&
      (w.maxAmount === null || estimatedTotal < Number(w.maxAmount)),
  );
  return match ?? workflows[workflows.length - 1];
}

/// Resolves the concrete approver for a stage: the explicit assignee if set,
/// otherwise an active user with the stage's role — preferring the requester's
/// own department — otherwise null (left unassigned for an admin to fill).
export async function resolveApproverId(
  tx: Tx,
  opts: {
    approverRole: Role;
    explicitApproverId?: string | null;
    requesterDepartmentId?: string | null;
  },
): Promise<string | null> {
  if (opts.explicitApproverId) return opts.explicitApproverId;

  if (opts.requesterDepartmentId) {
    const inDept = await tx.user.findFirst({
      where: {
        role: opts.approverRole,
        isActive: true,
        departmentId: opts.requesterDepartmentId,
      },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
    if (inDept) return inDept.id;
  }

  const anyone = await tx.user.findFirst({
    where: { role: opts.approverRole, isActive: true },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  return anyone?.id ?? null;
}

/// Materialises a workflow's stage templates into per-request ApprovalStep
/// rows. Returns the number of steps created.
export async function generateApprovalSteps(
  tx: Tx,
  params: {
    requestId: string;
    workflowId: string;
    requesterDepartmentId: string | null;
  },
): Promise<number> {
  const stages = await tx.approvalStage.findMany({
    where: { workflowId: params.workflowId },
    orderBy: { sequence: "asc" },
  });

  for (const stage of stages) {
    const approverId = await resolveApproverId(tx, {
      approverRole: stage.approverRole,
      explicitApproverId: stage.approverId,
      requesterDepartmentId: params.requesterDepartmentId,
    });

    await tx.approvalStep.create({
      data: {
        requestId: params.requestId,
        stageId: stage.id,
        sequence: stage.sequence,
        name: stage.name,
        approverRole: stage.approverRole,
        approverId,
        decision: "PENDING",
      },
    });
  }

  return stages.length;
}
