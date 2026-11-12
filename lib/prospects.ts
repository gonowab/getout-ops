import { z } from "zod";

export const prospectStatus = z.enum(["red", "yellow", "green"]).nullable();
export const prospectSchema = z.object({
  name: z.string().trim().max(500).default(""),
  email: z.string().trim().max(500).default(""),
  contact_name: z.string().trim().max(500).default(""),
  notes: z.string().max(20000).default(""),
  contacted: z.boolean().default(false),
  status: prospectStatus.default(null),
});
export type ProspectInput = z.input<typeof prospectSchema>;
export type Prospect = z.output<typeof prospectSchema> & { id: string };
export const prospectStatusLabels = {
  red: "Tackat nej",
  yellow: "Tveksam",
  green: "Positiv",
} as const;
export const prospectStatusStyles = {
  red: "bg-red-50 text-red-800 border-red-200",
  yellow: "bg-yellow-50 text-yellow-900 border-yellow-300",
  green: "bg-green-50 text-green-800 border-green-200",
} as const;
