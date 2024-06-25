const SteamCommunity = require("steamcommunity");
const fs = require("fs");
const sha1 = require("js-sha1");
const dir = `./static`;
const dirPrices = `./static/prices`;
const dirPricehistory = `./static/pricehistory`;
const ITEMS_API_BASE_URL =
    "https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en";
const MARKET_BASE_URL = "https://steamcommunity.com/market";

if (process.argv.length != 4) {
    console.error(
        `Missing input arguments, expected 4 got ${process.argv.length}`
    );
    process.exit(1);
}

if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
}

if (!fs.existsSync(dirPrices)) {
    fs.mkdirSync(dirPrices);
}

if (!fs.existsSync(dirPricehistory)) {
    fs.mkdirSync(dirPricehistory);
}

let community = new SteamCommunity();

console.log("Logging into Steam community....");

community.login(
    {
        accountName: process.argv[2],
        password: process.argv[3],
        disableMobile: true,
    },
    async (err) => {
        if (err) {
            console.log("login:", err);
            return;
        }

        try {
            console.log("Loading items...");
            const items = await getAllItemNames();
            console.log(`Processing ${items.length} items.`);
            await processItems(items);

            // Save price data to one json file
            fs.writeFile(
                `${dirPrices}/latest.json`,
                JSON.stringify(priceDataByItemHashName, null, 4),
                (err) => err && console.error(err)
            );
        } catch (error) {
            console.error("An error occurred while processing items:", error);
        }
    }
);

// Price data by item hash name
const priceDataByItemHashName = {};

async function getAllItemNames() {
    return Promise.all([
        fetch(`${ITEMS_API_BASE_URL}/skins_not_grouped.json`)
            .then((res) => res.json())
            .then((res) => res.map((item) => item.market_hash_name)),
        fetch(`${ITEMS_API_BASE_URL}/stickers.json`)
            .then((res) => res.json())
            .then((res) => res.map((item) => item.market_hash_name)),
        fetch(`${ITEMS_API_BASE_URL}/crates.json`)
            .then((res) => res.json())
            .then((res) => res.map((item) => item.market_hash_name)),
        fetch(`${ITEMS_API_BASE_URL}/agents.json`)
            .then((res) => res.json())
            .then((res) => res.map((item) => item.market_hash_name)),
        fetch(`${ITEMS_API_BASE_URL}/keys.json`)
            .then((res) => res.json())
            .then((res) => res.map((item) => item.market_hash_name)),
        fetch(`${ITEMS_API_BASE_URL}/patches.json`)
            .then((res) => res.json())
            .then((res) => res.map((item) => item.market_hash_name)),
        fetch(`${ITEMS_API_BASE_URL}/graffiti.json`)
            .then((res) => res.json())
            .then((res) => res.map((item) => item.market_hash_name)),
        fetch(`${ITEMS_API_BASE_URL}/music_kits.json`)
            .then((res) => res.json())
            .then((res) => res.map((item) => item.market_hash_name)),
        fetch(`${ITEMS_API_BASE_URL}/collectibles.json`)
            .then((res) => res.json())
            .then((res) => res.map((item) => item.market_hash_name)),
    ]).then((results) => results.flat().filter(Boolean));
}

async function fetchPrice(name) {
    return new Promise((resolve, reject) => {
        community.request.get(
            `${MARKET_BASE_URL}/pricehistory/?appid=730&market_hash_name=${encodeURIComponent(
                name
            )}`,
            (err, res) => {
                if (err) {
                    reject(err);
                    return;
                }
                try {
                    if (res.statusCode > 400) {
                        console.log('[ERROR]', res.statusCode, res.statusMessage);
                        console.log(
                            `${MARKET_BASE_URL}/pricehistory/?appid=730&market_hash_name=${encodeURIComponent(
                                name
                            )}`
                        );
                        resolve({ prices: [], lastEver: null });
                    }

                    const prices = (JSON.parse(res.body).prices || []).map(
                        ([time, value, volume]) => ({
                            time: Date.parse(time),
                            value,
                            volume: parseInt(volume),
                        })
                    );
                    resolve({
                        prices,
                        lastEver: prices.length > 0 ? prices[prices.length - 1].value : null
                    });
                } catch (parseError) {
                    reject(parseError);
                }
            }
        );
    });
}

async function processBatch(batch) {
    const promises = batch.map((name) =>
        fetchPrice(name)
            .then(({ prices, lastEver }) => {
                if (prices.length > 0) {
                    priceDataByItemHashName[name] = {
                        steam: getWeightedAveragePrice(prices, lastEver)
                    };
                    const hashedName = sha1(name);
                    // TODO: Try to save all data prices.
                    // For testing purposes just add the last 500 prices.
                    const filteredPrices = prices.splice(-500);
                    return fs.writeFile(
                        `${dir}/pricehistory/${hashedName}.json`,
                        JSON.stringify(filteredPrices),
                        (err) => err && console.error(err)
                    );
                }
            })
            .catch((error) => console.log(`Error processing ${name}:`, error))
    );
    await Promise.all(promises);
}

async function processItems(items, batchSize = 1) {
    // Calculate delay based on rate limit
    const requestsPerMinute = 30;
    // Calculate delay needed after each batch to adhere to the rate limit
    // Note: If batchSize is larger than the rate limit, this will result in a negative delay,
    // which should be handled as well (e.g., by setting a minimum batchSize or adjusting the logic accordingly).
    const delayPerBatch = 0 // Convert to milliseconds

    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        await processBatch(batch);
        console.log(
            `Processed batch ${i / batchSize + 1}/${Math.ceil(
                items.length / batchSize
            )}`
        );

        // Add a delay to respect the rate limit, only if there are more batches to process
        if (i + batchSize < items.length) {
            console.log(
                `Waiting for ${
                    delayPerBatch / 1000
                } seconds to respect rate limit...`
            );
            await new Promise((resolve) => setTimeout(resolve, delayPerBatch));
        }
    }
}

function getMedianPrice(data) {
    const now = Date.now();

    // Helper function to filter data based on time range (in days)
    const filterByTime = (days) => {
        const limit = now - days * 24 * 60 * 60 * 1000;
        return data
            .filter(({ time }) => time >= limit)
            .map((item) => item.value)
            .sort((a, b) => a - b);
    };

    // Helper function to calculate median
    const calculateMedian = (values) => {
        if (values.length === 0) return null;
        const mid = Math.floor(values.length / 2);
        return values.length % 2 === 0
            ? (values[mid - 1] + values[mid]) / 2
            : values[mid];
    };

    return {
        last_24h: calculateMedian(filterByTime(1)),
        last_7d: calculateMedian(filterByTime(7)),
        last_30d: calculateMedian(filterByTime(30)),
        last_90d: calculateMedian(filterByTime(90)),
    };
}

function getWeightedAveragePrice(data, lastEver) {
    const now = Date.now();

    // Helper function to calculate WAP for a given time range (in days)
    const calculateWAP = (days) => {
        const limit = now - days * 24 * 60 * 60 * 1000; // Time limit in milliseconds
        let totalVolume = 0;
        let totalPriceVolumeProduct = 0;

        data.forEach(({ time, value, volume }) => {
            if (time >= limit) {
                totalPriceVolumeProduct += value * volume;
                totalVolume += volume;
            }
        });

        return totalVolume > 0 ? totalPriceVolumeProduct / totalVolume : null;
    };

    return {
        last_24h: calculateWAP(1),
        last_7d: calculateWAP(7),
        last_30d: calculateWAP(30),
        last_90d: calculateWAP(90),
        last_ever: lastEver
    };
}
