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

  console.log("🌐 Starting browser...");

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

  console.log("🔄 Loading page...");

  await page.goto("https://www.thai-goal.com/livestream/schedule", {
    waitUntil: "networkidle2",
    timeout: 60000
  });

  // 🔥 FIX 1: CI ต้องใช้เวลา render มากกว่า PC
  await delay(8000);

  // 🔥 FIX 2: wait selector แบบปลอดภัย
  await page.waitForSelector(".flatDateItem", { timeout: 60000 });

  const days = await page.$$eval(".flatDateItem", els => els.length);
  const limit = Math.min(days, 5);

  console.log("📅 Days:", days, "➡️ Using:", limit);

  const allDaysData = [];

  for (let i = 0; i < limit; i++) {

    console.log(`👉 Clicking day ${i + 1}`);

    // 🔥 FIX 3: เพิ่ม safety wait response
    const waitResponse = page.waitForResponse(res =>
      res.url().includes("/schedule/match") &&
      res.request().method() === "GET",
      { timeout: 30000 }
    );

    await page.evaluate((index) => {
      const els = document.querySelectorAll(".flatDateItem");
      els[index]?.click();
    }, i);

    const res = await waitResponse;
    const json = await res.json();

    allDaysData.push(json);

    console.log(`✅ GOT DAY ${i + 1}`);

    await delay(2000);
  }

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

  console.log("🎉 DONE!");
  console.log("📦 Days:", playlist.groups.length);
  console.log("💾 Saved: playlist.json");

  await browser.close();

})();
