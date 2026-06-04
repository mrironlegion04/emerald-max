**create a new user (role) in PostgreSQL** and give it access to your `cmms_db` database 👇

---

## ✅ 1. Login to PostgreSQL

```bash
psql -U postgres
```


```sql
CREATE DATABASE cmms_db;
\q
```
---

## ✅ 2. Create a new user

```sql
CREATE USER cmms_user WITH PASSWORD 'secure_password';
```

---

## ✅ 3. Allow the user to connect to the database

```sql
GRANT CONNECT ON DATABASE cmms_db TO cmms_user;
```

---

## ✅ 4. Grant full access to the database (common for apps)

```sql
GRANT ALL PRIVILEGES ON DATABASE cmms_db TO cmms_user;
```

---

## ✅ 5. Grant table permissions (IMPORTANT for Prisma)

Switch to the database:

```sql
\c cmms_db
```

Then run:

```sql
GRANT ALL ON SCHEMA public TO cmms_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO cmms_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO cmms_user;
```

---

## ✅ 6. Make future tables accessible automatically

```sql
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT ALL ON TABLES TO cmms_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT ALL ON SEQUENCES TO cmms_user;
```

---

## ✅ 7. Update your Prisma `.env`

```env
DATABASE_URL="postgresql://cmms_user:secure_password@localhost:5433/cmms_db"
```

---

## ✅ 8. Test connection

```bash
psql "postgresql://cmms_user:secure_password@localhost:5433/cmms_db"
```

---

## 🔥 Alternative (one-liner with DB create permission)

If you want a more powerful user:

```sql
CREATE USER cmms_user WITH PASSWORD 'secure_password' CREATEDB;
```

---

## 🚨 Common mistakes

* Forgot to `\c cmms_db` before granting schema permissions
* Using wrong port (5432 vs 5433)
* Not granting schema privileges → Prisma migrations fail
