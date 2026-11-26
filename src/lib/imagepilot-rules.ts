import { z } from "zod";

export const IMAGEPILOT_MAX_PINS = 30;
export const imagePilotCardLimit = z.number().int().min(1).max(IMAGEPILOT_MAX_PINS).default(IMAGEPILOT_MAX_PINS);