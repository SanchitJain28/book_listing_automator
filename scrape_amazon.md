# Scraping All Physical Books from Amazon.in — Findings & Recommendation

_Written 19 September 2026. All numbers below were measured directly against the Keepa API, not guessed._

---

## The short version (read this if you read nothing else)

We want a list of every physical book on amazon.in, with title, price and ISBN.

There are two separate jobs:

1. **Discovery** — finding out _which_ books exist. Getting a list of ID numbers.
2. **Collection** — going and fetching the details for each ID.

Most people only think about job 2. **Job 1 is the hard one**, and it is the reason this whole decision comes out the way it does.

**The answer: use Keepa. Pay for one month of their Business plan (€2,499, about ₹2.5 lakh). The whole thing finishes in under a week.**

Everything else is either much more expensive, or simply cannot do job 1 at all.

---

## Question 1: Will Keepa find _all_ the physical books?

**Almost all — but nobody can promise "all", and here is the honest reason why.**

Think of it like this. Amazon is a giant library. Keepa is a person who has walked around that library for years writing down every book they saw in a notebook.

When you ask Keepa a question, **you are reading the notebook, not the library.**

So there are three different gaps, and they are not the same kind of problem:

### Gap 1: Books in the notebook we might miss — SOLVED ✅

At first we were going to find books by their _sales rank_ (their popularity number). We tested this.

> **Only 1,568,700 books out of 45 million have a sales rank. That is 3.5%.**

So 96.5% of books have no popularity number at all. If we had used that method, we would have missed almost everything. We nearly made this mistake.

