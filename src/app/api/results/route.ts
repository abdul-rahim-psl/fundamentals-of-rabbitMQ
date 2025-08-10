import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "data", "processed.json");
    if (!fs.existsSync(filePath)) {
      return NextResponse.json([]);
    }
    const raw = fs.readFileSync(filePath, "utf8");
    const data = JSON.parse(raw);
    return NextResponse.json(data);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to read results";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
