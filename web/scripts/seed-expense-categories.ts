import { prisma } from "../src/lib/db";

async function seedExpenseCategories() {
  console.log("Seeding standard OXGEN GYM Expense Categories...");

  const categories = [
    { name: "Rent", description: "Gym building and facility monthly lease / rent" },
    { name: "Salaries", description: "Monthly staff salaries for trainers, receptionists, cleaners" },
    { name: "Utilities", description: "Electricity (MEPCO/LESCO), water, commercial gas, high-speed fiber internet" },
    { name: "Equipment", description: "New gym machines, dumbbells, barbells, benches, resistance bands" },
    { name: "Repairs & Maintenance", description: "Cable replacements, treadmill servicing, AC repairs, plumbing" },
    { name: "Cleaning & Supplies", description: "Disinfectants, towels, phenyl, soap, washroom supplies" },
    { name: "Marketing", description: "Flex banners, social media sponsored ads, promotional flyers" },
    { name: "Other", description: "Miscellaneous administrative & refreshment expenses" },
  ];

  for (const cat of categories) {
    const existing = await prisma.expenseCategory.findUnique({
      where: { name: cat.name },
    });

    if (!existing) {
      await prisma.expenseCategory.create({
        data: cat,
      });
      console.log(`[CREATED] Category: ${cat.name}`);
    } else {
      console.log(`[EXISTS] Category: ${cat.name}`);
    }
  }

  console.log("Expense categories ready!");
}

seedExpenseCategories()
  .catch((err) => {
    console.error("Error seeding categories:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
