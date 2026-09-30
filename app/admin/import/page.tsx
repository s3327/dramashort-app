import { Upload } from "lucide-react";
import AdminPlaceholderPage from "@/components/admin/AdminPlaceholderPage";

export default function AdminImportPage() {
  return (
    <AdminPlaceholderPage
      title="Import"
      description="Bulk import titles, episodes, and metadata from external sources like DramaBoss."
      Icon={Upload}
    />
  );
}
