import { SavedList } from "@/components/venue/saved-list";
import { getSavedVenueStore } from "@/services/saved-venue-store";

export const dynamic = "force-dynamic";

export default function SavedPage() {
  const items = getSavedVenueStore().list();
  return <SavedList items={items} />;
}
