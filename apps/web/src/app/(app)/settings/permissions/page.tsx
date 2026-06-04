import { redirect } from "next/navigation";

/** Roles UI lives on Settings → Roles & access tab. */
export default function SettingsPermissionsRedirect() {
  redirect("/settings?tab=roles");
}
