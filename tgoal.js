const puppeteer = require("puppeteer");
const fs = require("fs");

const delay = (ms) => new Promise(r => setTimeout(r, ms));

function toTime(ts) {
  return new Date(ts).toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toThaiDate(ts) {
  const d = new Date(ts);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

(async () => {
  console.log("🚀 FINAL CLICK MODE");

  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],
  });

  const page = await browser.newPage();

  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36"
  );

  await page.goto("https://www.thai-goal.com/livestream/schedule", {
    waitUntil: "networkidle2",
  });

  // 🔥 รอ calendar แบบ retry (กัน CI render ช้า)
  let days = 0;
  for (let i = 0; i < 10; i++) {
    days = await page.$$eval(".flatDateItem", els => els.length);
    console.log("📅 Try:", i + 1, "found:", days);
    if (days > 0) break;
    await delay(2000);
  }

  if (days === 0) {
    throw new Error("❌ Calendar not rendered (CI blocked)");
  }

  const limit = Math.min(days, 5);
  const allDaysData = [];

  for (let i = 0; i < limit; i++) {
    console.log(`👉 Click day ${i + 1}`);

    const responsePromise = page.waitForResponse(res =>
      res.url().includes("/schedule/match") &&
      res.request().method() === "GET"
    , { timeout: 30000 });

    await page.evaluate((index) => {
      document.querySelectorAll(".flatDateItem")[index]?.click();
    }, i);

    const res = await responsePromise;
    const json = await res.json();

    allDaysData.push(json);

    console.log(`✅ GOT DAY ${i + 1}`);
    await delay(2000);
  }

  // =====================
  // BUILD DATA
  // =====================
  const byDay = {};

  for (const day of allDaysData) {
    const leagues = day?.data || [];

    for (const league of leagues) {
      for (const m of league.scheduledLiveStreamMatches || []) {
        const key = toThaiDate(m.matchStartTime);

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

  const playlist = {
    name: `Thai-goal @${new Date().toLocaleDateString("th-TH")}`,
    author: "Thai-goal",
    info: `Thai-goal @${new Date().toLocaleDateString("th-TH")}`,
    image: "https://media.dolive666.cc/bmo/brand/textLogo/1.webp",
    groups: [],
  };

  for (const dayKey of Object.keys(byDay)) {
    playlist.groups.push({
      name: dayKey,
      image: "https://raw.githubusercontent.com/nongakka/wiseplay_index/main/sport1.png",
      stations: byDay[dayKey].map(m => ({
        name: `${toTime(m.time)} ${m.home} vs ${m.away}`,
        info: m.league,
        image: m.logo,
        url: `https://www.thai-goal.com/th/watch-live-football/${m.id}`,
        referer: "https://www.thai-goal.com/",
        userAgent: "Mozilla/5.0",
      })),
    });
  }

  fs.writeFileSync("playlist_tg.json", JSON.stringify(playlist, null, 2));

  console.log("🎉 DONE");
  await browser.close();
})();
