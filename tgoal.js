const puppeteer = require("puppeteer");
const fs = require("fs");

// =====================
// DATE
// =====================
function getDate(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split("T")[0] + "T00:00:00+07:00";
}

// =====================
// MAIN
// =====================
(async () => {
  console.log("🚀 START FINAL STABLE VERSION");

  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],
  });

  const page = await browser.newPage();

  // สำคัญ: ต้องเปิดเว็บก่อนเพื่อให้ session + cloudflare ผ่าน
  console.log("🌐 Loading main page...");
  await page.goto("https://www.thai-goal.com/livestream/schedule", {
    waitUntil: "networkidle2",
  });

  const all = [];

  const daysToFetch = 5;

  for (let i = 0; i < daysToFetch; i++) {
    const date = getDate(i);

    console.log("📅 Fetch:", date);

    // 🔥 ยิง API จาก browser context (ใช้ session จริง)
    const data = await page.evaluate(async (date) => {
      const url =
        "https://api.dolive666.cc/v2/liveStream/schedule/match" +
        "?languageId=3" +
        "&notificationId=824cd204-0208-42c5-be43-4ff4d9afcc71" +
        "&currentDate=" +
        encodeURIComponent(date) +
        "&sportIds=0&sportIds=1" +
        "&hasMatchHighlight=true&hasFavourite=true";

      const res = await fetch(url, {
        credentials: "include",
        headers: {
          accept: "application/json",
        },
      });

      return await res.json();
    }, date);

    all.push(data);
  }

  // =====================
  // BUILD DATA
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
  // OUTPUT FORMAT
  // =====================
  const playlist = {
    name: `Thai-goal @${new Date().toLocaleDateString("th-TH")}`,
    author: "Thai-goal",
    info: `Thai-goal @${new Date().toLocaleDateString("th-TH")}`,
    image:
      "https://media.dolive666.cc/bmo/brand/textLogo/1.webp",
    groups: [],
  };

  for (const dayKey of Object.keys(byDay)) {
    const group = {
      name: dayKey,
      image:
        "https://raw.githubusercontent.com/nongakka/wiseplay_index/main/sport1.png",
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

  fs.writeFileSync("playlist.json", JSON.stringify(playlist, null, 2));

  console.log("🎉 DONE");
  console.log("📦 Days:", playlist.groups.length);
  console.log("💾 Saved: playlist.json");

  await browser.close();
})();
