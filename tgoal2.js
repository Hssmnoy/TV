const puppeteer = require("puppeteer");
const fs = require("fs");

// =====================
// CONFIG
// =====================
const BASE_URL =
  "https://api.dolive666.cc/v2/liveStream/schedule/match";

const NOTIFICATION_ID =
  "824cd204-0208-42c5-be43-4ff4d9afcc71";

// =====================
// DATE
// =====================
function getDate(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split("T")[0] + "T00:00:00+07:00";
}

// =====================
// STEP 1: GET TOKEN (PUPPETEER ONLY ONCE)
// =====================
async function getAuthFromBrowser() {
  console.log("🔐 Getting auth...");

  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],
  });

  const page = await browser.newPage();

  let token = null;

  // ดัก request headers จริงจากเว็บ
  page.on("request", (req) => {
    const h = req.headers();
    if (h.authorization && h.authorization.includes("Bearer")) {
      token = h.authorization;
    }
  });

  await page.goto(
    "https://www.thai-goal.com/livestream/schedule",
    { waitUntil: "networkidle2" }
  );

  await new Promise(r => setTimeout(r, 5000));

  await browser.close();

  if (!token) {
    throw new Error("❌ NO TOKEN FOUND");
  }

  console.log("✅ TOKEN OK");
  return token;
}

// =====================
// STEP 2: FETCH API
// =====================
async function fetchSchedule(date, token) {
  const url = `${BASE_URL}?languageId=3&notificationId=${NOTIFICATION_ID}&currentDate=${encodeURIComponent(
    date
  )}&sportIds=0&sportIds=1&hasMatchHighlight=true&hasFavourite=true`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      authorization: token,
      accept: "application/json, text/plain, */*",
      origin: "https://www.thai-goal.com",
      referer: "https://www.thai-goal.com/",
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122 Safari/537.36",
    },
  });

  const text = await res.text();

  if (!text.startsWith("{")) {
    console.log("❌ RAW RESPONSE:", text.slice(0, 200));
    throw new Error("❌ API BLOCKED");
  }

  return JSON.parse(text);
}

// =====================
// MAIN
// =====================
(async () => {
  try {
    console.log("🚀 START HYBRID PRODUCTION");

    const token = await getAuthFromBrowser();

    const daysToFetch = 5;
    const all = [];

    for (let i = 0; i < daysToFetch; i++) {
      const date = getDate(i);
      console.log("📅 Fetch:", date);

      const data = await fetchSchedule(date, token);
      all.push(data);
    }

    // =====================
    // BUILD OUTPUT
    // =====================
    const byDay = {};

    for (const day of all) {
      const leagues = day?.data || [];

      for (const league of leagues) {
        for (const m of league.scheduledLiveStreamMatches || []) {
          const d = new Date(m.matchStartTime);
          const key = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;

          if (!byDay[key]) byDay[key] = [];

          byDay[key].push({
            time: m.matchStartTime,
            home: m.homeTeamName,
            away: m.awayTeamName,
            league: league.leagueName,
            logo: league.leagueLogoUrl,
            id: m.matchId,
          });
        }
      }
    }

    // =====================
    // FORMAT OUTPUT (same style)
    // =====================
    const playlist = {
      name: `Thai-goal @${new Date().toLocaleDateString("th-TH")}`,
      author: "Thai-goal",
      info: `Thai-goal @${new Date().toLocaleDateString("th-TH")}`,
      image: "https://media.dolive666.cc/bmo/brand/textLogo/1.webp",
      url: "",
      groups: [],
    };

    for (const dayKey of Object.keys(byDay)) {
      const group = {
        name: dayKey,
        image: "https://raw.githubusercontent.com/nongakka/wiseplay_index/main/sport1.png",
        stations: [],
      };

      for (const m of byDay[dayKey]) {
        const t = new Date(m.time).toLocaleTimeString("th-TH", {
          hour: "2-digit",
          minute: "2-digit",
        });

        group.stations.push({
          name: `${t} ${m.home} vs ${m.away}`,
          info: m.league,
          image: m.logo,
          url: `https://www.thai-goal.com/th/watch-live-football/${m.id}`,
          referer: "https://www.thai-goal.com/",
          userAgent: "Mozilla/5.0",
        });
      }

      playlist.groups.push(group);
    }

    fs.writeFileSync(
      "tgoal_playlist.json",
      JSON.stringify(playlist, null, 2)
    );

    console.log("🎉 DONE");
    console.log("📦 Days:", playlist.groups.length);
    console.log("💾 Saved: tgoal_playlist.json");
  } catch (err) {
    console.error("❌ ERROR:", err.message);
  }
})();