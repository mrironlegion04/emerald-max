# CMMS Setup Instructions

## Generate Prisma client & push schema

```bash
npx prisma generate
npx prisma db push
```


## Step 2 — Seed the database

```bash
npm run db:seed
```

You should see:
```
✅ Users created
✅ Locations created
✅ Categories created
✅ Assets created
✅ Parts created
✅ Work orders created
✅ PM schedules created
🎉 Seed complete!
```

---

## Login credentials

| Role        | Email               | Password    |
|-------------|---------------------|-------------|
| Admin       | admin@cmms.com      | (rotated — run `npm run rotate-admin-password`) |
| Manager     | manager@cmms.com    | manager123  |
| Technician  | tech1@cmms.com      | tech123     |
| Technician  | tech2@cmms.com      | tech123     |

> The Admin password is rotated on production. The seed password (`admin123`) exists only in
> the development seed (`prisma/seed.ts`), which refuses to run when `NODE_ENV=production`.

