const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const req = await prisma.emergencyRequest.create({
    data: {
      type: "Ambulance",
      location: "123 Main St"
    }
  });
  console.log("Created EmergencyRequest:", req);

  const allRequests = await prisma.emergencyRequest.findMany();
  console.log("All Requests:", allRequests);
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());

