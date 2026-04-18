const axios = require("axios");
const fs = require("fs-extra");
const puppeteer = require("puppeteer");
const cheerio = require("cheerio");

// ================= CONFIG =================
const PROG_URL = "https://sportsonline.vc/prog.txt";

const SAVE_DIR = "playlist";
const SAVE_FILE = `${SAVE_DIR}/sportsonline.json`;

const HEADER_IMAGE = "https://img2.pic.in.th/Gemini_Generated_Image_6jd8dr6jd8dr6jd8-1.md.png";
const GROUP_IMAGE = "https://img1.pic.in.th/images/ChatGPT-Image-8-..-2569-16_53_16.md.png";
const DEFAULT_MATCH_IMAGE = GROUP_IMAGE;

// ================= FIX ENCODING =================
function fixEncoding(str = "") {
  try {
    return Buffer.from(str, "latin1").toString("utf8").replace(/\uFFFD/g, "").trim();
  } catch {
    return str;
  }
}

// ================= DATA =================
let besoccer_db = {};

const OTHER_SPORTS_KEYWORDS = {
  Tennis: "Tennis",
  ATP: "Tennis",
  WTA: "Tennis",
  NBA: "Basketball",
  Basketball: "Basketball",
  "Formula 1": "F1",
  F1: "F1",
  MotoGP: "MotoGP",
  UFC: "UFC",
  Boxing: "Boxing",
  NFL: "NFL",
  Snooker: "Snooker",
  Badminton: "Badminton",
  Volleyball: "Volleyball"
};

const DAY_NAME_MAP = {
  MONDAY: 0,
  TUESDAY: 1,
  WEDNESDAY: 2,
  THURSDAY: 3,
  FRIDAY: 4,
  SATURDAY: 5,
  SUNDAY: 6
};

// ================= HELPERS =================
function extractChannelName(url) {
  try {
    return url.split("/").pop().split(".")[0];
  } catch {
    return "";
  }
}

function getBaseDateFromDayname(dayName) {
  const today = new Date();
  const todayIdx = today.getDay() === 0 ? 6 : today.getDay() - 1;

  const targetIdx = DAY_NAME_MAP[dayName];
  if (targetIdx === undefined) return null;

  let diff = targetIdx - todayIdx;
  if (diff > 3) diff -= 7;
  else if (diff < -3) diff += 7;

  const d = new Date();
  d.setDate(today.getDate() + diff);
  return d;
}

// ================= STEP 1 =================
async function processAndFetchDates(text) {
  const lines = text.split("\n");

  let datesToScrape = new Set();
  let processedMatches = [];

  let currentBaseDate = null;
  let lastTime = null;
  let offsetDays = 0;

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    const day = line.toUpperCase();
    if (DAY_NAME_MAP[day] !== undefined) {
      currentBaseDate = getBaseDateFromDayname(day);
      lastTime = null;
      offsetDays = 0;
      continue;
    }

    const match = line.match(/(\d{2}:\d{2})\s+(.*?)\s+\|\s+(https?:\/\/\S+)/);
    if (match && currentBaseDate) {
      let [, timeStr, title, url] = match;

      title = fixEncoding(title);

      if (lastTime && timeStr < lastTime) offsetDays++;
      lastTime = timeStr;

      const matchDate = new Date(currentBaseDate);
      matchDate.setDate(matchDate.getDate() + offsetDays);

      const [h, m] = timeStr.split(":");
      const dt = new Date(matchDate);
      dt.setHours(h, m);

      const thai = new Date(dt.getTime() + 6 * 60 * 60 * 1000);

      const dateKey = thai.toISOString().split("T")[0];
      datesToScrape.add(dateKey);

      processedMatches.push({
        thai_datetime: thai,
        time_show: thai.toTimeString().slice(0, 5),
        title,
        url,
        channel: extractChannelName(url)
      });
    }
  }

  return {
    dates: [...datesToScrape].sort(),
    matches: processedMatches
  };
}

