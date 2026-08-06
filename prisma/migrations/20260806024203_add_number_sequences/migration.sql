-- CreateTable
CREATE TABLE "number_sequences" (
    "prefix" TEXT NOT NULL,
    "counter" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "number_sequences_pkey" PRIMARY KEY ("prefix")
);
