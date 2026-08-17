import { Suspense } from "react";
import { RecommendForm } from "@/components/venue/recommend-form";

export default function Page() {
  return (
    <Suspense>
      <RecommendForm />
    </Suspense>
  );
}
