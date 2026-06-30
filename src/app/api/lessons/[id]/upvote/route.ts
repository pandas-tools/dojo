import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { scopedDb } from "@/lib/db/scoped";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user || !session.user.clientId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;

  try {
    const sdb = scopedDb({
      id: session.user.id,
      clientId: session.user.clientId,
      role: "employee",
    });
    const { upvoted } = await sdb.upvotes.toggle(id);
    return NextResponse.json({ ok: true, upvoted });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
