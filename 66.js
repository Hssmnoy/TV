const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");

const URL = "https://embed-xs.bananacake.org/dooball66v2/schedule.html";

async function run() {
    try {
        const { data } = await axios.get(URL, {
            headers: {
                "User-Agent": "Mozilla/5.0"
            }
        });

        const $ = cheerio.load(data);

        let stations = [];

        $(".match-live").each((i, el) => {
            const time = $(el).find(".col-1").first().text().trim();

            let teams = [];
            $(el).find("span").each((i, s) => {
                const t = $(s).text().trim();
                if (t) teams.push(t);
            });

            const link = $(el).find("a[href*='match_id']").first().attr("href");
            const matchUrl = link || "";
            const matchId = matchUrl.match(/match_id=(\d+)/)?.[1] || "";

            if (!time || teams.length < 2) return;

            stations.push({
                name: `${time} ${teams[0]} vs ${teams[1]}`,
                info: "Dooball66 Match",
                image: "https://dooball66ae.com/wp-content/uploads/2020/07/cropped-logo.png",
                url: matchUrl,
                referer: "https://dooball66ae.com/",
                userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
            });
        });

        const playlist = {
            name: `Dooball66 update @${new Date().toLocaleDateString("th-TH")}`,
            author: `Update@${new Date().toLocaleDateString("th-TH")}`,
            info: `Dooball66 Auto Update`,
            url: "https://raw.githubusercontent.com/Hssmnoy/TV/main/Dooball66.json",
            image: "https://dooball66ae.com/wp-content/uploads/2020/07/cropped-logo.png",
            groups: [
                {
                    name: `วันที่ ${new Date().toLocaleDateString("th-TH")}`,
                    image: "https://dooball66ae.com/wp-content/uploads/2020/07/cropped-logo.png",
                    stations
                }
            ]
        };

        fs.writeFileSync("Dooball66.json", JSON.stringify(playlist, null, 2));

        console.log("✅ สร้างไฟล์ Dooball66.json เรียบร้อยแล้ว");
        console.log("📌 จำนวนแมตช์:", stations.length);

    } catch (err) {
        console.error("❌ Error:", err.message);
    }
}

run();
