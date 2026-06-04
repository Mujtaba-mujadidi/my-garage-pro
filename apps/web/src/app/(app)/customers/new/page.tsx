import { redirect } from "next/navigation";

/** Legacy route — add customer is now a modal on /customers */
export default function NewCustomerRedirectPage() {
  redirect("/customers");
}
