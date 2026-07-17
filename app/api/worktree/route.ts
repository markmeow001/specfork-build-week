import { worktreeDemoReport } from "../../worktree-demo-report";

export async function GET() {
  return Response.json(worktreeDemoReport, {
    headers: {
      "cache-control": "public, max-age=300",
    },
  });
}
