const fs = require("fs");
const { chromium } = require("playwright");

const INPUT_FILE = "ais_channels.json";
const OUTPUT_JSON = "ais_playlist.json";
const OUTPUT_M3U = "ais_playlist.m3u";

const TARGET_URL =
  "https://aisplay.ais.co.th/portal/live/?vid=59592e08bf6aee4e3ecce051";

// ===============================
// GET TOKEN
// ===============================
async function getNewParams() {
  console.log("Starting browser...");

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  let found = null;

  page.on("request", (req) => {
    const url = req.url();

    if (
      url.includes(".m3u8") &&
      url.includes("playbackUrlPrefix=") &&
      !found
    ) {
      found = url.split("?")[1];
      console.log("Captured token");
    }
  });

  try {
    await page.goto(TARGET_URL, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    await page.waitForTimeout(15000);
  } catch (e) {}

  await browser.close();
  return found;
}

// ===============================
// CHECK TL SKIP
// ===============================
function isTLGroup(ch) {
  const id =
    ch.mid ||
    (ch.url ? ch.url.match(/TL00[1-8]/)?.[0] : null);

  return /^TL00[1-8]$/.test(id);
}

function updateStations(data, params) {
  const today = new Date().toLocaleDateString("th-TH");
  data.author = `update ${today}`;

  data.stations = data.stations.map((ch) => {
    // ❌ TL001–TL008 = ห้ามแก้ URL เลย
    if (isTLGroup(ch)) {
      return ch;
    }

    if (ch.url && params) {
      const base = ch.url.split("?")[0];
      ch.url = `${base}?${params}`;
    }

    return ch;
  });

  return data;
}

// ===============================
// WRITE M3U
// ===============================
function generateM3U(data) {
  let m3u = "#EXTM3U\n";

  data.stations.forEach((ch) => {
    m3u += `#EXTINF:-1 group-title="AIS",${ch.name}\n`;
    m3u += `#EXTVLCOPT:http-referrer=${ch.referer || ""}\n`;
    m3u += `${ch.url}\n`;
  });

  fs.writeFileSync(OUTPUT_M3U, m3u, "utf8");
}

// ===============================
// MAIN
// ===============================
async function main() {
  const raw = fs.readFileSync(INPUT_FILE, "utf8");
  const data = JSON.parse(raw);

  const params = await getNewParams();

  const updated = updateStations(data, params);

  // save JSON (new file)
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(updated, null, 2), "utf8");

  // save M3U
  generateM3U(updated);

  console.log("DONE:");
  console.log("- JSON:", OUTPUT_JSON);
  console.log("- M3U :", OUTPUT_M3U);
}

main();