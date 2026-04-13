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
  const month = [
    "ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.",
    "ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."
  ];
  return `${d.getDate()} ${month[d.getMonth()]}`;
}

(async () => {
  let browser;

  try {
    console.log("🚀 Start browser...");

    browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-blink-features=AutomationControlled"
      ]
    });

    const page = await browser.newPage();

    // =========================
    // 🧠 ANTI BOT DETECTION
    // =========================
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    );

    await page.setViewport({ width: 1366, height: 768 });

    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", {
        get: () => false,
      });
    });

    console.log("🌐 Loading page...");

    await page.goto("https://www.thai-goal.com/livestream/schedule", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    // =========================
    // 🔥 WAIT FOR RENDER (SAFE)
    // =========================
    await delay(10000);

    console.log("🔍 Checking calendar...");

    // 🔥 retry loop แทน waitForSelector
    let days = 0;

    for (let i = 0; i < 5; i++) {
      days = await page.evaluate(() => {
        return document.querySelectorAll("[class*='flat'], [class*='date']").length;
      });

      console.log(`📅 Try ${i + 1}: found ${days}`);

      if (days > 0) break;

      await delay(3000);
    }

    // =========================
    // ❌ NO DATA → DEBUG MODE
    // =========================
    if (!days || days === 0) {
      console.log("❌ Calendar not found → saving debug.html");

      const html = await page.content();
      fs.writeFileSync("debug.html", html);

      throw new Error("Calendar not rendered in CI (bot detected or layout changed)");
    }

    const limit = Math.min(days, 5);

    console.log("📅 Using days:", limit);

    const allDaysData = [];

    for (let i = 0; i < limit; i++) {

      console.log(`👉 Click day ${i + 1}`);

      let json = null;

      try {
        const waitResponse = page.waitForResponse(res =>
          res.url().includes("/schedule/match") &&
          res.request().method() === "GET"
        , { timeout: 20000 });

        await page.evaluate((index) => {
          const els = document.querySelectorAll("[class*='flat'], [class*='date']");
          els[index]?.click();
        }, i);

        const res = await waitResponse;
        json = await res.json();

        console.log("✅ API OK");

      } catch (err) {
        console.log("⚠️ Fallback DOM mode");

        json = await page.evaluate(() => {
          return { data: [] };
        });
      }

      allDaysData.push(json);

      await delay(2000);
    }

    // =========================
    // BUILD DATA
    // =========================
    const byDay = {};

    for (const day of allDaysData) {
      const leagues = day?.data || [];

      for (const league of leagues) {
        for (const m of (league.scheduledLiveStreamMatches || [])) {

          const dayKey = toThaiDate(m.matchStartTime);

          if (!byDay[dayKey]) byDay[dayKey] = new Map();

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

    // =========================
    // OUTPUT
    // =========================
    const playlist = {
      name: `Thai-goal @${new Date().toLocaleDateString("th-TH")}`,
      author: "Thai-goal",
      groups: []
    };

    for (const dayKey of Object.keys(byDay)) {

      const leagueMap = byDay[dayKey];

      const group = {
        name: dayKey,
        stations: []
      };

      leagueMap.forEach((league) => {
        league.matches.forEach(m => {
          group.stations.push({
            name: `${toTime(m.matchStartTime)} ${m.homeTeamName} vs ${m.awayTeamName}`,
            info: league.name,
            image: league.image,
            url: `https://www.thai-goal.com/th/watch-live-football/${m.matchId}`,
            referer: "https://www.thai-goal.com/",
            userAgent: "Mozilla/5.0"
          });
        });
      });

      playlist.groups.push(group);
    }

    fs.writeFileSync("tgoal.json", JSON.stringify(playlist, null, 2));

    console.log("🎉 DONE!");
    console.log("📦 Groups:", playlist.groups.length);

  } catch (err) {
    console.error("❌ ERROR:", err);
    process.exit(1);

  } finally {
    if (browser) await browser.close();
  }
})();
