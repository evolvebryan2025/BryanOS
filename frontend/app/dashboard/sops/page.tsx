"use client";

import { redirect } from "next/navigation";

export default function SopsPage() {
  // SOPs are handled within the Team Hub page
  redirect("/dashboard/team");
}
