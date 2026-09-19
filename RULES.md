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
- **Rule 1 (Price Ceiling):** `itemPrice <= targetPrice` (Purely item price; `shippingFee` has 0 contribution). If exceeded -> Disqualified (`HIGH PRICE`).
- **Rule 2 (Delivery Limit):** `deliveryDays <= 14 days`. If exceeded -> Disqualified (`DELIVERY DATE`).
- **Stock Check:** If out of stock -> Disqualified (`UNAVAILABLE`).
- **ISBN Check:** If ISBN mismatch -> Disqualified (`ISBN NOT MATCHED`).

## 2. Progressive Delivery Penalty Table
- Days 1 to 7: **Rs 0 Penalty** (relative 7-day grace period for 14-day max window).
- Days 8 to 14: Starts at **Rs 7.5** on Day 8, increasing by **+Rs 2.5** each progressive day:
  - Day 8 (extra 1): Rs 7.5 -> Total Penalty = **Rs 7.5**
  - Day 9 (extra 2): Rs 7.5 + Rs 10.0 -> Total Penalty = **Rs 17.5**
  - Day 10 (extra 3): Rs 17.5 + Rs 12.5 -> Total Penalty = **Rs 30.0**
  - Day 11 (extra 4): Rs 30.0 + Rs 15.0 -> Total Penalty = **Rs 45.0**
  - Day 12 (extra 5): Rs 45.0 + Rs 17.5 -> Total Penalty = **Rs 62.5**
  - Day 13 (extra 6): Rs 62.5 + Rs 20.0 -> Total Penalty = **Rs 82.5**
  - Day 14 (extra 7): Rs 82.5 + Rs 22.5 -> Total Penalty = **Rs 105.0**

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
