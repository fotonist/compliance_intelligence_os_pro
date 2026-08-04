import { redirect } from "next/navigation";

export default function HomePage() {
  // Root URL'yi direkt login'e gönderiyoruz
  redirect("/login");
}
