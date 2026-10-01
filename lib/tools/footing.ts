import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getJson, resolveApiKey } from "@/lib/opendart/client";
import { formatApiError, isNoData } from "@/lib/opendart/errors";

/**
 * 감사보고서 풋팅용 간단 조회 (토큰 절약).
 * fnlttSinglAcntAll(전체 재무제표)에서 재무제표 한 종류·금액 열 하나만 골라
 * "계정명<TAB>금액" 줄로만 돌려준다. 전체 표 대비 출력이 수십분의 1.
 */
export function registerFootingTools(server: McpServer) {
  server.registerTool(
    "opendart_footing_compact",
    {
      title: "풋팅용 재무제표 간단 조회 (Compact statement for audit footing)",
      description: `Return ONE statement (BS/IS/CIS/CF/SCE) of a company's full financial statement as compact
"account_nm<TAB>amount" lines (KRW, raw integers). Use this instead of opendart_full_financial_statement
when only amounts are needed (e.g. tie-out of prior-period figures) - far fewer tokens.
For prior year-end balance sheet: reprt_code=11011, bsns_year=<prior fiscal year>, sj_div=BS, amount=thstrm_amount.
For prior half-year P&L: reprt_code=11012, bsns_year=<prior year>, sj_div=CIS or IS, amount=thstrm_add_amount (cumulative).`,
      inputSchema: {
        corp_code: z.string().length(8).describe("8-digit company code (use opendart_search_company first)"),
        bsns_year: z.string().regex(/^\d{4}$/).describe("Fiscal year the report COVERS (YYYY)"),
        reprt_code: z.enum(["11011", "11012", "11013", "11014"]).describe("11011=Annual, 11012=Semi-annual, 11013=Q1, 11014=Q3"),
        fs_div: z.enum(["OFS", "CFS"]).default("CFS").describe("OFS=별도, CFS=연결"),
        sj_div: z.enum(["BS", "IS", "CIS", "CF", "SCE"]).default("BS").describe("BS=재무상태표, IS=손익, CIS=포괄손익, CF=현금흐름, SCE=자본변동"),
        amount: z.enum(["thstrm_amount", "thstrm_add_amount", "frmtrm_amount", "frmtrm_add_amount", "bfefrmtrm_amount"])
          .default("thstrm_amount").describe("thstrm=당기(말), _add=누적, frmtrm=전기"),
        api_key: z.string().optional().describe("Optional: your own OpenDART API key"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (params: Record<string, unknown>) => {
      try {
        const key = resolveApiKey(params.api_key as string | undefined);
        const data = await getJson("fnlttSinglAcntAll", {
          corp_code: params.corp_code as string,
          bsns_year: params.bsns_year as string,
          reprt_code: params.reprt_code as string,
          fs_div: (params.fs_div as string) || "CFS",
        }, key);
        if (isNoData(data.status as string)) {
          return { content: [{ type: "text" as const, text: "No data / 조회된 데이터 없음 (fs_div·reprt_code·연도 확인)" }] };
        }
        const sj = (params.sj_div as string) || "BS";
        const field = (params.amount as string) || "thstrm_amount";
        const rows = (data.list as Array<Record<string, string>>).filter((r) => r.sj_div === sj);
        const head = rows[0] || {};
        const lines = rows.map((r) => {
          const v = String(r[field] ?? "").replace(/,/g, "").trim();
          return `${r.account_nm}\t${v === "" ? "-" : v}`;
        });
        const header = `# ${sj} ${params.fs_div} ${params.bsns_year} ${params.reprt_code} ${field} rcept_no=${head.rcept_no ?? ""} currency=${head.currency ?? "KRW"} rows=${lines.length}`;
        return { content: [{ type: "text" as const, text: [header, ...lines].join("\n") }] };
      } catch (err) {
        return { content: [{ type: "text" as const, text: formatApiError(err) }], isError: true };
      }
    }
  );
}
