CASE 1 : Rs 125 -> in 4 Days
GIVEN PRICE : 150
Rs 150 -> in 3 days
Rs 100 -> in 6 days
Rs 80 -> in 7 Days
RS 175 -> in 10 days

CASE 2 : Rs 125 -> in 7 Days -> NO PENALTY
GIVEN PRICE : 120
Rs 100 -> in 8 days -> penalty of Rs10 == Rs 110 in 7 days  
Rs 100 -> in 10 days -> penalty of Rs 10 + 12.5 + 15 = Rs 37.5 == Rs 137.5 in 7 days (Each progressive day a extra Rs2.5 penalty is added)
Rs 80 -> in 12 Days -> penalty of Rs 10 + 12.5 + 15 + 17.5 = Rs 55 == Rs 135 in 7 days (Each progressive day a extra Rs2.5 penalty is added)
RS 175 -> in 14 days -> penalty of Rs 10 + 12.5 + 15 + 17.5 + 20 + 22.5 + 25 = Rs 122.5 == Rs 122.5 in 7 days (Each progressive day a extra Rs2.5 penalty is added)

WINNER :
CASE 1 : Rs 80 -> in 7 days
CASE 2 : Rs 100 -> in 8 days

New rule :

1. Delivery penalty will be
   only be allowed when the item deliver
   days is greater than 7 , if
   all deliver under 7 days , Then
   no delivery penalty will be there
   so under 7 days delivery date
   the cheapest WINS

NOTE : Note this 7 Days NO PENALTY is relative ->

1. if 14 day Window is allowed -> 7 days no penalty period
2. if 10 days Window is allowed -> 5 days no penalty period
3. and so on relative rates

---

## NEW TEST CASES PROPOSED BY AI (Please review)

### CASE 3 (From real log `9788170162131`):

**GIVEN PRICE:** 162

- **Offer A:** Rs 162 in 4 days (<= 7 days -> NO PENALTY) -> Effective Price = **Rs 162.0**
- **Offer B:** Rs 124 in 13 days (6 days beyond 7):  
  Penalty = 10 + 12.5 + 15 + 17.5 + 20 + 22.5 = Rs 97.5  
  Effective Price = 124 + 97.5 = **Rs 221.5**

**PROPOSED WINNER:** **Offer A (Rs 162 in 4 days)**  
_(Does this match your expectation?)_
-> YES THIS IS CORRECT , no CHANGE START THE FIRST DAY PENALTY BY 7.5 not 10 (NEW CHANGE)

---

### CASE 4 (Fast delivery vs Slight delay vs Bigger delay):

**GIVEN PRICE:** 200

- **Offer A:** Rs 170 in 6 days (<= 7 days -> NO PENALTY) -> Effective Price = **Rs 170.0**
- **Offer B:** Rs 150 in 8 days (1 day beyond 7 -> penalty Rs 10) -> Effective Price = **Rs 160.0**
- **Offer C:** Rs 130 in 10 days (3 days beyond 7 -> penalty 10 + 12.5 + 15 = 37.5) -> Effective Price = **Rs 167.5**

**PROPOSED WINNER:** **Offer B (Rs 150 in 8 days)**  
_(Reason: Even though Offer A is faster under 7 days, Offer B saves Rs 20 with only a 1-day delay costing Rs 10 penalty, so Rs 160 beats Rs 170!)_

---

## QUESTIONS FOR USER (Please write your answers below or in chat):

### Q1. What happens if Effective Price > Given Price?

Suppose **GIVEN PRICE = 100**, and there is only **1 offer** available:

- Offer A: **Rs 95 in 9 days** (Item price 95 <= 100, passes Rule 1).
- Penalty for 9 days (2 extra days) = 10 + 12.5 = Rs 22.5.
- Effective Price = 95 + 22.5 = **Rs 117.5** (which is > Given Price 100).

**Question:** Should Offer A:

