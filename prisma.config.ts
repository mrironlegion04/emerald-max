import "dotenv/config";
import { defineConfig } from "prisma/config";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is required. Copy .env.sample to .env and set a real connection string."
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
