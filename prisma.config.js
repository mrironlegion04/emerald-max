require("dotenv").config();
const { defineConfig, env } = require("prisma/config");

module.exports = defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL || "postgresql://cmms_user:secure_password@localhost:5433/cmms_db",
  },
});
