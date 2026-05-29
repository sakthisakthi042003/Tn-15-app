const crypto = require("crypto");

const memory = {
  users: new Map(), // id -> {id, phone, passwordHash, role}
  rides: new Map(), // id -> ride
  drivers: new Map(), // id -> driver
  fares: {
    bike: { baseFare: 30, perKm: 12 },
    auto: { baseFare: 50, perKm: 18 },
  },
};

function id(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

module.exports = { memory, id };