- **Choice A1:** Still be added to cart because its real item price (Rs 95) is <= Given Price (100) and no cheaper/faster offer exists?
- **Choice A2:** Be DISQUALIFIED (Score = 0) and skipped, because the delivery penalty pushed it over budget?

## ANSWER : Score will be perfect 1 , if there is only 1 buying option ,this scores only works if there are more than 1 buying options (NEW CHANGE)

### Q2. Formula for Score between 0 and 1:

To calculate `Score` in range `0.00` to `1.00` (where 1.00 is best):
If we use:  
`Score = Math.max(0, (GIVEN_PRICE - Effective_Price) / GIVEN_PRICE)`

- If Effective Price == GIVEN PRICE -> Score = 0.00
- If Effective Price < GIVEN PRICE -> Score > 0 (e.g. Rs 100 on Given Price 200 -> Score = 0.50)
- If Effective Price > GIVEN PRICE -> Score = 0.00

**Question:** Is this formula good, or would you like a minimum base score (e.g., any offer meeting Rule 1 gets at least 0.10 base score so it isn't 0)?

## ANSWER : The score should be relative , if only one offer then score is perfect 1, i hope this helps score should be relative (NEW CHANGE)

---

### Q3. Day 12 Penalty in Case 2 check:

In Case 2, you wrote for 12 days: `10 + 12.5 + 15 + 17.5 = 55`.  
Since 12 days is 5 days beyond 7 (days 8, 9, 10, 11, 12), the 5th step is `+20` (Total = 75).  
Was that 4 terms for Day 11, or should Day 12 include the 5th term `+20`? (Our progressive formula will automatically calculate `10 + (k-1)*2.5` for each day `k` beyond 7).

---

# ========================================================

# FINALIZED SCORE SYSTEM SPECIFICATION

# STATUS: FINALIZED

# ========================================================

## 1. Mandatory Filter Rules (Before Scoring)

- **Rule 1 (Price Ceiling & Margin Buffer):**
  - Path A (Standard): `itemPrice <= targetPrice`
  - Path B (Margin Buffer): If `itemPrice > targetPrice`, eligible if `sellPrice - itemPrice >= ₹50` (using raw Amazon item price; configurable via `scraper_config.json`).
  - If neither -> Disqualified (`HIGH PRICE`).
- **Rule 2 (Delivery Limit):** `deliveryDays <= 40 days`. If exceeded -> Disqualified (`DELIVERY DATE`).
- **Stock Check:** If out of stock -> Disqualified (`UNAVAILABLE`).
- **ISBN Check:** If ISBN mismatch -> Disqualified (`ISBN NOT MATCHED`).

## 2. Progressive Delivery Penalty Table (40-Day Window)

- **Tier 0 (Days 1 to 10):** **₹0 Penalty** (10-day penalty-free grace period).
- **Tier 1 (Days 11 to 20):** Starts at **₹3.0** on Day 11, adding **+₹0.8** each progressive day:
  - Day 11: +₹3.0 -> Total = **₹3.0**
  - Day 12: +₹3.8 -> Total = **₹6.8**
  - Day 13: +₹4.6 -> Total = **₹11.4**
  - Day 14: +₹5.4 -> Total = **₹16.8**
  - Day 15: +₹6.2 -> Total = **₹23.0**
  - Day 16: +₹7.0 -> Total = **₹30.0**
  - Day 17: +₹7.8 -> Total = **₹37.8**
  - Day 18: +₹8.6 -> Total = **₹46.4**
  - Day 19: +₹9.4 -> Total = **₹55.8**
  - Day 20: +₹10.2 -> Total = **₹66.0**
- **Tier 2 (Days 21 to 30):** Starts at **₹5.0** on Day 21, adding **+₹1.2** each progressive day:
  - Day 21: +₹5.0 -> Total = **₹71.0**
  - Day 25: +₹9.8 -> Total = **₹103.0**
  - Day 30: +₹15.8 -> Total = **₹170.0**
- **Tier 3 (Days 31 to 40):** Starts at **₹7.5** on Day 31, adding **+₹1.5** each progressive day:
  - Day 31: +₹7.5 -> Total = **₹177.5**
  - Day 35: +₹13.5 -> Total = **₹222.5**
  - Day 40: +₹21.0 -> Total = **₹312.5**
- **Days > 40:** Disqualified (`DELIVERY DATE`).

$$\text{Effective Price} = \text{itemPrice} + \text{Total Penalty}$$

## 3. Relative Score Formula (Smooth Range between 0.00 and 1.00)

Every qualified offer receives a smooth score representing its cost-efficiency relative to the optimal offer:

$$\text{Score} = \frac{\text{bestEffectivePrice}}{\text{effectivePrice}}$$

- **Optimal Offer (Lowest Effective Price):** $\text{Score} = \mathbf{1.00}$ (Winner).
- **Close Competing Offers:** Scores scale naturally between $\mathbf{0.70}$ and $\mathbf{0.95}$ (e.g. ₹162 vs ₹132.5 gives $\approx \mathbf{0.82}$).
- **Delayed / Higher Effective Price Offers:** Receive intermediate scores (e.g. ₹206.5 gives $\approx \mathbf{0.64}$), rather than abruptly collapsing to 0.00.
- **Single Offer:** Automatically receives $\text{Score} = \mathbf{1.00}$.

## 4. Tie-Breaker Order

1. Highest `Score` (lowest `effectivePrice`).
2. If scores are tied, lowest `itemPrice` wins.
3. If scores and item prices are both tied, **earliest `deliveryDate` (lowest `deliveryDays`) wins**.
4. If delivery dates are also tied, `New` condition wins over `Used`.
5. If still equal, first listed offer wins.

## 5. Verification Cases Summary (Smooth Relative Scoring)

- **Live Run `9789381714171` (Target Rs 324):**
  - **ScientificInternational:** Rs 324 in 6d (23 Sept) -> Score = 1.00
  - **Bookstore18:** Rs 324 in 3d (20 Sept) -> Score = 1.00
  - **WINNER:** **Bookstore18 (20 Sept, 3d)** wins via Tie-Breaker 3 (earlier delivery date: 3 days < 6 days).
- **Live Run `9788170162131` (Target Rs 162):**
  - **Nanhi Shop (Rs 125, 8d -> eff Rs 132.5):** $\text{Score} = 132.5 / 132.5 = \mathbf{1.00}$ (WINNER)
  - **KITABGHAR (Rs 162, 3d -> eff Rs 162.0):** $\text{Score} = 132.5 / 162.0 = \mathbf{0.82}$
  - **Study Lover (Rs 124, 13d -> eff Rs 206.5):** $\text{Score} = 132.5 / 206.5 = \mathbf{0.64}$
- **Case 1 (Target Rs 150):** Rs 80 in 7d (Score 1.00), Rs 100 in 6d (Score 0.80), Rs 125 in 4d (Score 0.64), Rs 150 in 3d (Score 0.53).
- **Case 2 (Target Rs 120):** Rs 100 in 8d (eff Rs 107.5 -> Score 1.00), Rs 100 in 10d (eff Rs 130 -> Score 0.83), Rs 80 in 12d (eff Rs 142.5 -> Score 0.75).

## New cases

1. Compare price = 100
2. Margin price (PO price)= 150
3. Delivery fee = 40

- Option 1
- Book price : 100 + delivery fee is 80
- Effecitive = 180

- Book price : 155 + FREE DELIVERY
- Effective = 155

-- In this case 155 should be chosen , the rule is in the end choose only in which the effective price is low

---

## EDGE CASES & COMPLEX SCENARIOS (Write your solution below each case)

### CASE A: Live Log Case (Low Book Price + Delivery vs Higher Book Price + Free Delivery)

- **Compare price** = 152
- **Margin price (PO price)** = 165
- **Options:**
  - **Option 1:** Book price = 180 + FREE DELIVERY -> **Effective = 180** (5 days)
  - **Option 2:** Book price = 152 + 60 delivery -> **Effective = 212** (6 days)
  - **Option 3:** Book price = 140 + 80 delivery -> **Effective = 220** (6 days)
- **Question:** Which option should be chosen (Option 1, Option 2, Option 3, or REJECT / HIGH PRICE)?
- **YOUR SOLUTION:**
  ANS>> Option 1 is the correct solution here , i am thinking to not including delivery price when comparing with compare price and margin price , but in the end choose the minimum effective price ,here 180 was rejected because it was greater than margin price but in the end the effective price was less than option 2 and option 3 hence option 1 won

---

### CASE B: Same as Case A, but Option 2 & 3 do NOT exist (Only Free Delivery above Margin Price)

- **Compare price** = 152
- **Margin price (PO price)** = 165
- **Options:**
  - **Option 1:** Book price = 180 + FREE DELIVERY -> **Effective = 180** (5 days)
  - **Option 2:** Book price = 195 + FREE DELIVERY -> **Effective = 195** (5 days)
- **Question:** Here NO option has Book price <= 165. Should Option 1 (180) still be chosen, or should the book be REJECTED (`HIGH PRICE`)? Why?
- **YOUR SOLUTION:**
  ANS >> REJECTED because both prices 180 and 195 are greater than margin price 165
- ***

### CASE C: Low Book Price matches Compare Price, but CRAZY High Delivery Fee

- **Compare price** = 100
- **Margin price (PO price)** = 150
- **Options:**
  - **Option 1:** Book price = 100 + 250 delivery -> **Effective = 350** (5 days)
  - **Option 2:** Book price = 280 + FREE DELIVERY -> **Effective = 280** (5 days)
- **Question:** Option 1 has `Book price = 100` (matches Compare price!), and Option 2 has lower effective price (`280 < 350`). Should we buy Option 2 at ₹280 (even though Margin price is only ₹150), OR should BOTH be REJECTED (`HIGH PRICE`) because ₹280 and ₹350 are too expensive? What is the maximum total/effective price limit?
- **YOUR SOLUTION:**
  ANS >> here option 2 will be rejected initially because option price book price is less than margin price , but in the end option 2 has effective price less than option 1 hence option 2 should be chosen

---

### CASE D: Book Price is between Compare Price and Margin Price (How much profit buffer is needed?)

- **Compare price** = 200
- **Margin price (PO price)** = 250
- **Sub-case D1 (Only 1 option exists):**
  - **Option 1:** Book price = 220 + 40 delivery -> **Effective = 260** (5 days)
  - _(Here `Margin - Book = 250 - 220 = 30`, and `Effective = 260 > 250`)_
  - **YOUR SOLUTION FOR D1 (Add Option 1 or Reject?):**
    ANS >> option 1 accepted
- **Sub-case D2 (Only 1 option exists):**
  - **Option 1:** Book price = 245 + 40 delivery -> **Effective = 285** (5 days)
  - _(Here `Margin - Book = 250 - 245 = 5` rs only!)_
  - **YOUR SOLUTION FOR D2 (Add Option 1 or Reject? What is the minimum difference needed between Margin price and Book price?):**
    ANS >> option 1 accepted
    but the final answer is this **Option 1:** Book price = 220 + 40 delivery -> **Effective = 260**

---

### CASE E: Book Price > Margin Price, even with Free Delivery

- **Compare price** = 200
- **Margin price (PO price)** = 250
- **Options:**
  - **Option 1:** Book price = 260 + FREE DELIVERY -> **Effective = 260** (4 days)
  - **Option 2:** Book price = 270 + FREE DELIVERY -> **Effective = 270** (4 days)
- **Question:** In Sub-case D1, Book(220) + Del(40) = **260 total**. Here in Case E, Book(260) + FreeDel = **260 total** (exact same ₹260 out of your pocket!). Is Option 1 here Added to Cart or Rejected (`HIGH PRICE`)?
- **YOUR SOLUTION:**

> ANS : REJECTED because both price is greater than margin price

---

### CASE F: Exact Tie on Effective Price (Free Delivery vs Paid Delivery)

- **Compare price** = 200
- **Margin price (PO price)** = 250
- **Options:**
  - **Option 1:** Book price = 200 + FREE DELIVERY -> **Effective = 200** (5 days)
  - **Option 2:** Book price = 150 + 50 delivery -> **Effective = 200** (5 days)
- **Question:** Both cost ₹200 total and deliver in 5 days. Which one should win the tie-breaker: Option 1 (Free Delivery) or Option 2 (Lower Book Price + ₹50 Delivery)?
- **YOUR SOLUTION:**
  > > ANS : You could choose any of them

---

### CASE G: Paid Delivery (Fast) vs Free Delivery (Slow with Delay Penalty)

- **Compare price** = 200
- **Margin price (PO price)** = 250
- **Options:**
  - **Option 1:** Book price = 180 + 50 delivery = **230 total** in **5 days** (0 delay penalty -> **Effective = 230**)
  - **Option 2:** Book price = 190 + FREE DELIVERY = **190 total** in **16 days** (16d delay penalty is +30 -> **Effective = 220**)
  - **Option 3:** Book price = 190 + FREE DELIVERY = **190 total** in **25 days** (25d delay penalty is +103 -> **Effective = 293**)
- **Question:** Which option wins here (Option 1 or Option 2)? Does `Effective Price = Book Price + Delivery Fee + Delay Penalty` work as expected here?
- **YOUR SOLUTION:**
  > **AI ANS:** **Option 2 wins (Effective = ₹220)!**
  > - Both Option 1 (Book ₹180) and Option 2 (Book ₹190) are `<= Margin price (₹250)`.
  > - Using `Effective Price = Book Price + Delivery Fee + Delay Penalty`:
  >   - Option 1 = `180 + 50 + 0 = ₹230`
  >   - Option 2 = `190 + 0 + 30 = ₹220` (saving ₹40 on shipping outweighs the ₹30 penalty for waiting 16 days!)
  >   - Option 3 = `190 + 0 + 103 = ₹293`

---

### CASE H: What does "3. Delivery fee = 40" in your "New cases" header mean?

In your example at line 188, you wrote:

1. Compare price = 100
2. Margin price (PO price) = 150
3. Delivery fee = 40

- **Question:** Is `Delivery fee = 40` a fixed standard allowance/buffer you mentally add on top of Compare/Margin price (for example, `Margin 150 + 40 allowance = 190 max effective price`), or what role does that `40` play in your formula?
- **YOUR SOLUTION:**
  > **AI ANS:** As confirmed by your answers in Cases A–E, `Delivery fee` is **NOT** included when checking eligibility against `Compare price` and `Margin price`. Instead, the rule works in **2 exact steps**:
  >
  > ### THE FINAL 2-STEP RULE (Derived from your answers to Cases A–F):
  > 1. **Step 1 — Initial Eligibility Check (Book Price Only, Ignore Delivery Fee):**
  >    - Check all in-stock offers that deliver within the allowed delivery window (`<= 60 days`).
  >    - Check each offer's **Book Price only** against `Compare price` and `Margin price`.
  >    - **If NO offer passes Step 1** (like in **Case B** where 180 & 195 > 165, and **Case E** where 260 & 270 > 250) -> **The entire book is REJECTED (`HIGH PRICE`)**.
  > 2. **Step 2 — Final Winner Selection (Lowest Effective Price Wins Across All Valid-Delivery Offers):**
  >    - **If AT LEAST ONE offer passes Step 1** (for example, Option 2 in **Case A** with Book ₹152 <= ₹165, or Option 1 in **Case C** with Book ₹100 <= ₹150), the book is **unlocked to buy**!
  >    - Once unlocked, we compare **ALL** valid-delivery offers (even an offer like Option 1 in Case A `₹180 FreeDel` or Option 2 in Case C `₹280 FreeDel` that was initially above Margin price on book price, as long as its `Effective Price` is lower than the offer that passed Step 1!) and pick the one with the **lowest `Effective Price = Book Price + Delivery Fee + Delay Penalty`**.
