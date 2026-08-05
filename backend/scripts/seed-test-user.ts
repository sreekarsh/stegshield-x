import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const existing = await prisma.user.findUnique({
    where: { email: "jordan.case@stegshield.test" },
  })

  if (existing) {
    console.log("User already exists:", existing.email)
    return
  }

  const user = await prisma.user.create({
    data: {
      email: "jordan.case@stegshield.test",
      password: "$argon2id$v=19$m=65536,t=3,p=4$dGVzdA==",
      name: "Jordan Case",
      role: "ADMIN",
      isVerified: true,
      isMFAEnabled: false,
      phone: "+1 (555) 010-9988",
      location: "Washington, D.C.",
      jobTitle: "Digital Forensics Lead",
      department: "Cyber Crime Unit",
      bio: "Test user for steganalysis and forensics workflows.",
      settings: {
        theme: "dark",
        language: "en",
        notifications: { email: true, push: true, inApp: true },
        privacy: { profileVisibility: true, activityStatus: true, searchIndexing: false, shareUsageData: true },
      },
    },
  })

  console.log("Created test user:", user.email)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
