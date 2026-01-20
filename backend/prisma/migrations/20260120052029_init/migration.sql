-- CreateTable
CREATE TABLE "EmergencyRequest" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmergencyRequest_pkey" PRIMARY KEY ("id")
);
