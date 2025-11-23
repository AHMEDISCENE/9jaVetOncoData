import { useRoute } from "wouter";
import CaseWizard from "@/components/case-wizard";

export default function EditCase() {
  const [, params] = useRoute("/cases/:id/edit");
  const caseId = params?.id;

  if (!caseId) {
    return <div className="p-4 sm:p-6">Invalid case ID</div>;
  }

  return (
    <div className="p-4 sm:p-6">
      <CaseWizard caseId={caseId} />
    </div>
  );
}
