const axios = require("axios");
const cheerio = require("cheerio");
const puppeteer = require('puppeteer');
const logtimestamp = require("log-timestamp");
const player = require("play-sound")((opts = {}));
const open = require("open");

// aggregate scraped data into an array of js objects
const scrapedData = [];

// add colors for console.log downstairs 👨‍🎨
const COLORS = { red: "\x1b[31m", green: "\x1b[32m" };

// fetch data for given url
const fetchData = async (url) => {
  const result = await axios.get(url);
  return cheerio.load(result.data);
};

// fetch data and add to scrapedData array
const fetchDataFn = async (consoleString) => {
  const $ = await fetchData(`https://www.nowinstock.net/videogaming/consoles/${consoleString}/`);

  $("#trackerContent > div#data > table > tbody > tr").each((index, element) => {
    if (index === 0) return true;
    const tds = $(element).find("td");

    const [name, status, price, lastStock] = tds;

    scrapedData.push({
      name: $(name).text(),
      link: $(name).find("a").attr("href"),
      status: $(status).text(),
      price: $(price).text(),
      lastStock: $(lastStock).text(),
    });
  });

  return scrapedData;
};

// check scrapedData for any available consoles
const checkForStockAndAlert = (data, i) => {
  const consoleData = {
    0: { name: "Xbox Series X", sound: "./mp3s/xbox-in-stock.mp3" },
    1: { name: "Playstation 5", sound: "./mp3s/playstation-in-stock.mp3" },
  };

  const currentConsole = consoleData[i];
//  console.log(data);
  const potentials = data.filter(
    (v) => v.status !== "Out of Stock" && v.status !== "Not Tracking" && !v.name.startsWith("Ebay") // ain't nobody got time for Ebay
  );

  if (potentials.length > 0) {
    console.log(COLORS.green, `${currentConsole.name} LOCATED`);

    // open link of each potential console in default browser
    potentials.forEach((potential) => open(potential.link));

    player.play(`${currentConsole.sound}`, function (err) {
      if (err) throw err;
    });
  } else {
    console.log(COLORS.red, `No ${currentConsole.name} located! :(`);
  }
};

// Check all console types for stock every 5 minutes, notify if consoles are available
(function schedule() {
  Promise.all([fetchDataFn("microsoftxboxseriesx"), fetchDataFn("sonyps5")])
    .then(function (allConsoleData) {
      allConsoleData.forEach((console, i) => {
        checkForStockAndAlert(console, i);
      });

      console.log("Process finished, waiting 5 minutes");
      setTimeout(function () {
        console.log("Going to restart");
        schedule();
      }, 1000 * 60 * 5);
    })
    .catch((err) => console.error("error in scheduler", err));
})();

const checkRetailers = async () => {
  let found_one = false;
  
  // const $ = await fetchData(`https://www.bestbuy.com/site/combo/xbox-series-x-and-s-consoles/751d7e18-e554-4d61-9773-d9795e492b81`);
  
  const browser = await puppeteer.launch({
    // headless: false
  });

  const page = await browser.newPage();
  await page.goto('https://www.target.com/p/xbox-series-x-console/-/A-80790841');
  // await page.goto('https://www.target.com/p/xbox-series-s-console/-/A-80790842');
  // await page.goto('https://www.target.com/p/elden-ring-playstation-4/-/A-77401224');
  
  let found__next = true;
  try {
    await page.waitForSelector('div#__next');
  } catch (error) {
    console.error("Error: " + error + " , div#__next not found.");
    found__next = false;
  }

  const dataTestValues = await page.$$eval(
    'div',
    divs => divs.map(div => div.dataset.test)
  );
  
  const filteredDataTestValues = dataTestValues.filter(x => x);

  if (!found__next) {
    if (filteredDataTestValues.includes("storeBlockOrderPickup")) {
      console.log("Found pickup order!");
      found_one = true;
    } else if (filteredDataTestValues.includes("outOfStockNearbyMessage") || 
               filteredDataTestValues.includes("outOfStockMessage")) {
      found_one = false;
      console.log("Out of stock");
    }
  }

  const dataValues = await page.$$eval(
    'div.h-text-bold',
    divs => divs.map(div => div.innerHTML)
  );
  console.log(dataValues)

  const importantText = dataValues.join(" ");
  if (importantText.includes("There was a temporary issue")) {
    console.log("Temporary issue, retry in 5 min??")
  }
  if (importantText.includes("Out of stock")) {
    found_one = false;
    console.log("Out of stock");
  } else if (importantText.includes("Available near you")) {
    found_one = true;
    console.log("Available near you!");
  }
  
  await browser.close();
  console.log("done");

  return found_one;
}

checkRetailers();

//  future additions - command line argument to specify duration and email address, small email/text service to alert if stock is found, twilio
