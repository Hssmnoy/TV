const puppeteer = require("puppeteer");
const fs = require("fs");

const delay = (ms) => new Promise(r => setTimeout(r, ms));

// =====================
// เวลา/วัน
// =====================
function toTime(ts) {
  return new Date(ts).toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toThaiDate(ts) {
  const d = new Date(ts);
  const month = [
    "ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.",
    "ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."
  ];
  return `${d.getDate()} ${month[d.getMonth()]}`;
}

(async () => {

  console.log("🚀 START");

  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage"
    ]
  });

  const page = await browser.newPage();

  page.setDefaultTimeout(60000);

  // =====================
  // LOAD PAGE (FIXED)
  // =====================
  await page.goto(
    "https://www.thai-goal.com/livestream/schedule",
    { waitUntil: "domcontentloaded" }
  );

  await delay(8000);

  // =====================
  // RETRY FIND DAYS (CI SAFE)
  // =====================
  let days = 0;

  for (let i = 0; i < 10; i++) {
    days = await page.$$eval(".flatDateItem", els => els.length).catch(() => 0);
    if (days > 0) break;
    await delay(2000);
  }

  if (!days) {
    throw new Error("❌ NO .flatDateItem (CI blocked or render fail)");
  }

  const limit = Math.min(days, 5);
  console.log("📅 Days:", days, "➡️ Using:", limit);

  const allDaysData = [];

  // =====================
  // GLOBAL RESPONSE LISTENER (FIX CORE)
  // =====================
  let lastJson = null;

  page.on("response", async (res) => {
    try {
      if (
        res.url().includes("/schedule/match") &&
        res.request().method() === "GET"
      ) {
        const text = await res.text();
        if (text.startsWith("{")) {
          lastJson = JSON.parse(text);
        }
      }
    } catch {}
  });

  // =====================
  // LOOP DAYS
  // =====================
  for (let i = 0; i < limit; i++) {

    console.log(`👉 DAY ${i + 1}`);

    await page.evaluate((index) => {
      document.querySelectorAll(".flatDateItem")[index]?.click();
    }, i);

    // wait data instead of waitForResponse
    for (let t = 0; t < 40; t++) {
      if (lastJson) break;
      await delay(500);
    }

    if (!lastJson) {
      throw new Error("❌ NO API RESPONSE (CI slow or blocked)");
    }

    allDaysData.push(lastJson);
    lastJson = null;

    await delay(1500);
  }

  // =====================
  // BUILD DATA
  // =====================
  const byDay = {};

  for (const day of allDaysData) {

    const leagues = day?.data || [];

    for (const league of leagues) {

      for (const m of (league.scheduledLiveStreamMatches || [])) {

        const dayKey = toThaiDate(m.matchStartTime);

        if (!byDay[dayKey]) {
          byDay[dayKey] = new Map();
        }

        if (!byDay[dayKey].has(league.leagueId)) {
          byDay[dayKey].set(league.leagueId, {
            name: league.leagueName,
            image: league.leagueLogoUrl,
            matches: []
          });
        }

        byDay[dayKey].get(league.leagueId).matches.push(m);
      }
    }
  }

  // =====================
  // OUTPUT
  // =====================
  const playlist = {
    name: `Thai-goal @${new Date().toLocaleDateString("th-TH")}`,
    author: "Thai-goal",
    info: `Thai-goal @${new Date().toLocaleDateString("th-TH")}`,
    image: "https://media.dolive666.cc/bmo/brand/textLogo/1.webp",
    url: "",
    groups: []
  };

  for (const dayKey of Object.keys(byDay)) {

    const leagueMap = byDay[dayKey];

    const dayGroup = {
      name: dayKey,
      image: "https://raw.githubusercontent.com/nongakka/wiseplay_index/main/sport1.png",
      stations: []
    };

    leagueMap.forEach((league) => {

      league.matches.forEach(m => {

        dayGroup.stations.push({
          name: `${toTime(m.matchStartTime)} ${m.homeTeamName} vs ${m.awayTeamName}`,
          info: league.name,
          image: league.image,
          url: `https://www.thai-goal.com/th/watch-live-football/${m.matchId}`,
          referer: "https://www.thai-goal.com/",
          userAgent: "Mozilla/5.0"
        });

      });

    });

    playlist.groups.push(dayGroup);
  }

  fs.writeFileSync("playlist.json", JSON.stringify(playlist, null, 2));

  console.log("🎉 DONE");
  console.log("📦 Days:", playlist.groups.length);
  console.log("💾 Saved: playlist.json");

  await browser.close();

})();
