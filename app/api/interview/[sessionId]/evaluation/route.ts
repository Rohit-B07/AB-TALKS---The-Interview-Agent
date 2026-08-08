import { handleGetFinalEvaluation } from "@/server/api/get-evaluation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await context.params;
  return handleGetFinalEvaluation(_request, sessionId);
}
