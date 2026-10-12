"use client";
import Link from "next/link";

export function Landing() {
  return (
    <main style={{ padding: 48 }}>
      <h1>Atlas Studio</h1>
      <Link href="/app/">Open the demo</Link>
    </main>
  );
}
