const puppeteer = require("puppeteer");
const fs = require("fs");

function formatDate(date) {
  return date.toISOString().split("T")[0];
}

function displayDate(date) {
  return date.toLocaleDateString("en-GB");
}

function thaiDate(date) {
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear() + 543}`;
}

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();

  const groups = [];

  for (let i = 0; i < 3; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);

    const url = `https://www.siamsport.co.th/football-program/${formatDate(date)}/`;
    console.log("📅", url);

    await page.goto(url, { waitUntil: "domcontentloaded" });

    const stations = await page.evaluate(() => {
      const result = [];

      document.querySelectorAll(".bg-light").forEach(section => {
        const league = section.querySelector("h5")?.innerText.trim();
        if (!league) return;

        section.querySelectorAll('[id^="match-"]').forEach(match => {
          const time = match.querySelector(".col-2 span")?.innerText.trim();
          const home = match.querySelector(".col-5:first-child span")?.innerText.trim();
          const away = match.querySelector(".col-5:last-child span")?.innerText.trim();

          // 🔴 ดึงช่องถ่ายทอด
          const channel = match.querySelector(".badge")?.innerText.trim();

          if (time && home && away) {
            // 🔥 รวม channel เข้า info
            const infoText = channel
              ? `${league} | ${channel}`
              : league;

            result.push({
              name: `${time} ${home} vs ${away}`,
              info: infoText,
              image: "https://cdn.sportnanoapi.com/football/competition/bbe73e02dfd0737b98d16465ae014d9e.png",
              url: "",
              referer: "https://www.siamsport.co.th/",
              userAgent: "Mozilla/5.0"
            });
          }
        });
      });

      return result;
    });

    if (stations.length > 0) {
      groups.push({
        name: displayDate(date),
        image: "https://raw.githubusercontent.com/nongakka/wiseplay_index/main/sport1.png",
        stations
      });
    }
  }

  const playlist = {
    name: `Siamsport.co.th @${thaiDate(new Date())}`,
    author: "Siamsport.co.th",
    info: "อัพเดต รายการแข่งขัน",
    image: "https://www.siamsport.co.th/_astro/logo-pink.DmcNsiwb.png",
    groups
  };

  fs.writeFileSync("playlist_siam.json", JSON.stringify(playlist, null, 2));

  console.log("✅ รวม channel ใน info เรียบร้อย");

  await browser.close();
})();