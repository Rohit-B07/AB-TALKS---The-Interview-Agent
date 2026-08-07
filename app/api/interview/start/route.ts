import { handleStartInterview } from "@/server/api/start-interview";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleStartInterview(request);
}
