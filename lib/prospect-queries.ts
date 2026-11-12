import "server-only";
import { sql } from "@/lib/db";
import type { Prospect } from "@/lib/prospects";

export async function getProspects() {
  return sql<
    Prospect[]
  >`select id,name,email,contact_name,notes,contacted,status from reseller_prospects order by lower(name),created_at`;
}
