const fs = require("fs");

const delay = (ms) => new Promise(r => setTimeout(r, ms));

async function fetchJSON(url) {
  const res = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36",
      "referer": "https://www.thai-goal.com/"
    }
  });

  return res.json();
}

function toTime(ts) {
  return new Date(ts).toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toThaiDate(ts) {
  const d = new Date(ts);
  const m = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
  return `${d.getDate()} ${m[d.getMonth()]}`;
}

(async () => {
  try {
    console.log("🚀 Fetching schedule API...");

    // 🔥 ดึง main API ตรง (ไม่ใช้ Puppeteer แล้ว)
    const data = await fetchJSON(
      "https://www.thai-goal.com/api/schedule/match"
    );

    const byDay = {};

    const leagues = data?.data || [];

    for (const league of leagues) {
      for (const m of league.scheduledLiveStreamMatches || []) {

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

    const playlist = {
      name: `Thai-goal @${new Date().toLocaleDateString("th-TH")}`,
      author: "Thai-goal",
      groups: []
    };

    for (const dayKey of Object.keys(byDay)) {

      const group = {
        name: dayKey,
        stations: []
      };

      byDay[dayKey].forEach((league) => {
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

    console.log("🎉 DONE");
    console.log("📦 Groups:", playlist.groups.length);

  } catch (err) {
    console.error("❌ ERROR:", err);
  }
})();
