const bcrypt = require("bcryptjs");
const { memory, id } = require("./store/memory");
const repo = require("./db/repo");

async function seedDefaultAdmin() {
  const phone = "9999999999";
  const password = "admin123";
  const passwordHash = await bcrypt.hash(password, 10);

  if (await repo.isDbUp()) {
    const existing = await repo.getUserByPhone(phone);
    if (!existing) {
      await repo.createUser({ phone, passwordHash, role: "admin" });
    }
    return;
  }

  const existing = [...memory.users.values()].find((u) => u.phone === phone);
  if (existing) return;
  const userId = id("usr");
  memory.users.set(userId, { id: userId, phone, passwordHash, role: "admin" });
}

module.exports = { seedDefaultAdmin };

