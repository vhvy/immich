import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import sqlite from "node:sqlite";

let dbInitTimer = 0;
let db: sqlite.DatabaseSync | null = null;

async function initDB() {
  if (!db) return;
  const filePath = path.resolve("/mnt/data.csv");
  await fs.access(filePath);
  db.prepare(`
      CREATE TABLE track (
        timestamp INTEGER PRIMARY KEY,
        lon REAL,
        lat REAL
      )
    `).run();

  const stmt = db.prepare("INSERT OR IGNORE INTO track (timestamp, lon, lat) VALUES (?, ?, ?)");

  const fd = await fs.open(filePath, "r");
  let isFirstLine = true;
  for await (let line of fd.readLines()) {
    if (isFirstLine) {
      isFirstLine = false; // Skip the header line
      continue;
    }
    const row = line.split(",");
    stmt.run(parseInt(row[0]), parseFloat(row[2]), parseFloat(row[3]));
  }
}

async function getDB() {
  const diff = Date.now() - dbInitTimer;
  const requireReinit = !db || diff > 1000 * 60 * 10;
  if (!requireReinit) {
    return db;
  }
  db = new sqlite.DatabaseSync(":memory:");
  dbInitTimer = Date.now();

  try {
    await initDB();
  } catch (error) {
    return null;
  }


  return db;
}


interface GeoData {
  lon: number;
  lat: number;
}

async function getGeoByTimestamp(timestamp: number): Promise<GeoData | null> {
  const db = await getDB();
  if (!db) return null;
  const row = db.prepare(`
      SELECT timestamp, lon, lat
      FROM track
      WHERE ABS(timestamp - ?) <= 10800
      ORDER BY ABS(timestamp - ?)
      LIMIT 1
    `).get(timestamp, timestamp);
  if (!row || !row.lon || !row.lat) return null;
  return {
    lon: Number(row.lon),
    lat: Number(row.lat)
  };
}

async function main() {
  const server = http.createServer(async (req, res) => {
    console.log(req.url, req.headers);
    const time = new URL(req.url!, "http://localhost").searchParams.get("time");
    const result = await getGeoByTimestamp(Number(time));
    console.log("Geo Data:", result);

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      data: result || null,
    }));
  });

  server.listen(33000, () => {
    console.log("Server is running at http://geo-server:33000/");
  });
}

main();