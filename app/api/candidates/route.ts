import { handleListCandidates } from "@/server/api/list-candidates";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return handleListCandidates();
}
