const { chromium } = require("playwright");
const axios = require("axios");
const fs = require("fs");

const OUTPUT_FILE = "ais_playlist.json";

// =======================
// 🔥 STEP 1: ดึงช่องจาก API
// =======================
async function getAllChannelsFromAPI() {
  console.log("📡 โหลดรายการช่อง...");

  const res = await axios.get(
    "https://raw.githubusercontent.com/Hssmnoy/TV/main/ais_channels.json"  
  );

   //https://web-tls.ais-vidnt.com/get_section/5b403fa4d817de591a0afffe/?d=gstweb
   //https://raw.githubusercontent.com/Hssmnoy/TV/main/ais_channels.json
   //https://web-sila.ais-vidnt.com/get_channels/

  const items = res.data.items || [];

  const channels = items
    .filter(c => !c.not_free) // 🔥 ตัดช่องเสียเงินออก
    .map(c => ({
      vid: c.id,
      name: c.title,
      logo: c.poster,
    }));

  console.log("✅ เจอ", channels.length, "ช่อง");

  return channels;
}

// =======================
// 🔥 STEP 2: ดึง m3u8
// =======================
async function getParamsForChannel(page, vid) {
  const url = `https://aisplay.ais.co.th/portal/live/?vid=${vid}`;

  return new Promise(async (resolve) => {
    let done = false;

    const handler = (request) => {
      const reqUrl = request.url();

      if (!done && reqUrl.includes(".m3u8")) {
        done = true;

        const base = reqUrl.split("?")[0];
        const params = reqUrl.split("?")[1];

        page.off("request", handler);

        resolve({ base, params });
      }
    };

    page.on("request", handler);

    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });

      // กด guest
      try {
        await page.click("button.login-type-btn.guest", { timeout: 5000 });
      } catch {}

      // กดยอมรับ
      try {
        await page.click("button.accept-btn", { timeout: 5000 });
      } catch {}

      // 🔥 รอ video โหลดก่อน
await page.waitForSelector("video", { timeout: 15000 });

// 🔥 บังคับเล่นแบบ browser จริง
await page.evaluate(() => {
  const v = document.querySelector("video");
  if (v) {
    v.muted = true;
    v.play().catch(() => {});
  }
});

// 🔥 รอให้มันยิง m3u8 (สำคัญ)
await page.waitForTimeout(8000);

      // fallback timeout
      setTimeout(() => {
        if (!done) {
          page.off("request", handler);
          resolve(null);
        }
      }, 25000);

    } catch {
      resolve(null);
    }
  });
}

// =======================
// 🔥 STEP 3: ดึงทุกช่อง
// =======================
async function getAllStreams(channels) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  const results = [];

  for (const ch of channels) {
    const page = await context.newPage();

    console.log("📺", ch.name);

    const stream = await getParamsForChannel(page, ch.vid);

    if (stream) {
      console.log("✅ OK");

      results.push({
  	name: ch.name,
  	vid: ch.vid,
  	logo: ch.logo,

  	// 🔥 m3u8
  	m3u8: stream ? `${stream.base}?${stream.params}` : "",

  	// 🔥 web
  	web: `https://aisplay.ais.co.th/portal/live?vid=${ch.vid}`
	});

    } else {
      console.log("❌ ไม่มี stream");
    }

    await page.close();
    await new Promise(r => setTimeout(r, 2000)); // กัน block
  }

  await browser.close();
  return results;
}

// =======================
// 🔥 STEP 4: save playlist
// =======================
function savePlaylists(data) {
  const today = new Date().toLocaleDateString("th-TH");

  // =====================
  // 🔥 ไฟล์ m3u8
  // =====================
  const m3u8List = {
    name: "AIS (M3U8)",
    author: "update " + today,
    image: "https://aisplay.ais.co.th/portal/static/img/ais_play.e9f424a5.png",
    url: "https://raw.githubusercontent.com/Hssmnoy/TV/main/ais_playlist.json",
    stations: data
      .filter(ch => ch.m3u8)
      .map(ch => ({
        name: ch.name,
        image: ch.logo,
        url: ch.m3u8,
        referer: "https://49-231-34-108-rewriter.ais-vidnt.com/",
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.81 Safari/537.36 Maxthon/5.3.8.2000",
        playInNatPlayer: "true"
      }))
  };

  fs.writeFileSync("ais_playlist.json", JSON.stringify(m3u8List, null, 2));

  // =====================
  // 🔥 ไฟล์ web
  // =====================
  const webList = {
    name: "AIS (WEB)",
    author: "update " + today,
    image: "https://aisplay.ais.co.th/portal/static/img/ais_play.e9f424a5.png",
    url: "https://raw.githubusercontent.com/Hssmnoy/TV/main/ais_playlist_web.json",
    stations: data.map(ch => ({
      name: ch.name,
      image: ch.logo,
      url: ch.web,
      referer: "https://49-231-34-108-rewriter.ais-vidnt.com/",
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.81 Safari/537.36 Maxthon/5.3.8.2000",
      playInNatPlayer: "true"
    }))
  };

  fs.writeFileSync("ais_playlist_web.json", JSON.stringify(webList, null, 2));

  console.log("💾 saved: ais_playlist.json (m3u8)");
  console.log("💾 saved: ais_playlist_web.json (web)");
}
// =======================
// 🚀 MAIN
// =======================
(async () => {
  console.log("🚀 START\n");

  const channels = await getAllChannelsFromAPI();

  const streams = await getAllStreams(channels);

  if (!streams.length) {
    console.log("❌ ไม่มีข้อมูล");
    return;
  }

  savePlaylists(streams);

  console.log("\n✅ DONE:", streams.length, "channels");
})();
