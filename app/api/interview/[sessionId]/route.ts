import { handleGetSession } from "@/server/api/get-session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await context.params;
  return handleGetSession(_request, sessionId);
}
