// scan-ais-vmaster.js
// ใช้ Node.js 18+
// สแกน V0001 - V0300 แล้วสร้าง:
// 1. ais_vmaster.m3u
// 2. found_vseries.json

const fs = require("fs");

const TOKEN = `playbackUrlPrefix=https%3A%2F%2Ftr.play-rbcdn.ais.co.th%3A8438%2F&originBasicUrl=http%3A%2F%2Fpl-origin.ais-vidnt.com%2Fais%2Fplay%2Fanevia&tt=5b25305514a9b47818e186e52cc60e15&chunkHttps=true&tmid=B0003&tpbk=mCLVIA8zj33FqRdU&rrt=1776855597&tmod=rfk&rsid=13283f5f-b357-4d7a-97d2-d1a5dd30c2b6&tuid=21493167bf&cdn=redfox-https&tdid=fb7613941267b2a1b2e25bcec35cd769&origin=anevia&tfa=f0-fc&tttl=1776941997`;

const BASE =
  "https://49-231-37-37-rewriter.ais-vidnt.com/ais/play/anevia/live/eds";

const KNOWN = {
  V0104: "Boomerang",
  V0130: "Golf HD+",
  V0140: "ALjAZEERA",
  V0141: "RTS",
  V0151: "Samrujlok",
  V0152: "MySCI",
  V0153: "Animal Show",
  V0154: "Khong Dee",
  V0155: "Thainess"
};

function makeId(n) {
  return "BL" + String(n).padStart(3, "0");
}

function makeUrl(id) {
  return `${BASE}/${id}/HLS/${id}.m3u8?${TOKEN}`;
}

async function check(id) {
  const url = makeUrl(id);

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 14_4_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1",
        "Referer": "https://ais-vidnt.com/"
      }
    });

    if (res.status !== 200) return null;

    const text = await res.text();

    return {
      id,
      status: 200,
      contentType: res.headers.get("content-type") || "",
      name: KNOWN[id] || id,
      url,
      sample: text.split("\n").slice(0, 3).join(" | ")
    };

  } catch {
    return null;
  }
}

async function main() {
  const found = [];

  console.log("Scanning channels");

  for (let i = 1; i <= 300; i++) {
    const id = makeId(i);

    const data = await check(id);

    if (data) {
      found.push(data);
      console.log(id, "OK");
    }
  }

  // save json
  fs.writeFileSync(
    "found_vseries.json",
    JSON.stringify(found, null, 2),
    "utf8"
  );

  // build m3u
  let m3u = "#EXTM3U\n";

  for (const item of found) {
    m3u += `#EXTINF:-1 tvg-id="${item.id}.th" group-title="AIS V-Master",${item.name}\n`;
    m3u += `#EXTVLCOPT:http-referrer=https://ais-vidnt.com/\n`;
    m3u += `${item.url}\n`;
  }

  fs.writeFileSync("ais_scan.m3u", m3u, "utf8");

  console.log("\nDone");
  console.log("Found:", found.length);
  console.log("Saved:");
  console.log("- found_vseries.json");
  console.log("- ais_vmaster.m3u");
}

main();