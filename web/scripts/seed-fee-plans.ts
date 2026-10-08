import { prisma } from "../src/lib/db";
import { DurationUnit, PaymentTerms } from "@prisma/client";

async function seedFeePlans() {
  console.log("Seeding standard OXGEN GYM Fee Plans...");

  const plans = [
    {
      name: "Regular Monthly",
      description: "Full gym floor access, cardio section, general workout guidance & locker facility",
      durationValue: 1,
      durationUnit: DurationUnit.CALENDAR_MONTHS,
      membershipFee: 3000,
      admissionFee: 1000,
      includedServices: "Gym Floor Access, Cardio Area, Standard Lockers, General Guidance",
      eligibility: "Everyone",
      paymentTerms: PaymentTerms.FULL_PAYMENT_ONLY,
      isActive: true,
      version: 1,
    },
    {
      name: "Student Monthly",
      description: "Discounted monthly package for verified students with valid student ID card",
      durationValue: 1,
      durationUnit: DurationUnit.CALENDAR_MONTHS,
      membershipFee: 2500,
      admissionFee: 1000,
      includedServices: "Gym Floor Access, Cardio Area, Locker Access",
      eligibility: "Students (Valid Student ID Required)",
      paymentTerms: PaymentTerms.FULL_PAYMENT_ONLY,
      isActive: true,
      version: 1,
    },
    {
      name: "Quarterly Power Plan",
      description: "3 calendar months comprehensive fitness package with installment payment option",
      durationValue: 3,
      durationUnit: DurationUnit.CALENDAR_MONTHS,
      membershipFee: 8000,
      admissionFee: 1000,
      includedServices: "Full Gym Access, Free Diet Consultation, Locker Access, Sauna Weekend Pass",
      eligibility: "Everyone",
      paymentTerms: PaymentTerms.INSTALLMENTS_ALLOWED,
      isActive: true,
      version: 1,
    },
    {
      name: "Yearly Elite VIP",
      description: "12 calendar months all-inclusive VIP pass with 2 free freezes & personal locker",
      durationValue: 12,
      durationUnit: DurationUnit.CALENDAR_MONTHS,
      membershipFee: 30000,
      admissionFee: 1000,
      includedServices: "VIP Access, Dedicated Locker, Steam & Sauna, Quarterly Body Composition Scan",
      eligibility: "Everyone",
      paymentTerms: PaymentTerms.INSTALLMENTS_ALLOWED,
      isActive: true,
      version: 1,
    },
    {
      name: "Custom Short Pass",
      description: "15 days short-term trial or vacation pass with zero admission charges",
      durationValue: 15,
      durationUnit: DurationUnit.DAYS,
      membershipFee: 1800,
      admissionFee: 0,
      includedServices: "Gym Floor & Cardio Access",
      eligibility: "Visitors & Short-term Visitors",
      paymentTerms: PaymentTerms.FULL_PAYMENT_ONLY,
      isActive: true,
      version: 1,
    },
  ];

  for (const p of plans) {
    const upserted = await prisma.feePlan.upsert({
      where: { id: (await prisma.feePlan.findFirst({ where: { name: p.name } }))?.id || "new-id" },
      update: { ...p, isActive: true },
      create: p,
    });
    console.log(`[UPSERTED] ${upserted.name} (Active: ${upserted.isActive})`);
  }

  console.log("Fee plans seeded successfully!");
}

seedFeePlans()
  .catch((err) => {
    console.error("Seed error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
