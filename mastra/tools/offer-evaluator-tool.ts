import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export interface Offer {
  source: string;
  itemPrice: number;
  shippingFee: number;
  totalPrice: number;
  deliveryText: string;
  deliveryDays?: number | null;
  seller: string;
  condition: string;
  atcSelector?: string;
  offerIndex?: number;
}

export function parseDeliveryDays(deliveryText: string, referenceDate = new Date()) {
  if (!deliveryText || typeof deliveryText !== "string") {
    return { days: null, dateStr: "N/A", valid: false };
  }
  const text = deliveryText.toLowerCase();

  if (text.includes("today")) {
    return { days: 0, dateStr: "Today", valid: true };
  }
  if (text.includes("tomorrow")) {
    return { days: 1, dateStr: "Tomorrow", valid: true };
  }

  const inDaysMatch = text.match(/(?:in|within)\s+(\d+)(?:\s+to\s+\d+)?\s+days?/i);
  if (inDaysMatch) {
    const d = parseInt(inDaysMatch[1], 10);
    return { days: d, dateStr: `${d} days`, valid: true };
  }

  const monthMap: Record<string, number> = {
    jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2,
    apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6,
    aug: 7, august: 7, sep: 8, sept: 8, september: 8,
    oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
  };

  const monthsPattern =
    "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";

  const p1 = text.match(new RegExp(`(\\b\\d{1,2})(?:st|nd|rd|th)?\\s+(${monthsPattern})\\b`, "i"));
  const p2 = text.match(new RegExp(`\\b(${monthsPattern})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, "i"));

  let day: number | null = null;
  let monthName: string | null = null;

  if (p1 && monthMap[p1[2].toLowerCase()] !== undefined) {
    day = parseInt(p1[1], 10);
    monthName = p1[2].toLowerCase();
  } else if (p2 && monthMap[p2[1].toLowerCase()] !== undefined) {
    day = parseInt(p2[2], 10);
    monthName = p2[1].toLowerCase();
  }

  if (day !== null && monthName) {
    const month = monthMap[monthName];
    const year = referenceDate.getFullYear();
    const targetDate = new Date(year, month, day);

    if (targetDate.getTime() - referenceDate.getTime() < -180 * 86400000) {
      targetDate.setFullYear(year + 1);
    }

    const diffMs =
      targetDate.setHours(0, 0, 0, 0) - new Date(referenceDate).setHours(0, 0, 0, 0);
    const days = Math.round(diffMs / 86400000);
    return {
      days,
      dateStr: `${day} ${monthName.charAt(0).toUpperCase() + monthName.slice(1)}`,
      valid: true,
    };
  }

  return { days: null, dateStr: deliveryText.trim(), valid: false };
}

export function calculateDeliveryPenalty(
  deliveryDays: number | null | undefined,
  maxWindow = 40,
) {
  if (
    deliveryDays === null ||
    deliveryDays === undefined ||
    deliveryDays <= 10
  ) {
    return 0; // Tier 0: Days 1-10 are 100% penalty-free
  }
  if (deliveryDays > maxWindow) {
    return 0; // Exceeded max window, handled by passRule2
  }

  let totalPenalty = 0;

  // Tier 1: Days 11 to min(deliveryDays, 20) (Starts at ₹3.0, +₹0.8/day)
  const tier1Days = Math.min(deliveryDays, 20) - 10;
  for (let i = 1; i <= tier1Days; i++) {
    totalPenalty += 3.0 + (i - 1) * 0.8;
  }

  // Tier 2: Days 21 to min(deliveryDays, 30) (Starts at ₹5.0, +₹1.2/day)
  if (deliveryDays > 20) {
    const tier2Days = Math.min(deliveryDays, 30) - 20;
    for (let i = 1; i <= tier2Days; i++) {
      totalPenalty += 5.0 + (i - 1) * 1.2;
    }
  }

  // Tier 3: Days 31 to min(deliveryDays, 40) (Starts at ₹7.5, +₹1.5/day)
  if (deliveryDays > 30) {
    const tier3Days = Math.min(deliveryDays, 40) - 30;
    for (let i = 1; i <= tier3Days; i++) {
      totalPenalty += 7.5 + (i - 1) * 1.5;
    }
  }

  return parseFloat(totalPenalty.toFixed(1));
}

export function evaluateOffers(
  rawOffers: Offer[],
  targetPrice: number,
  isbnMatched: boolean,
  availabilityNotice: string | null = null,
  sellPrice: number = 0,
  minMarginBuffer: number = 50,
) {
  if (!isbnMatched) {
    return {
      status: "REJECTED",
      reason: "ISBN NOT MATCHED",
      chosenOffer: null,
      evaluatedOffers: [],
    };
  }

  if (!rawOffers || rawOffers.length === 0) {
    const reason = availabilityNotice ? `UNAVAILABLE: ${availabilityNotice}` : "UNAVAILABLE";
    return {
      status: "REJECTED",
      reason,
      availabilityNotice,
      chosenOffer: null,
      evaluatedOffers: [],
    };
  }

  const evaluatedOffers = rawOffers.map((offer) => {
    const deliveryEval = parseDeliveryDays(offer.deliveryText);
    const margin = sellPrice > 0 ? sellPrice - offer.itemPrice : null;
    const passStandardPrice = offer.itemPrice <= targetPrice;
    const passMarginBuffer = margin !== null && margin >= minMarginBuffer;
    const passRule1 = passStandardPrice || passMarginBuffer;

    const passRule2 =
      deliveryEval.valid && deliveryEval.days !== null ? deliveryEval.days <= 40 : true;

    let failureReason: string | null = null;
    if (!passRule1) failureReason = "HIGH PRICE";
    else if (!passRule2) failureReason = "DELIVERY DATE";

    const deliveryDays = deliveryEval.days;
    const deliveryPenalty = passRule2 ? calculateDeliveryPenalty(deliveryDays, 40) : 0;
    const effectivePrice = offer.itemPrice + deliveryPenalty;

    return {
      ...offer,
      deliveryDays,
      deliveryDateFormatted: deliveryEval.dateStr,
      deliveryPenalty,
      effectivePrice,
      passRule1,
      passRule2,
      isQualified: passRule1 && passRule2,
      failureReason,
      margin,
      minMarginBuffer,
      passedByMargin: !passStandardPrice && passMarginBuffer,
      score: 0,
    };
  });

  const qualifiedOffers = evaluatedOffers.filter((o) => o.isQualified);

  if (qualifiedOffers.length > 0) {
    const bestEffectivePrice = Math.min(...qualifiedOffers.map((o) => o.effectivePrice));

    qualifiedOffers.forEach((o) => {
      const rawScore = bestEffectivePrice / Math.max(1, o.effectivePrice);
      o.score = Math.max(0, Math.min(1, parseFloat(rawScore.toFixed(2))));
    });

    qualifiedOffers.sort((a, b) => {
      if (Math.abs(b.score - a.score) > 0.0001) {
        return b.score - a.score;
      }
      if (Math.abs(a.itemPrice - b.itemPrice) > 0.01) {
        return a.itemPrice - b.itemPrice;
      }
      const aDays = a.deliveryDays ?? 999;
      const bDays = b.deliveryDays ?? 999;
      if (aDays !== bDays) {
        return aDays - bDays;
      }
      const isANew = (a.condition || "").toLowerCase().includes("new");
      const isBNew = (b.condition || "").toLowerCase().includes("new");
      if (isANew && !isBNew) return -1;
      if (!isANew && isBNew) return 1;
      return 0;
    });

    return {
      status: "QUALIFIED",
      reason: "ALL RULES PASSED",
      chosenOffer: qualifiedOffers[0],
      evaluatedOffers,
    };
  }

  const allHighPrice = evaluatedOffers.every((o) => !o.passRule1);
  const allBadDelivery = evaluatedOffers.every((o) => !o.passRule2);

  let reason = "HIGH PRICE";
  if (allBadDelivery && !allHighPrice) {
    reason = "DELIVERY DATE";
  } else if (allHighPrice) {
    reason = "HIGH PRICE";
  } else {
    reason = evaluatedOffers[0].failureReason || "HIGH PRICE";
  }

  return {
    status: "REJECTED",
    reason,
    chosenOffer: null,
    evaluatedOffers,
  };
}

// -------------------------------------------------------------
// MASTRA TOOL: offerEvaluatorTool
// -------------------------------------------------------------
export const offerEvaluatorTool = createTool({
  id: "offer-evaluator",
  description:
    "Evaluates scraped Amazon offers against Rule 1 (price ceiling or >= ₹50 margin gap), Rule 2 (delivery window <= 40 days), applies progressive delivery penalty and scores offers.",
  inputSchema: z.object({
    targetPrice: z.number().describe("The given maximum target ceiling price from the sheet"),
    sellPrice: z.number().optional().describe("The sell price in INR from the sheet to calculate margin buffer"),
    minMarginBuffer: z.number().optional().default(50).describe("Minimum profit margin gap in INR (Sell Price - raw Amazon item price)"),
    isbnMatched: z.boolean().describe("Whether the page ISBN verified successfully"),
    availabilityNotice: z.string().nullable().optional().describe("Amazon availability string if 0 offers"),
    offers: z.array(
      z.object({
        source: z.string(),
        itemPrice: z.number(),
        shippingFee: z.number(),
        totalPrice: z.number(),
        deliveryText: z.string(),
        seller: z.string(),
        condition: z.string(),
        atcSelector: z.string().optional(),
        offerIndex: z.number().optional(),
      }),
    ),
  }),
  outputSchema: z.object({
    status: z.enum(["QUALIFIED", "REJECTED"]),
    reason: z.string(),
    chosenOffer: z
      .object({
        source: z.string(),
        itemPrice: z.number(),
        shippingFee: z.number(),
        totalPrice: z.number(),
        deliveryText: z.string(),
        deliveryDays: z.number().nullable().optional(),
        deliveryDateFormatted: z.string().optional(),
        deliveryPenalty: z.number().optional(),
        effectivePrice: z.number().optional(),
        score: z.number().optional(),
        seller: z.string(),
        condition: z.string(),
        atcSelector: z.string().optional(),
        offerIndex: z.number().optional(),
      })
      .nullable(),
    evaluatedCount: z.number(),
  }),
  execute: async ({ targetPrice, sellPrice, minMarginBuffer = 50, isbnMatched, availabilityNotice, offers }) => {
    const result = evaluateOffers(
      offers as Offer[],
      targetPrice,
      isbnMatched,
      availabilityNotice || null,
      sellPrice || 0,
      minMarginBuffer,
    );
    return {
      status: result.status as "QUALIFIED" | "REJECTED",
      reason: result.reason,
      chosenOffer: result.chosenOffer,
      evaluatedCount: result.evaluatedOffers.length,
    };
  },
});
