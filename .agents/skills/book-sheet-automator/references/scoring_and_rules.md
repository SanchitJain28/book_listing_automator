# Amazon Offer Evaluation Rules & Scoring System

## 1. Filter Rules (Pass/Fail)

### Rule 1: Price Ceiling & Margin Buffer
An offer qualifies under Rule 1 if EITHER condition is met:
- **Path A (Standard)**: `itemPrice <= targetPrice` (Compare Price from Google Sheet).
- **Path B (Margin Buffer)**: `itemPrice > targetPrice`, but `sellPrice - itemPrice >= minMarginBuffer` (Default: ₹1, configured in `scraper_config.json`).
  - `sellPrice` is taken from `PO Price (INR)` or `Sell (INR)` in the sheet.
  - `itemPrice` is the raw Amazon item price (excluding shipping/delivery penalty).
- If neither condition is met, the offer is disqualified with reason: `HIGH PRICE`.

### Rule 2: Delivery Window Limit
- **Max Window**: `deliveryDays <= 60 days` (or `maxDeliveryDays` in `scraper_config.json`).
- If delivery takes more than 60 days or is invalid, the offer is disqualified with reason: `DELIVERY DATE`.

### Other Disqualifications
- If page ISBN does not match target ISBN: `ISBN NOT MATCHED`.
- If listing is out of stock / 0 offers: `UNAVAILABLE`.

---

## 2. Progressive Delivery Penalty Table (60-Day Window)

Delivery penalties are applied on top of raw item price to calculate the **Effective Price**:

$$\text{Effective Price} = \text{itemPrice} + \text{Delivery Penalty}$$

- **Tier 0 (Days 1 to 15)**: **₹0 Penalty** (15-day penalty-free grace period).
- **Tier 1 (Days 16 to 30)**: Starts at **₹3.0** on Day 16, adding **+₹0.8** each progressive day:
  - Day 16: +₹3.0 -> Total = **₹3.0**
  - Day 17: +₹3.8 -> Total = **₹6.8**
  - Day 18: +₹4.6 -> Total = **₹11.4**
  - Day 20: +₹6.2 -> Total = **₹23.0**
  - Day 25: +₹10.2 -> Total = **₹66.0**
  - Day 30: +₹14.2 -> Total = **₹129.0**
- **Tier 2 (Days 31 to 45)**: Starts at **₹5.0** on Day 31, adding **+₹1.2** each progressive day:
  - Day 31: +₹5.0 -> Total = **₹134.0**
  - Day 35: +₹9.8 -> Total = **₹166.0**
  - Day 40: +₹15.8 -> Total = **₹233.0**
  - Day 45: +₹21.8 -> Total = **₹330.0**
- **Tier 3 (Days 46 to 60)**: Starts at **₹7.5** on Day 46, adding **+₹1.5** each progressive day:
  - Day 46: +₹7.5 -> Total = **₹337.5**
  - Day 50: +₹13.5 -> Total = **₹382.5**
  - Day 55: +₹21.0 -> Total = **₹472.5**
  - Day 60: +₹28.5 -> Total = **₹600.0**
- **Days > 60**: Disqualified (`DELIVERY DATE`).

---

## 3. Relative Scoring Formula (Range: 0.00 to 1.00)

Every qualified offer receives a score measuring its cost-efficiency relative to the best available offer:

$$\text{Score} = \frac{\text{bestEffectivePrice}}{\text{effectivePrice}}$$

- **Optimal Offer (Lowest Effective Price)**: $\text{Score} = \mathbf{1.00}$ (Winner).
- **Single Available Offer**: Automatically receives $\text{Score} = \mathbf{1.00}$.
- **Competing Offers**: Scale smoothly between $0.00$ and $1.00$.

---

## 4. Tie-Breaker Precedence
1. Highest `Score` (lowest `effectivePrice`).
2. Lowest raw `itemPrice`.
3. Earliest delivery date (lowest `deliveryDays`).
4. Condition: `New` preferred over `Used`.
5. Top/first listed offer in Amazon AOD.