// ================= STEP 2 =================
async function fetchBeSoccer(dates) {
  if (!dates.length) return;

  console.log("📡 Fetch BeSoccer...");

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const page = await browser.newPage();

  try {
    for (const date of dates) {
      try {
        const url = `https://www.besoccer.com/livescore/${date}`;

        await page.goto(url, {
          waitUntil: "networkidle2",
          timeout: 60000
        });

        await new Promise(r => setTimeout(r, 3000));

        const html = await page.content();
        const $ = cheerio.load(html);

        $(".match-link").each((_, el) => {
          try {
            const script = $(el).find('script[type="application/ld+json"]').html();
            if (!script) return;

            const js = JSON.parse(script);

            const league = fixEncoding(js?.location?.competitionName || "");
            const home = fixEncoding(js?.competitor?.[0]?.name || "").toLowerCase();
            const away = fixEncoding(js?.competitor?.[1]?.name || "").toLowerCase();

            const img = $(el).find(".team-info.ta-r img").attr("src") || DEFAULT_MATCH_IMAGE;
            const logo = img.startsWith("//") ? "https:" + img : img;

            const matchInfo = {
              league,
              logo: logo + "?size=120x&lossy=1"
            };

            besoccer_db[home] = matchInfo;
            besoccer_db[away] = matchInfo;
          } catch {}
        });

      } catch (e) {
        console.log("⚠️ skip date:", date, e.message);
      }
    }
  } finally {
    await browser.close();
  }
}

// ================= STEP 3 =================
function getMatchDetails(title) {
  let clean = fixEncoding(title)
    .replace(" x ", " vs ")
    .replace("|", "")
    .replace(/\d{2}:\d{2}/g, "")
    .trim();

  for (const k in OTHER_SPORTS_KEYWORDS) {
    if (clean.toLowerCase().includes(k.toLowerCase())) {
      return [OTHER_SPORTS_KEYWORDS[k], DEFAULT_MATCH_IMAGE];
    }
  }

  const teams = clean.split(" vs ");

  for (const t of teams) {
    const key = t.trim().toLowerCase();
    if (besoccer_db[key]) {
      return [besoccer_db[key].league, besoccer_db[key].logo];
    }
  }

  return ["", DEFAULT_MATCH_IMAGE];
}

// ================= STEP 4 =================
function generateJSON(matches) {
  const groups = {};

  for (const item of matches) {
    const d = new Date(item.thai_datetime);
    const key = d.toISOString().split("T")[0];

    const year = d.getFullYear() + 543;
    const groupName = `วันที่ ${d.getDate()}/${d.getMonth() + 1}/${year}`;

    if (!groups[key]) {
      groups[key] = {
  	name: groupName,
  	date: key,
  	image: GROUP_IMAGE,
  	stations: []
	};
    }

    const [league, logo] = getMatchDetails(item.title);
const info = extractInfoFromUrl(item.url); // ⭐ สำคัญ

groups[key].stations.push({
  name: `${item.time_show} ${item.title
  .replace(" x ", " vs ")
  .replace(/\s+/g, " ")
  .trim()}`,
  image: logo,
  url: item.url,
  referer: "https://sportsonline.vc/",
  info: info, // ⭐ ดึงจาก URL จริง
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
});
  }

  const now = new Date();

// format วัน/เดือน/ปี (ไทย)
const dd = now.getDate();
const mm = now.getMonth() + 1;
const yyyy = now.getFullYear() + 543;

const dateText = `${dd}/${mm}/${yyyy}`;

return {
  name: `Sportsonline.vc update @${dateText}`,
  author: `Update@${dateText}`,
  info: `sportsonline.vc Update@${dateText}`,
  image: HEADER_IMAGE,
  url: "https://raw.githubusercontent.com/Hssmnoy/TV/main/playlist/sportsonline.json",
  groups: Object.values(groups)
};
}

function extractInfoFromUrl(url = "") {
  try {
    const cleanUrl = url.split("?")[0];
    const parts = cleanUrl.split("/");

    const file = parts[parts.length - 1] || "";

return file
  .split("?")[0]
  .replace(".php", "")
  .replace(".html", "");   
  } catch {
    return "";
  }
}

// ================= MAIN =================
(async () => {
  try {
    console.log("🚀 START");

    const res = await axios.get(PROG_URL, { timeout: 15000 });

    const { dates, matches } = await processAndFetchDates(res.data);

    await fetchBeSoccer(dates);

    const output = generateJSON(matches);

    await fs.ensureDir(SAVE_DIR);
    await fs.writeJson(SAVE_FILE, output, { spaces: 2 });

    console.log("💾 saved:", SAVE_FILE);
    console.log("✅ DONE");
  } catch (err) {
    console.error("❌ ERROR:", err.message);
  }
})();
