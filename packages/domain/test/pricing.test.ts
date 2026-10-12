import { describe, expect, it } from "vitest";
import { canReserve, computeCost, findModel, formatUsd, ledgerDedupeKey, normalizeAnthropicUsage, normalizeGeminiUsage, reservationUpperBound, tokenCostNanoUsd } from "../src";

const opus = findModel("anthropic:claude-opus-5-5")!.currentPrice!;
const haiku = findModel("anthropic:claude-haiku-5-5")!.currentPrice!;
const local = findModel("local:atlas-extractive-v1")!.currentPrice!;

describe("money", () => {
  it("computes exact nano-USD for sub-cent prices", () => {
    expect(tokenCostNanoUsd(1, "4")).toBe(4000n); // $4/MTok → 4e-6 USD
    expect(tokenCostNanoUsd(1_000_000, "0.125")).toBe(125_000_000n); // $0.125
    expect(tokenCostNanoUsd(3, "0.01")).toBe(30n);
  });
  it("formats with rounding only at display", () => {
    expect(formatUsd(125_000_000n)).toBe("$0.125");
    expect(formatUsd(12_345_678_900n)).toBe("$12.35");
    expect(formatUsd(0n)).toBe("$0.00");
  });
});

describe("Anthropic usage normalization (response.usage fixtures)", () => {
  it("does not double count cache or thinking", () => {
    // Shape from the Messages API: input_tokens is the uncached remainder; output includes thinking.
    const raw = {
      input_tokens: 1_200,
      cache_creation_input_tokens: 3_000,
      cache_read_input_tokens: 20_000,
      cache_creation: { ephemeral_5m_input_tokens: 3_000, ephemeral_1h_input_tokens: 0 },
      output_tokens: 900,
      output_tokens_details: { thinking_tokens: 600 },
    };
    const { usage, assumptions } = normalizeAnthropicUsage(raw);
    expect(assumptions).toEqual([]);
    expect(usage.promptTokensForTier).toBe(24_200);
    const cost = computeCost(usage, opus);
    // 1200*4 + 3000*5 + 20000*0.20 + 900*20 (USD/MTok) = 4800+15000+4000+18000 = 41,800 µUSD... in nano: ×1000/1000
    expect(cost.status).toBe("calculated");
    expect(cost.nanoUsd).toBe(String(1200 * 4000 + 3000 * 5000 + 20000 * 200 + 900 * 20000));
    // Thinking is informational only (inside output), never an extra line.
    expect(cost.lines.map((l) => l.category)).toEqual(["input", "cache_write_5m", "cache_read", "output"]);
  });

  it("marks missing usage as unknown, never zero", () => {
    const { usage, assumptions } = normalizeAnthropicUsage(null);
    const cost = computeCost(usage, opus, assumptions);
    expect(cost.status).toBe("unknown");
    expect(cost.nanoUsd).toBeNull();
  });

  it("estimates when TTL breakdown is absent", () => {
    const { usage, assumptions } = normalizeAnthropicUsage({ input_tokens: 10, cache_creation_input_tokens: 100, cache_read_input_tokens: 0, output_tokens: 5 });
    const cost = computeCost(usage, opus, assumptions);
    expect(cost.status).toBe("estimated");
    expect(cost.assumptions[0]).toMatch(/5-minute/);
  });

  it("applies Haiku 5.5 prompt-length tier including cache tokens", () => {
    const below = computeCost(normalizeAnthropicUsage({ input_tokens: 50_000, cache_read_input_tokens: 50_000, cache_creation_input_tokens: 0, output_tokens: 1000 }).usage, haiku);
    const above = computeCost(normalizeAnthropicUsage({ input_tokens: 50_000, cache_read_input_tokens: 50_001, cache_creation_input_tokens: 0, output_tokens: 1000 }).usage, haiku);
    expect(below.tierApplied).toBeNull();
    expect(above.tierApplied).toBe(100_000);
    expect(BigInt(above.nanoUsd!)).toBeGreaterThan(BigInt(below.nanoUsd!));
  });

  it("charges web search per 1k requests", () => {
    const { usage } = normalizeAnthropicUsage({ input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, server_tool_use: { web_search_requests: 3 } });
    const cost = computeCost(usage, opus);
    expect(cost.nanoUsd).toBe(String(30_000_000)); // 3 × $0.01
  });

  it("unknown tool charge → unknown cost", () => {
    const { usage } = normalizeAnthropicUsage({ input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, server_tool_use: { code_execution_requests: 1 } });
    expect(computeCost(usage, opus).status).toBe("unknown");
  });

  it("local adapter has no provider charge (distinct from unknown)", () => {
    const { usage } = normalizeAnthropicUsage({ input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 });
    const cost = computeCost(usage, local);
    expect(cost.status).toBe("no_provider_charge");
  });
});

describe("Gemini normalization (pending verification)", () => {
  it("counts cached prompt and thoughts once", () => {
    const { usage, assumptions } = normalizeGeminiUsage({ promptTokenCount: 1000, cachedContentTokenCount: 400, candidatesTokenCount: 200, thoughtsTokenCount: 300, totalTokenCount: 1500 });
    expect(usage.inputUncachedTokens).toBe(600);
    expect(usage.cacheReadTokens).toBe(400);
    expect(usage.outputTokens).toBe(500);
    expect(assumptions[0]).toMatch(/pending verification/);
    expect(computeCost(usage, null).status).toBe("unknown");
  });
});

describe("reservations & ledger", () => {
  it("reserves worst case before a call", () => {
    const bound = reservationUpperBound(opus, 10_000, 1_000)!;
    // input at the 5m write rate ($5) because it is higher than base input ($4)
    expect(bound).toBe(10_000n * 5000n + 1_000n * 20000n);
  });
  it("hard-stop budgets reject over-reservation", () => {
    const b = { limitNanoUsd: 1_000n, spentNanoUsd: 600n, reservedNanoUsd: 300n, hardStop: true };
    expect(canReserve(b, 100n).ok).toBe(true);
    expect(canReserve(b, 101n).ok).toBe(false);
  });
  it("dedupes only the same provider event; retries count separately", () => {
    expect(ledgerDedupeKey("anthropic", "req_1", "att_1")).toBe(ledgerDedupeKey("anthropic", "req_1", "att_2"));
    expect(ledgerDedupeKey("anthropic", "req_1", "att_1")).not.toBe(ledgerDedupeKey("anthropic", "req_2", "att_2"));
    expect(ledgerDedupeKey("anthropic", null, "att_1")).not.toBe(ledgerDedupeKey("anthropic", null, "att_2"));
  });
});
