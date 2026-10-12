export * from "./corpus";
export * from "./datasets";
export * from "./people";
export * from "./questions";
export * from "./workflows";

/** Every seeded record carries this label; real telemetry uses "LIVE". */
export const SEED_LABEL = "DEMO" as const;
