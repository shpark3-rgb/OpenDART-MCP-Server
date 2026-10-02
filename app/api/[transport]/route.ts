import { createMcpHandler } from "mcp-handler";
import { registerAllTools } from "@/lib/tools";
import { runWithRequestApiKey } from "@/lib/opendart/client";

const mcpHandler = createMcpHandler(
  (server) => {
    registerAllTools(server);
  },
  {
    capabilities: {},
  },
  {
    basePath: "/api",
    maxDuration: 60,
    verboseLogs: false,
  }
);

async function handler(req: Request) {
  const url = new URL(req.url);
  // 팀 비밀번호: Vercel 환경변수 FOOTING_TOKEN이 설정돼 있으면 ?token= 값이 같아야만 허용
  const required = process.env.FOOTING_TOKEN;
  if (required && url.searchParams.get("token") !== required) {
    // 401을 돌려주면 Claude가 OAuth 로그인 절차를 시도하다 실패하므로 403으로 거절한다
    return new Response("Forbidden (team token required: add ?token=... to the connector URL)", { status: 403 });
  }
  const apiKey = url.searchParams.get("opendart_key");
  return runWithRequestApiKey(apiKey, () => mcpHandler(req));
}

// Without an explicit HEAD export, Next.js routes HEAD to the GET handler and
// mcp-handler never finishes the response, so the function hangs until its
// timeout. Answer HEAD immediately with the same 405 that GET returns.
function head() {
  return new Response(null, { status: 405, headers: { Allow: "POST, DELETE" } });
}

export { handler as GET, handler as POST, handler as DELETE, head as HEAD };
