import { handleSubmitAnswer } from "@/server/api/submit-answer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleSubmitAnswer(request);
}
