import { createMcpHandler } from "mcp-handler";
import { registerAllTools } from "@/lib/tools";
import { setSessionApiKey } from "@/lib/opendart/client";

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
    return new Response("Unauthorized (token required)", { status: 401 });
  }
  const apiKey = url.searchParams.get("opendart_key");
  if (apiKey) {
    setSessionApiKey(apiKey);
  }
  return mcpHandler(req);
}

export { handler as GET, handler as POST, handler as DELETE };
