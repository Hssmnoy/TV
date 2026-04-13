const puppeteer = require("puppeteer");
const fs = require("fs");

function getDate(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split("T")[0] + "T00:00:00+07:00";
}

(async () => {
  console.log("🚀 FINAL NETWORK MODE");

  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],
  });

  const page = await browser.newPage();

  await page.goto("https://www.thai-goal.com/livestream/schedule", {
    waitUntil: "networkidle2",
  });

  const results = [];

  for (let i = 0; i < 5; i++) {
    const date = getDate(i);

    console.log("📅 Fetch:", date);

    const data = await new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("timeout"));
      }, 30000);

      const listener = async (response) => {
        try {
          const url = response.url();

          if (
            url.includes("/schedule/match") &&
            url.includes("currentDate=" + encodeURIComponent(date).split("%")[0])
          ) {
            const json = await response.json();
            page.off("response", listener);
            clearTimeout(timeout);
            resolve(json);
          }
        } catch (e) {}
      };

      page.on("response", listener);

      // trigger request
      await page.evaluate((d) => {
        window.__DATE__ = d;
        location.reload();
      }, date);
    });

    results.push(data);
  }

  // =====================
  // BUILD OUTPUT
  // =====================
  const byDay = {};

  for (const day of results) {
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

  const playlist = {
    name: `Thai-goal @${new Date().toLocaleDateString("th-TH")}`,
    author: "Thai-goal",
    info: `Thai-goal @${new Date().toLocaleDateString("th-TH")}`,
    image:
      "https://media.dolive666.cc/bmo/brand/textLogo/1.webp",
    groups: [],
  };

  for (const dayKey of Object.keys(byDay)) {
    playlist.groups.push({
      name: dayKey,
      image:
        "https://raw.githubusercontent.com/nongakka/wiseplay_index/main/sport1.png",
      stations: byDay[dayKey].map((m) => ({
        name: `${new Date(m.time).toLocaleTimeString("th-TH", {
          hour: "2-digit",
          minute: "2-digit",
        })} ${m.home} vs ${m.away}`,
        info: m.league,
        image: m.logo,
        url: `https://www.thai-goal.com/th/watch-live-football/${m.id}`,
        referer: "https://www.thai-goal.com/",
        userAgent: "Mozilla/5.0",
      })),
    });
  }

  fs.writeFileSync("playlist_tgoal.json", JSON.stringify(playlist, null, 2));

  console.log("🎉 DONE");
  await browser.close();
})();
