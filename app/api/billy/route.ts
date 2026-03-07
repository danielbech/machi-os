import { NextRequest, NextResponse } from "next/server";

const BILLY_BASE = "https://api.billysbilling.com/v2";
const TOKEN = process.env.BILLY_ACCESS_TOKEN;

const ALLOWED_ENDPOINTS = ["/organization", "/invoices", "/bills", "/salesTaxReturns", "/accounts", "/accountBalances"];

async function billyFetch(path: string, revalidate = 300) {
  const res = await fetch(`${BILLY_BASE}${path}`, {
    headers: { "X-Access-Token": TOKEN! },
    next: { revalidate },
  });
  if (!res.ok) {
    throw new Error(`Billy API ${res.status} ${res.statusText}`);
  }
  return res.json();
}

async function fetchAllPostings(orgId: string, accountId: string): Promise<number> {
  let balance = 0;
  let page = 1;
  let pageCount = 1;

  while (page <= pageCount) {
    const data = await billyFetch(
      `/postings?organizationId=${orgId}&accountId=${accountId}&pageSize=1000&page=${page}`,
      300,
    );
    pageCount = data.meta?.paging?.pageCount || 1;
    for (const p of data.postings || []) {
      balance += p.side === "debit" ? p.amount : -p.amount;
    }
    page++;
  }

  return balance;
}

async function handleAccountBalances(orgId: string) {
  // Get bank accounts
  const accountsData = await billyFetch(`/accounts?organizationId=${orgId}`);
  const bankAccounts = (accountsData.accounts || []).filter(
    (a: { isBankAccount: boolean }) => a.isBankAccount
  );

  // Fetch balances in parallel
  const balances = await Promise.all(
    bankAccounts.map(async (a: { id: string; name: string; accountNo: number }) => {
      const balance = await fetchAllPostings(orgId, a.id);
      return { id: a.id, name: a.name, accountNo: a.accountNo, balance };
    })
  );

  return { accounts: balances };
}

export async function GET(request: NextRequest) {
  if (!TOKEN) {
    return NextResponse.json({ error: "BILLY_ACCESS_TOKEN not configured" }, { status: 500 });
  }

  const endpoint = request.nextUrl.searchParams.get("endpoint");
  if (!endpoint || !ALLOWED_ENDPOINTS.includes(endpoint)) {
    return NextResponse.json({ error: "Invalid endpoint" }, { status: 400 });
  }

  try {
    // Special handler for account balances
    if (endpoint === "/accountBalances") {
      const orgId = request.nextUrl.searchParams.get("organizationId");
      if (!orgId) {
        return NextResponse.json({ error: "Missing organizationId" }, { status: 400 });
      }
      const data = await handleAccountBalances(orgId);
      return NextResponse.json(data);
    }

    // Forward all other query params to Billy
    const billyParams = new URLSearchParams();
    request.nextUrl.searchParams.forEach((value, key) => {
      if (key !== "endpoint") {
        billyParams.set(key, value);
      }
    });

    const billyUrl = `${BILLY_BASE}${endpoint}${billyParams.size > 0 ? `?${billyParams}` : ""}`;
    const res = await fetch(billyUrl, {
      headers: { "X-Access-Token": TOKEN },
      next: { revalidate: 300 },
    });
    if (!res.ok) {
      throw new Error(`Billy API ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Billy API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
