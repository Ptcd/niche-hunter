import { importPayoutsFromCSV } from './import-payouts';

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error('Usage: tsx src/seed.ts <path-to-payouts.csv>');
    process.exit(1);
  }

  console.log(`Importing payouts from ${csvPath}...`);
  const count = await importPayoutsFromCSV(csvPath);
  console.log(`Imported ${count} payout records.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    const { prisma } = await import('./index');
    await prisma.$disconnect();
  });

