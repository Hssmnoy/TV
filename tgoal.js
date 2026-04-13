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
    console.log("🌐 Starting browser...");

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
    page.setDefaultTimeout(60000);

    console.log("🔄 Loading page...");

    await page.goto(
      "https://www.thai-goal.com/livestream/schedule",
      { waitUntil: "domcontentloaded" }
    );

    // 🔥 สำคัญมาก: ให้ JS render เสร็จก่อน
    await delay(8000);

    console.log("⏳ Waiting for calendar...");

    await page.waitForSelector(".flatDateItem", {
      timeout: 60000
    });

    const days = await page.evaluate(() =>
      document.querySelectorAll(".flatDateItem").length
    );

    console.log("📅 Days found:", days);

    const limit = Math.min(days, 5);
    const allDaysData = [];

    for (let i = 0; i < limit; i++) {

      console.log(`👉 Clicking day ${i + 1}`);

      let json = null;

      try {
        const waitResponse = page.waitForResponse(res =>
          res.url().includes("/schedule/match") &&
          res.request().method() === "GET"
        , { timeout: 20000 });

        await page.evaluate((index) => {
          const els = document.querySelectorAll(".flatDateItem");
          els[index]?.click();
        }, i);

        const res = await waitResponse;
        json = await res.json();

      } catch (err) {
        console.log("⚠️ API not captured, fallback DOM extract");

        json = await page.evaluate(() => {
          return { data: [] };
        });
      }

      allDaysData.push(json);

      await delay(1500);
    }

    // ===============================
    // BUILD DATA
    // ===============================
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

    // ===============================
    // OUTPUT
    // ===============================
    const playlist = {
      name: `Thai-goal @${new Date().toLocaleDateString("th-TH")}`,
      author: "Thai-goal",
      info: "auto scraper",
      image: "https://media.dolive666.cc/bmo/brand/textLogo/1.webp",
      groups: []
    };

    for (const dayKey of Object.keys(byDay)) {

      const leagueMap = byDay[dayKey];

      const group = {
        name: dayKey,
        image: "https://raw.githubusercontent.com/nongakka/wiseplay_index/main/sport1.png",
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
    console.error("❌ Fatal error:", err);
    process.exit(1);

  } finally {
    if (browser) await browser.close();
  }
})();
