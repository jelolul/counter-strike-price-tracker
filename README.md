# counter-strike-price-tracker

This repository provides access to price data for Counter-Strike items via static JSON files. Here's how you can fetch the data:

>[!NOTE]
>All prices are listed in euros

---

## Latest Prices

You can fetch the **latest prices** for all items from the following endpoint:

https://raw.githubusercontent.com/ByMykel/counter-strike-price-tracker/main/static/prices/latest.json

This file contains a JSON object where each key is the market hash name of the item, and the value is its latest steam price.

---

## Specific Item Price History

To fetch the **price history** for a specific item, use the following endpoint:

https://raw.githubusercontent.com/ByMykel/counter-strike-price-tracker/main/static/pricehistory/{hash}.json

Replace `{hash}` with the hashed market hash name of the item. For example:

**Item:** `AWP | Dragon Lore (Factory New)`  
**Hash:** `12d095d45089fff0c2e1f689ed7b1f352d087f95`  
**Endpoint:** https://raw.githubusercontent.com/ByMykel/counter-strike-price-tracker/main/static/pricehistory/12d095d45089fff0c2e1f689ed7b1f352d087f95.json


This file contains the item's price history as an array of price points.

---