We also checked categories (Fiction, Children's, and so on):

> **78.6% of books are not filed under any category.** They just hang loose at the top.

So that method fails too.

The method that works is **`trackingSince`** — the date Keepa first noticed the book. Every single book has one, because Keepa had to notice it at some point to write it down. We tested it:

> **100% coverage. Every book has this date. And when we split the dates into four time periods, the four groups added up to exactly the full total — 45,456,300. Nothing fell through the cracks.**

So with this method we can reach essentially every book in the notebook.

### Gap 2: Books we might filter out by accident — MOSTLY SOLVED ⚠️

We filter out ebooks and audiobooks by looking at the "binding" (Paperback, Hardcover, etc.).

Two things we found:

- **158,200 books (0.3%) have no binding written down at all.** Our filter drops these. Small loss.
- **About 2,740,000 books (6.5%) have a binding word we did not recognise.** Probably unusual or Indian-specific words. **Some of these are real physical books we are currently missing.** This is worth one cheap check before the real run.

### Gap 3: Books in the library but not in the notebook — CANNOT BE MEASURED ❌

Keepa's own documentation says their search looks at _their_ database, not Amazon's, and may not find everything on Amazon.

**There is no way to measure this from inside Keepa.** You cannot ask the notebook what it forgot.

The only fix is to bring your own separate list of books — Open Library publishes a free list of over 20 million book editions every month — and check those against Amazon too. That gives you a second opinion.

### So what is the real answer?

| What                                      | How many                 |
| ----------------------------------------- | ------------------------ |
| Physical books Keepa knows about          | **~42,150,000**          |
| …of those, currently in stock and buyable | **~15,807,800**          |
| How many we can actually reach            | **~99%+ of those**       |
| How many Amazon has that Keepa doesn't    | **Unknown. Unknowable.** |

**Plain answer: yes, you will get nearly every physical book that Keepa knows about. Whether Keepa knows about every book on Amazon, nobody can tell you.**

---

## Question 2: How much will Keepa cost?

Keepa does not charge per book. It gives you **tokens**, like arcade coins. Every action costs coins.

- Looking up one book's details = **1 coin**
- Finding books costs coins too, but much less

You buy a plan, and the plan drips coins into your bucket every minute, day and night.

| Plan       | Coins per minute | Coins per month | Price       |
| ---------- | ---------------- | --------------- | ----------- |
| Starter    | 20               | 892,800         | **€49**     |
| Developer  | 250              | 11,160,000      | **€459**    |
| Business   | 2,000            | 89,280,000      | **€2,499**  |
| Enterprise | 10,000           | 446,400,000     | **€11,099** |

### How many coins do we actually need?

We ran a real test. Discovery used **821 coins for 46,211 books**. That works out to:

> **17.8 coins per 1,000 books for discovery.**

Then collection is 1 coin per book. So:

**If you want in-stock books only (15.8 million):**

| Stage                           | Coins           |
| ------------------------------- | --------------- |
| Discovery                       | ~281,000        |
| Collection (title, price, ISBN) | ~15,808,000     |
| **Total**                       | **~16,090,000** |

**If you want every book ever listed (42.1 million):**

| Stage      | Coins           |
| ---------- | --------------- |
| Discovery  | ~750,000        |
| Collection | ~42,150,000     |
| **Total**  | **~42,900,000** |

### What that costs

The Business plan gives 89,280,000 coins a month. **Both options fit inside one single month.**

| What you want          | Coins needed | Plan             | Cost                    |
| ---------------------- | ------------ | ---------------- | ----------------------- |
| In-stock books (15.8M) | 16.09M       | 1 month Business | **€2,499 (~₹2.5 lakh)** |
| Every book (42.1M)     | 42.9M        | 1 month Business | **€2,499 (~₹2.5 lakh)** |

**The price is the same either way.** You are paying for the speed of the tap, not the amount of water. So you may as well take the bigger option.

> ⚠️ **Important:** Your current Starter plan (€49) gives 892,800 coins a month. You need 16 million. **That is 18 months of waiting.** Starter cannot do this job.

### One warning about cancelling

You can cancel any time, but Keepa only allows a downgrade **once every 28 days**, and it comes back as account credit — **not a refund to your card**. So only start the subscription on the day you are actually ready to run.

---

## Question 3: How long will it take?

| Plan                | Discovery     | Collection   | **Total**                              |
| ------------------- | ------------- | ------------ | -------------------------------------- |
| **Starter** €49     | 9.8 days      | 549 days     | **~1.5 years** ❌                      |
| **Developer** €459  | 19 hours      | 44 days      | **~45 days** (needs 2 months' billing) |
| **Business** €2,499 | **2.3 hours** | **5.5 days** | **~5.6 days** ✅                       |

_(for 15.8M in-stock books. For all 42.1M books on Business: about 14.9 days.)_

Notice the shape of this:

> **Discovery is 2% of the work. Collection is 98%.**

Discovery finishes before lunch. Collection runs for about a week. This is why it is not worth spending time making discovery faster — you would be optimising the small half.

The computer has to stay awake and connected the whole time. On a Mac use `caffeinate -i node script.js` so it does not fall asleep, or better, run it on a small cloud server.

---

## Question 4: What else is there besides Keepa?

| Name                    | What it is                                                  |
| ----------------------- | ----------------------------------------------------------- |
| **Oxylabs**             | Fetches Amazon pages for you and turns them into clean data |
| **Bright Data**         | Same, plus they sell ready-made data they already collected |
| **Rainforest API**      | Amazon specialist, very detailed, very expensive            |
| **Scrapingdog**         | The cheap one. Fast, but fails more often                   |
| **Apify**               | Ready-made robots you rent. Easy, slow, pricey              |
| **Amazon Creators API** | Amazon's own official one                                   |
| **Open Library**        | A free list of 20+ million books. Not an Amazon tool        |

**A note on Amazon's own API:** the old one (PA-API) was shut down on 15 May 2026 and replaced by the Creators API. It will not help here anyway — it returns only 10 items per call, needs an affiliate account, and starts at 1 request per second. It is for showing a few products on a website, not for collecting millions.

---

## Question 5: Can the others discover books properly? (The most important question)

**No. And this is the single biggest finding in this whole document.**

Here is the difference, in one sentence:

> **Keepa is a notebook you can search. Everyone else is a delivery boy who fetches the page you point at.**

The delivery boy is very good at his job. But you have to already know the address. He cannot tell you which houses exist on the street.

So with Oxylabs or Bright Data or any of the others, you would have to walk Amazon's own pages to build your list. And that hits four walls:

**Wall 1 — Amazon stops showing results.** Any search on Amazon gives you about 400 results maximum, no matter how many actually match. Seven pages and it stops. A category with 50,000 books still shows you 400.

**Wall 2 — Popularity lists don't help.** Bestseller pages only show ranked books. We measured this: **96.5% of books have no rank.** So those pages are blind to almost the entire catalogue.

**Wall 3 — Category pages don't help either.** We measured this too: **78.6% of books are not in any category.** So walking every category page reaches at most about one book in five.

**Wall 4 — You cannot slice finely enough.** With Keepa we split books by the exact minute they were first seen, and we can keep halving that forever until each group is small enough to fit. On Amazon's own pages you only get the filters Amazon shows in its menus. You hit a group of 2,000 books, you can only see 400, and **there is no filter left to split it with.** Those 1,600 books are simply gone.

### But once you have the list, they extract data very well

This is worth saying clearly, because it is where they shine:

| Job                                        | Keepa                   | Oxylabs / Bright Data / others |
| ------------------------------------------ | ----------------------- | ------------------------------ |
| **Finding which books exist**              | ✅ Excellent            | ❌ Cannot really do it         |
| **Getting title, price, ISBN**             | ✅ Good                 | ✅ Good                        |
| **Full descriptions, review text, images** | ❌ Limited              | ✅ Better than Keepa           |
| **Price history over past years**          | ✅ Nobody else has this | ❌ No                          |

So they are not bad tools. They are **the wrong tool for job 1, and a fine tool for job 2.**

---

## Question 6: What do the others cost?

Published rates, checked September 2026:

| Platform                        | Price per 1,000 books                       |
| ------------------------------- | ------------------------------------------- |
| **Scrapingdog**                 | $0.20, down to $0.063 at volume             |
| **Oxylabs**                     | $0.50 (Micro $49/mo) → $0.25 (custom)       |
| **Bright Data**                 | $1.50 pay-as-you-go → $1.30 (Scale $499/mo) |
| **Bright Data ready-made data** | $2.50 ($250 per 100,000)                    |
| **Rainforest API**              | ~$6.60 (Starter $66/mo = 10,000 credits)    |
| **Apify**                       | ~$6.67                                      |

### What 15.8 million books would cost

| Platform    | Cost                 | Can it discover? |
| ----------- | -------------------- | ---------------- |
| **Keepa**   | **~$2,700** (€2,499) | ✅ **Yes**       |
| Scrapingdog | ~$1,580              | ❌ No            |
| Oxylabs     | ~$4,000–4,700        | ❌ No            |
| Bright Data | ~$20,550             | ❌ No            |
| Rainforest  | ~$104,300            | ❌ No            |
| Apify       | ~$105,400            | ❌ No            |

Scrapingdog looks cheaper. **But that price only buys you job 2.** You would still have no way to build the list of 15.8 million IDs in the first place. A cheap delivery boy is no help when you have no addresses.

Some hidden extras nobody puts on their price page:

- **Rainforest charges 2–3 credits** instead of 1 for certain fields. Real cost can be triple the sticker.
- **Oxylabs charges for "successful" results, and a 404 counts as successful.** Dead books still cost money.
- **Scrapingdog succeeds about 89% of the time.** Budget 15% extra for retries.
- Discovery pages on any scraper are billed separately from the book pages.

---

## Question 7: How each one works, and what is good and bad about it

### Keepa

**How it works:** Keepa keeps its own copy of Amazon's catalogue. You ask it questions about that copy. You never touch Amazon.

**Good:**

- The only one that can genuinely find books
- Cheapest by a distance for this job
- Gives years of price history nobody else has
- Looks up 100 books in one request
- Works on amazon.in (domain 10)

**Bad:**

- Only knows what it has already written down
- Prices are in tokens, which takes getting used to
- Unused coins vanish after 60 minutes — you cannot save them up
- Thin on descriptions, review text, images
- Support is email only

**Best for:** exactly this job.

---

### Oxylabs

**How it works:** you give it an Amazon web address, it fetches the page, gets past the blocking, and gives you tidy data.

**Good:**

- Very reliable, rarely blocked
- Cheap per page ($0.25–0.50 per 1,000)
- Has ready-made settings for Amazon product, search, offers and bestseller pages
- Free trial of 2,000 results
- Does not charge for its own errors

**Bad:**

- Cannot discover
- 404 pages still cost money
- Monthly plan needed for good rates
- You build and maintain all the crawling logic

**Best for:** fetching extra details for books you already found.

---

### Bright Data

**How it works:** same as Oxylabs, but they also have a "discovery" mode, and they sell data they collected earlier.

**Good:**

- Biggest operation of them all
- Their ready-made datasets skip the discovery problem completely
- Free 5,000 records every month
- Returns 500+ fields per product
- Delivers to S3, Snowflake, webhooks

**Bad:**

- Expensive — roughly 8× Keepa for the same job
- Their "discovery" still walks Amazon's pages underneath, so the 400-result wall is hidden, not removed
- Real dataset prices need a sales conversation

**Best for:** buying a bulk snapshot without building anything. **Worth one email** to ask what a full amazon.in books dataset costs.

---

### Rainforest API

**Good:** deepest Amazon detail — Buy Box, every seller's offer, 24 marketplaces.

**Bad:** very expensive, 2–3× credit multipliers on some fields, reported slow responses (30–50 seconds), no discovery.

**Best for:** watching a few thousand products closely. Wrong shape entirely for millions.

---

### Scrapingdog

**Good:** cheapest per page, fastest responses.

**Bad:** 89% success rate, no discovery, less polished.

**Best for:** high volume where you already have the list and can tolerate retries.

---

### Apify

**Good:** ready-made robots, no coding needed, very deep data.

**Bad:** most expensive, slow (~15 seconds each), no discovery.

**Best for:** small one-off jobs.

---

### Open Library (free — worth using alongside)

**How it works:** the Internet Archive publishes a free file every month with over 20 million book records. You download it.

Here is the clever part: **for most printed books, Amazon's ID number _is_ the ISBN-10.** So you can take Open Library's ISBN list and check each one against Amazon directly.

**Good:** free, legal, CC0, no permission needed, and it is the only way to find books Keepa never wrote down.

**Bad:** the file is about 45GB unpacked and needs roughly 250GB of disk to load. Coverage of Indian publishers is patchy.

**Best for:** a second opinion, to catch what Keepa missed.

---

## Question 8: Recommendation

### Use Keepa. One month of Business. €2,499.

Three reasons, in order of importance:

**1. It is the only one that can do the hard job.** The other platforms are not slightly worse at discovery — they structurally cannot do it. We measured the three walls: 96.5% no rank, 78.6% no category, 400-result cap. Any approach built on Amazon's own pages hits all three.

**2. It is also the cheapest.** This almost never happens. Usually the best tool costs more. Here the best tool for discovery is also the cheapest for collection — because a database read is cheaper than fetching a web page.

**3. It fits in one billing month.** Even the full 42 million takes under 15 days. Subscribe, run, cancel.

### The plan

| Step | What                                           | Time      | Cost       |
| ---- | ---------------------------------------------- | --------- | ---------- |
| 1    | Check the 2.74M unknown bindings               | 10 min    | ~100 coins |
| 2    | Decide: in-stock (15.8M) or everything (42.1M) | —         | free       |
| 3    | Test-run collection on 10,000 books            | 1 hour    | on Starter |
| 4    | Subscribe to Business                          | —         | €2,499     |
| 5    | Run discovery                                  | 2–6 hours | included   |
| 6    | Run collection                                 | 5–15 days | included   |
| 7    | Cancel before renewal                          | —         | —          |
| 8    | _(Optional)_ Cross-check with Open Library     | a weekend | free       |

**Do step 3 before step 4.** Once you subscribe, the clock is running and Keepa does not give refunds.

### When you would choose differently

- **If you only need a few thousand books** → Starter €49 is plenty. Do not overbuy.
- **If you need full descriptions and review text** → add Oxylabs at $0.30/1,000 for just the books that need it. Keepa for discovery, Oxylabs for depth.
- **If you would rather not build anything** → email Bright Data and ask for a full amazon.in books dataset. It may well beat €2,499 in your own time, even if the sticker is higher.
- **If completeness truly matters** → do the Open Library cross-check. It is the only honest way to find out what Keepa missed.

---

## Things to keep in mind

**Amazon's terms do not permit automated collection.** Using a third-party service moves that exposure around rather than removing it. Keepa and official APIs are the cleaner ground. Worth a thought if this is going to be a business rather than a personal project.

**These are all foreign companies**, so Indian GST under reverse charge will likely apply on top of the listed price. Check with whoever handles your compliance.

**None of these prices include your own costs** — disk space for 16 million records, the machine that stays awake for a week, and your time building and watching it.

**Prices change.** Everything here was checked in September 2026. Confirm on each provider's own site before you pay. Keepa's pricing page in particular blocks automated checking, so read the number at their checkout.

---

## Numbers we actually measured

Keep these — they are real, not estimates:

| What                              | Number                         |
| --------------------------------- | ------------------------------ |
| Books root node (amazon.in)       | `976389031`                    |
| Everything under that root        | 43,804,186                     |
| Physical products (productType 0) | 45,456,800                     |
| Physical books by binding         | 42,075,200                     |
| With extra binding words added    | 42,150,600                     |
| **In stock right now**            | **15,807,800**                 |
| Ebooks hiding under Books         | 8,314,800                      |
| Books with a sales rank           | 1,568,700 (**3.5%**)           |
| Books with no category            | **78.6%**                      |
| Books with no binding word        | 158,200 (0.3%)                 |
| Unrecognised binding words        | ~2,740,000 (6.5%)              |
| Hidden by the 6-month default     | **23.2%**                      |
| `trackingSince` coverage          | **100%**                       |
| Measured discovery cost           | **17.8 coins per 1,000 books** |
| Max results per Keepa query       | 10,000 (hard limit)            |
| Max IDs per category lookup       | 10 (still 1 coin)              |
| Best Sellers list size            | up to 500,000 for 50 coins     |

### Two traps we fell into — do not repeat them

**Trap 1: The `✜` exclusion filter does nothing.** We tried excluding "Kindle Edition" and "Audible Audiobook" with the `✜` prefix. It removed almost nothing — the total actually went _up_ to 54,560,000. The reason: exclusion only works on books that _have_ a binding written down and it is different. Books with no binding sail straight through. **Always list what you want, never list what you don't.**

**Trap 2: The 6-month default is invisible.** If you do not set `lastUpdate_gte`, Keepa quietly only shows you books it has touched in the last six months. That hid 23.2% of the catalogue from us and we had no idea until we tested it. **Always set it to 0.**
