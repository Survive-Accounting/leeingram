import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye } from "lucide-react";
import { VA_ROLE_LABELS } from "@/hooks/useVaAccount";

const PREVIEW_ROLES = [
  { value: "admin", label: "Admin (Full Access)" },
  { value: "content_creation_va", label: "Content Creation VA" },
  { value: "sheet_prep_va", label: "Sheet Prep VA" },
  { value: "lead_va", label: "Lead VA" },
];

interface Props {
  previewRole: string;
  onRoleChange: (role: string) => void;
}

export function AdminRoleSwitcher({ previewRole, onRoleChange }: Props) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-2.5 py-1.5">
      <Eye className="h-3.5 w-3.5 text-primary shrink-0" />
      <span className="text-[10px] text-primary font-medium whitespace-nowrap">Preview as:</span>
      <Select value={previewRole} onValueChange={onRoleChange}>
        <SelectTrigger className="h-6 text-[11px] w-40 bg-transparent border-primary/20 text-foreground p-1 px-2">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PREVIEW_ROLES.map((r) => (
            <SelectItem key={r.value} value={r.value} className="text-xs">
              {r.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
