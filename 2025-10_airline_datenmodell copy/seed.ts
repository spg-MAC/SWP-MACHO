import { PrismaClient } from "./prisma/client/client.ts";
import { faker } from "@faker-js/faker";

let prisma: PrismaClient;

// Targets requested by user
const ensurePassengers = 20000;
const ensureAirports = 100;
const ensurePlanes = 100;

// Helper: load .env into Deno.env (very small parser)
async function loadEnv(path = ".env") {
  try {
    const txt = await Deno.readTextFile(path);
    for (const line of txt.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
    try { Deno.env.set(key, val); } catch (_e) { /* ignore env set errors */ }
    }
  } catch (_e) {
    // no .env - ignore
  }
}

async function ensurePassengersExist(target: number) {
  let count = await prisma.passenger.count();
  console.log(`📊 Current passengers: ${count}`);
  const batch = 1000;
  while (count < target) {
    const toCreate = Math.min(batch, target - count);
    const data = Array.from({ length: toCreate }).map(() => {
      const first = faker.person.firstName();
      const last = faker.person.lastName();
      const email = `${first.toLowerCase()}.${last.toLowerCase()}.${crypto.randomUUID().slice(0,8)}@example.com`;
      return { firstName: first, lastName: last, email };
    });
      try {
      await prisma.passenger.createMany({ data });
    } catch (e) {
      console.error("Error creating passenger batch:", (e as Error).message);
    }
    count = await prisma.passenger.count();
    console.log(`✅ Passengers now: ${count}`);
  }
}

async function ensurePlanesExist(target: number) {
  let count = await prisma.plane.count();
  console.log(`📊 Current planes: ${count}`);
  const toCreate = Math.max(0, target - count);
  if (toCreate === 0) return;
  const data = Array.from({ length: toCreate }).map(() => ({
    model: faker.airline.airplane().name,
    capacity: faker.number.int({ min: 10, max: 850 }),
  }));
  try {
    await prisma.plane.createMany({ data });
  } catch (e) {
    console.error("Error creating planes:", (e as Error).message);
  }
  count = await prisma.plane.count();
  console.log(`✅ Planes now: ${count}`);
}

async function ensureAirportsExist(target: number) {
  let count = await prisma.airport.count();
  console.log(`📊 Current airports: ${count}`);
  // create airports one-by-one to gracefully handle unique iataCode collisions
  while (count < target) {
    const fake_airport = faker.airline.airport();
    const iata = fake_airport.iataCode ?? faker.string.alpha({ length: 3 }).toUpperCase();
    try {
      await prisma.airport.create({ data: { name: fake_airport.name, iataCode: iata, city: faker.location.city() } });
      count++;
      if (count % 10 === 0) console.log(`✅ Airports now: ${count}`);
    } catch (_e) {
      // likely unique constraint on iataCode; skip and continue
    }
  }
  console.log(`✅ Airports now: ${count}`);
}

async function ensureFlightsExist(target: number) {
  const airports = await prisma.airport.findMany();
  const planes = await prisma.plane.findMany();
  if (airports.length < 2 || planes.length === 0) {
    console.warn("Not enough airports or planes to create flights. Airports:", airports.length, "Planes:", planes.length);
    return;
  }
  let count = await prisma.flight.count();
  console.log(`📊 Current flights: ${count}`);
  const batch = 500;
  while (count < target) {
    const toCreate = Math.min(batch, target - count);
    const data: Array<{ flightNumber: string; departureTime: Date; arrivalTime: Date; originId: string; destinationId: string; planeId: string }> = [];
    for (let i = 0; i < toCreate; i++) {
      const origin = airports[Math.floor(Math.random() * airports.length)];
      let destination = airports[Math.floor(Math.random() * airports.length)];
      while (destination.id === origin.id) {
        destination = airports[Math.floor(Math.random() * airports.length)];
      }
      const plane = planes[Math.floor(Math.random() * planes.length)];
      const departure = new Date(Date.now() + Math.floor(Math.random() * 1000 * 60 * 60 * 24 * 90));
      const durationHours = Math.floor(Math.random() * 12) + 1;
      const arrival = new Date(departure.getTime() + durationHours * 60 * 60 * 1000);
      const flightNumber = `${origin.iataCode}${Math.floor(Math.random() * 9000) + 1000}`;
      data.push({ flightNumber, departureTime: departure, arrivalTime: arrival, originId: origin.id, destinationId: destination.id, planeId: plane.id });
    }
    try {
      await prisma.flight.createMany({ data });
    } catch (e) {
      console.error("Error creating flight batch:", (e as Error).message);
    }
    count = await prisma.flight.count();
    console.log(`✅ Flights now: ${count}`);
  }
}

async function main() {
  await loadEnv();
  // initialize prisma after env is loaded
  prisma = new PrismaClient();
  try {
    console.log("🌱 Starting seed...");
    await ensurePassengersExist(ensurePassengers);
    await ensurePlanesExist(ensurePlanes);
    await ensureAirportsExist(ensureAirports);
    await ensureFlightsExist(2500);
    console.log("🌱 Seed completed successfully!");
  } catch (error) {
    console.error("❌ Error during seed:", error);
  } finally {
    if (prisma) await prisma.$disconnect();
    console.log("🔌 Database connection closed.");
  }
}

if (import.meta.main) {
  main();
}