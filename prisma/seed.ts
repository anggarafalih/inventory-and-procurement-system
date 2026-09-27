/**
 * Demo seed. Wipes the request/approval tables and re-creates a small but
 * realistic dataset so the reports have something to aggregate.
 *
 * Run with:  npm run db:seed   (or: npx prisma db seed)
 */
import { PrismaClient, Role, RequestStatus } from "../lib/generated/prisma";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "password123";

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // --- reset (child -> parent) ------------------------------------------------
  await prisma.stockMovement.deleteMany();
  await prisma.requestActivity.deleteMany();
  await prisma.approvalStep.deleteMany();
  await prisma.requestItem.deleteMany();
  await prisma.request.deleteMany();
  await prisma.approvalStage.deleteMany();
  await prisma.approvalWorkflow.deleteMany();
  await prisma.item.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();
  await prisma.department.deleteMany();

  // --- departments ---------------------------------------------------------
  const deptData = [
    { code: "IT", name: "Teknologi Informasi" },
    { code: "FIN", name: "Keuangan" },
    { code: "OPS", name: "Operasional" },
    { code: "HR", name: "Sumber Daya Manusia" },
    { code: "PRC", name: "Pengadaan" },
  ];
  const departments = Object.fromEntries(
    await Promise.all(
      deptData.map(async (d) => [
        d.code,
        await prisma.department.create({ data: d }),
      ]),
    ),
  ) as Record<string, { id: string }>;

  // --- users -------------------------------------------------------------
  const mkUser = (
    email: string,
    name: string,
    role: Role,
    deptCode: string | null,
  ) =>
    prisma.user.create({
      data: {
        email,
        name,
        role,
        passwordHash,
        departmentId: deptCode ? departments[deptCode].id : null,
      },
    });

  const admin = await mkUser("admin@mayora.test", "Admin Sistem", Role.ADMIN, "PRC");
  const director = await mkUser(
    "direktur@mayora.test",
    "Dewi Direktur",
    Role.DIRECTOR,
    null,
  );
  const finance = await mkUser(
    "finance@mayora.test",
    "Fajar Finance",
    Role.FINANCE,
    "FIN",
  );
  const mgrIT = await mkUser("mgr.it@mayora.test", "Mira Manajer IT", Role.MANAGER, "IT");
  const mgrOPS = await mkUser(
    "mgr.ops@mayora.test",
    "Oki Manajer Ops",
    Role.MANAGER,
    "OPS",
  );
  const mgrHR = await mkUser("mgr.hr@mayora.test", "Hana Manajer HR", Role.MANAGER, "HR");

  const reqIT = await mkUser("staff.it@mayora.test", "Ivan Staf IT", Role.REQUESTER, "IT");
  const reqOPS = await mkUser(
    "staff.ops@mayora.test",
    "Oni Staf Ops",
    Role.REQUESTER,
    "OPS",
  );
  const reqHR = await mkUser("staff.hr@mayora.test", "Hesti Staf HR", Role.REQUESTER, "HR");
  const reqFIN = await mkUser(
    "staff.fin@mayora.test",
    "Fani Staf Finance",
    Role.REQUESTER,
    "FIN",
  );

  const managerByDept: Record<string, { id: string }> = {
    IT: mgrIT,
    OPS: mgrOPS,
    HR: mgrHR,
    FIN: mgrIT, // no dedicated FIN manager in demo; IT manager stands in
    PRC: mgrOPS,
  };

  // --- categories (2-level) --------------------------------------------
  const elektronik = await prisma.category.create({ data: { name: "Elektronik" } });
  const atk = await prisma.category.create({ data: { name: "ATK" } });
  const furnitur = await prisma.category.create({ data: { name: "Furnitur" } });
  const catLaptop = await prisma.category.create({
    data: { name: "Laptop & PC", parentId: elektronik.id },
  });
  const catPeriferal = await prisma.category.create({
    data: { name: "Periferal", parentId: elektronik.id },
  });
  const catKertas = await prisma.category.create({
    data: { name: "Kertas", parentId: atk.id },
  });
  const catTulis = await prisma.category.create({
    data: { name: "Alat Tulis", parentId: atk.id },
  });

  // --- items -----------------------------------------------------------
  const itemsData = [
    { sku: "ELK-LP-001", name: "Laptop 14\" i5 16GB", categoryId: catLaptop.id, unit: "unit", unitPrice: 13500000, stockQty: 8, minStock: 3 },
    { sku: "ELK-LP-002", name: "Laptop 15\" i7 32GB", categoryId: catLaptop.id, unit: "unit", unitPrice: 22500000, stockQty: 3, minStock: 2 },
    { sku: "ELK-PC-001", name: "Mini PC Ryzen 5", categoryId: catLaptop.id, unit: "unit", unitPrice: 8500000, stockQty: 5, minStock: 2 },
    { sku: "ELK-MN-001", name: "Monitor 27\" QHD", categoryId: catPeriferal.id, unit: "unit", unitPrice: 3200000, stockQty: 12, minStock: 4 },
    { sku: "ELK-KB-001", name: "Keyboard mekanik", categoryId: catPeriferal.id, unit: "unit", unitPrice: 750000, stockQty: 20, minStock: 6 },
    { sku: "ELK-MS-001", name: "Mouse nirkabel", categoryId: catPeriferal.id, unit: "unit", unitPrice: 250000, stockQty: 35, minStock: 10 },
    { sku: "ELK-HS-001", name: "Headset USB", categoryId: catPeriferal.id, unit: "unit", unitPrice: 480000, stockQty: 15, minStock: 5 },
    { sku: "ATK-KT-001", name: "Kertas A4 80gsm", categoryId: catKertas.id, unit: "rim", unitPrice: 62000, stockQty: 120, minStock: 30 },
    { sku: "ATK-KT-002", name: "Kertas F4 70gsm", categoryId: catKertas.id, unit: "rim", unitPrice: 58000, stockQty: 80, minStock: 20 },
    { sku: "ATK-PN-001", name: "Pulpen hitam", categoryId: catTulis.id, unit: "lusin", unitPrice: 36000, stockQty: 60, minStock: 15 },
    { sku: "ATK-SP-001", name: "Spidol whiteboard", categoryId: catTulis.id, unit: "lusin", unitPrice: 84000, stockQty: 25, minStock: 8 },
    { sku: "FRN-CH-001", name: "Kursi kerja ergonomis", categoryId: furnitur.id, unit: "unit", unitPrice: 1650000, stockQty: 10, minStock: 3 },
    { sku: "FRN-DK-001", name: "Meja kerja 120cm", categoryId: furnitur.id, unit: "unit", unitPrice: 1250000, stockQty: 6, minStock: 2 },
  ];
  const items = Object.fromEntries(
    await Promise.all(
      itemsData.map(async (it) => [
        it.sku,
        await prisma.item.create({ data: it }),
      ]),
    ),
  ) as Record<string, { id: string; unitPrice: unknown }>;

  // --- approval workflows --------------------------------------------
  const wfStandar = await prisma.approvalWorkflow.create({
    data: {
      name: "Standar",
      description: "Nilai < Rp 10 juta — cukup persetujuan manajer.",
      minAmount: 0,
      maxAmount: 10_000_000,
      stages: {
        create: [
          { sequence: 1, name: "Persetujuan Manajer", approverRole: Role.MANAGER },
        ],
      },
    },
  });
  const wfMenengah = await prisma.approvalWorkflow.create({
    data: {
      name: "Menengah",
      description: "Rp 10 juta – 50 juta — manajer lalu finance.",
      minAmount: 10_000_000,
      maxAmount: 50_000_000,
      stages: {
        create: [
          { sequence: 1, name: "Persetujuan Manajer", approverRole: Role.MANAGER },
          { sequence: 2, name: "Verifikasi Finance", approverRole: Role.FINANCE, approverId: finance.id },
        ],
      },
    },
  });
  const wfTinggi = await prisma.approvalWorkflow.create({
    data: {
      name: "Tinggi",
      description: "> Rp 50 juta — manajer, finance, lalu direktur.",
      minAmount: 50_000_000,
      maxAmount: null,
      stages: {
        create: [
          { sequence: 1, name: "Persetujuan Manajer", approverRole: Role.MANAGER },
          { sequence: 2, name: "Verifikasi Finance", approverRole: Role.FINANCE, approverId: finance.id },
          { sequence: 3, name: "Persetujuan Direktur", approverRole: Role.DIRECTOR, approverId: director.id },
        ],
      },
    },
  });

  const workflows = [wfStandar, wfMenengah, wfTinggi];
  const pickWorkflow = (total: number) =>
    workflows.find(
      (w) =>
        total >= Number(w.minAmount) &&
        (w.maxAmount === null || total < Number(w.maxAmount)),
    ) ?? wfTinggi;

  // --- helper to build one request ---------------------------------
  type LineSpec = { sku: string; quantity: number };
  interface RequestSpec {
    requester: { id: string; departmentId: string | null };
    deptCode: string;
    purpose: string;
    lines: LineSpec[];
    finalStatus: RequestStatus;
    submittedDaysAgo: number;
    decisionLagHours: number[]; // per stage
  }

  let counter = 0;
  const year = new Date().getUTCFullYear();

  async function createRequest(spec: RequestSpec) {
    counter += 1;
    const requestNo = `REQ-${year}-${String(counter).padStart(4, "0")}`;
    const submittedAt = new Date(
      Date.now() - spec.submittedDaysAgo * 24 * 60 * 60 * 1000,
    );

    const lineRows = spec.lines.map((l) => {
      const item = items[l.sku] as { id: string; unitPrice: unknown };
      const unitPrice = Number(item.unitPrice);
      return {
        itemId: item.id,
        name: itemsData.find((i) => i.sku === l.sku)!.name,
        quantity: l.quantity,
        unit: itemsData.find((i) => i.sku === l.sku)!.unit,
        unitPrice,
        lineTotal: unitPrice * l.quantity,
      };
    });
    const estimatedTotal = lineRows.reduce((s, r) => s + r.lineTotal, 0);
    const workflow = pickWorkflow(estimatedTotal);
    const stages = await prisma.approvalStage.findMany({
      where: { workflowId: workflow.id },
      orderBy: { sequence: "asc" },
    });

    const isDraft = spec.finalStatus === RequestStatus.DRAFT;
    const rejected = spec.finalStatus === RequestStatus.REJECTED;
    const fullyApproved =
      spec.finalStatus === RequestStatus.APPROVED ||
      spec.finalStatus === RequestStatus.FULFILLED;

    // How many stages got a decision.
    let decidedCount = stages.length;
    if (isDraft) decidedCount = 0;
    else if (spec.finalStatus === RequestStatus.SUBMITTED) decidedCount = 0;
    else if (spec.finalStatus === RequestStatus.IN_REVIEW)
      decidedCount = Math.max(0, stages.length - 1); // all but the last stage
    else if (rejected) decidedCount = 1;

    const request = await prisma.request.create({
      data: {
        requestNo,
        requesterId: spec.requester.id,
        departmentId: departments[spec.deptCode].id,
        workflowId: isDraft ? null : workflow.id,
        purpose: spec.purpose,
        status: spec.finalStatus,
        estimatedTotal,
        currentStage:
          isDraft || fullyApproved || rejected ? 0 : decidedCount + 1,
        neededBy: new Date(submittedAt.getTime() + 14 * 24 * 60 * 60 * 1000),
        submittedAt: isDraft ? null : submittedAt,
        closedAt:
          fullyApproved || rejected
            ? new Date(
                submittedAt.getTime() +
                  (spec.decisionLagHours.reduce((s, h) => s + h, 0) + 4) *
                    60 *
                    60 *
                    1000,
              )
            : null,
        items: { create: lineRows },
      },
    });

    if (!isDraft && spec.finalStatus !== RequestStatus.SUBMITTED) {
      let cursor = submittedAt.getTime();
      for (const stage of stages) {
        const idx = stage.sequence - 1;
        const decided = stage.sequence <= decidedCount;
        const lagH = spec.decisionLagHours[idx] ?? 6;
        // A step becomes actionable when the previous one was decided (or at
        // submit time for the first). It is decided `lagH` hours after that.
        const stageStartedAt = new Date(cursor);
        cursor += lagH * 60 * 60 * 1000;

        const approverId =
          stage.approverId ??
          (stage.approverRole === Role.MANAGER
            ? managerByDept[spec.deptCode]?.id
            : stage.approverRole === Role.FINANCE
              ? finance.id
              : director.id);

        const isRejectingStage = rejected && stage.sequence === decidedCount;

        await prisma.approvalStep.create({
          data: {
            requestId: request.id,
            stageId: stage.id,
            sequence: stage.sequence,
            name: stage.name,
            approverRole: stage.approverRole,
            approverId,
            decision: !decided
              ? "PENDING"
              : isRejectingStage
                ? "REJECTED"
                : "APPROVED",
            decidedById: decided ? approverId : null,
            decidedAt: decided ? new Date(cursor) : null,
            createdAt: stageStartedAt,
            note: isRejectingStage ? "Anggaran belum tersedia kuartal ini." : null,
          },
        });
      }
    } else if (spec.finalStatus === RequestStatus.SUBMITTED) {
      // create pending steps only
      for (const stage of stages) {
        const approverId =
          stage.approverId ??
          (stage.approverRole === Role.MANAGER
            ? managerByDept[spec.deptCode]?.id
            : stage.approverRole === Role.FINANCE
              ? finance.id
              : director.id);
        await prisma.approvalStep.create({
          data: {
            requestId: request.id,
            stageId: stage.id,
            sequence: stage.sequence,
            name: stage.name,
            approverRole: stage.approverRole,
            approverId,
            decision: "PENDING",
            createdAt: submittedAt,
          },
        });
      }
    }

    // activity trail
    await prisma.requestActivity.create({
      data: {
        requestId: request.id,
        actorId: spec.requester.id,
        action: isDraft ? "CREATED" : "SUBMITTED",
        toStatus: isDraft ? RequestStatus.DRAFT : RequestStatus.SUBMITTED,
        createdAt: submittedAt,
      },
    });
    if (fullyApproved) {
      await prisma.requestActivity.create({
        data: {
          requestId: request.id,
          actorId: director.id,
          action: "APPROVED",
          fromStatus: RequestStatus.IN_REVIEW,
          toStatus: RequestStatus.APPROVED,
          createdAt: request.closedAt ?? submittedAt,
        },
      });
    }
    if (rejected) {
      await prisma.requestActivity.create({
        data: {
          requestId: request.id,
          actorId: managerByDept[spec.deptCode]?.id ?? admin.id,
          action: "REJECTED",
          fromStatus: RequestStatus.IN_REVIEW,
          toStatus: RequestStatus.REJECTED,
          note: "Anggaran belum tersedia kuartal ini.",
          createdAt: request.closedAt ?? submittedAt,
        },
      });
    }

    // stock out movement for fulfilled requests
    if (spec.finalStatus === RequestStatus.FULFILLED) {
      for (const l of lineRows) {
        if (!l.itemId) continue;
        const item = await prisma.item.update({
          where: { id: l.itemId },
          data: { stockQty: { decrement: l.quantity } },
        });
        await prisma.stockMovement.create({
          data: {
            itemId: l.itemId,
            requestId: request.id,
            type: "OUT",
            quantity: l.quantity,
            balanceAfter: item.stockQty,
            createdById: admin.id,
            note: `Pemenuhan ${requestNo}`,
            createdAt: request.closedAt ?? new Date(),
          },
        });
      }
      await prisma.requestActivity.create({
        data: {
          requestId: request.id,
          actorId: admin.id,
          action: "FULFILLED",
          fromStatus: RequestStatus.APPROVED,
          toStatus: RequestStatus.FULFILLED,
          createdAt: request.closedAt ?? new Date(),
        },
      });
    }

    return request;
  }

  const specs: RequestSpec[] = [
    {
      requester: reqIT,
      deptCode: "IT",
      purpose: "Penggantian laptop tim developer yang sudah lambat.",
      lines: [{ sku: "ELK-LP-002", quantity: 3 }],
      finalStatus: RequestStatus.FULFILLED,
      submittedDaysAgo: 62,
      decisionLagHours: [20, 30, 26],
    },
    {
      requester: reqIT,
      deptCode: "IT",
      purpose: "Monitor tambahan untuk workstation baru.",
      lines: [
        { sku: "ELK-MN-001", quantity: 6 },
        { sku: "ELK-KB-001", quantity: 6 },
      ],
      finalStatus: RequestStatus.APPROVED,
      submittedDaysAgo: 35,
      decisionLagHours: [10, 14],
    },
    {
      requester: reqOPS,
      deptCode: "OPS",
      purpose: "Stok ATK gudang untuk operasional bulanan.",
      lines: [
        { sku: "ATK-KT-001", quantity: 40 },
        { sku: "ATK-PN-001", quantity: 10 },
        { sku: "ATK-SP-001", quantity: 6 },
      ],
      finalStatus: RequestStatus.FULFILLED,
      submittedDaysAgo: 28,
      decisionLagHours: [8],
    },
    {
      requester: reqHR,
      deptCode: "HR",
      purpose: "Kursi ergonomis untuk karyawan baru onboarding.",
      lines: [{ sku: "FRN-CH-001", quantity: 8 }],
      finalStatus: RequestStatus.APPROVED,
      submittedDaysAgo: 20,
      decisionLagHours: [16, 22],
    },
    {
      requester: reqFIN,
      deptCode: "FIN",
      purpose: "Mini PC untuk pojok laporan keuangan.",
      lines: [{ sku: "ELK-PC-001", quantity: 2 }],
      finalStatus: RequestStatus.REJECTED,
      submittedDaysAgo: 15,
      decisionLagHours: [30],
    },
    {
      requester: reqOPS,
      deptCode: "OPS",
      purpose: "Meja kerja tambahan untuk ekspansi ruang operasional.",
      lines: [{ sku: "FRN-DK-001", quantity: 10 }],
      finalStatus: RequestStatus.IN_REVIEW,
      submittedDaysAgo: 6,
      decisionLagHours: [18, 0],
    },
    {
      requester: reqIT,
      deptCode: "IT",
      purpose: "Headset untuk tim support agar kualitas call membaik.",
      lines: [{ sku: "ELK-HS-001", quantity: 10 }],
      finalStatus: RequestStatus.SUBMITTED,
      submittedDaysAgo: 3,
      decisionLagHours: [0],
    },
    {
      requester: reqHR,
      deptCode: "HR",
      purpose: "Draft permintaan alat tulis untuk pelatihan (belum final).",
      lines: [{ sku: "ATK-PN-001", quantity: 4 }],
      finalStatus: RequestStatus.DRAFT,
      submittedDaysAgo: 1,
      decisionLagHours: [],
    },
    {
      requester: reqIT,
      deptCode: "IT",
      purpose: "Pengadaan laptop entry untuk staf magang.",
      lines: [{ sku: "ELK-LP-001", quantity: 2 }],
      finalStatus: RequestStatus.FULFILLED,
      submittedDaysAgo: 90,
      decisionLagHours: [12, 20],
    },
  ];

  for (const spec of specs) {
    await createRequest(spec);
  }

  const [users, reqCount] = await Promise.all([
    prisma.user.count(),
    prisma.request.count(),
  ]);
  console.log(
    `Seed selesai: ${users} user, ${itemsData.length} item, ${reqCount} request.`,
  );
  console.log(`Login demo — password semua akun: ${DEMO_PASSWORD}`);
  console.log("  admin@mayora.test (ADMIN) · direktur@mayora.test (DIRECTOR)");
  console.log("  finance@mayora.test (FINANCE) · mgr.it@mayora.test (MANAGER)");
  console.log("  staff.it@mayora.test (REQUESTER)");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
