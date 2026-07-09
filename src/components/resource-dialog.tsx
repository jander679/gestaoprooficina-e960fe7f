import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type Field = {
  name: string;
  label: string;
  type?: "text" | "number" | "textarea" | "email";
  required?: boolean;
  colSpan?: 1 | 2;
};

export function ResourceDialog<T extends Record<string, unknown>>({
  open, onOpenChange, title, fields, initial, onSubmit, submitting,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  fields: Field[];
  initial?: Partial<T>;
  onSubmit: (values: T) => void;
  submitting?: boolean;
}) {
  const [values, setValues] = useState<Record<string, unknown>>(initial ?? {});

  // Reset when opening
  const wasOpen = useOpenReset(open, () => setValues(initial ?? {}));
  void wasOpen;

  const canSubmit = fields.every((f) => !f.required || (values[f.name] !== undefined && values[f.name] !== ""));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          {fields.map((f) => (
            <div key={f.name} className={f.colSpan === 2 ? "col-span-2" : ""}>
              <Label>{f.label}{f.required && <span className="text-destructive"> *</span>}</Label>
              {f.type === "textarea" ? (
                <Textarea value={(values[f.name] as string) ?? ""} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} />
              ) : (
                <Input
                  type={f.type ?? "text"}
                  value={(values[f.name] as string | number) ?? ""}
                  onChange={(e) => setValues({ ...values, [f.name]: f.type === "number" ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value })}
                />
              )}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button onClick={() => onSubmit(values as T)} disabled={!canSubmit || submitting}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useRef } from "react";
function useOpenReset(open: boolean, cb: () => void) {
  const prev = useRef(false);
  useEffect(() => {
    if (open && !prev.current) cb();
    prev.current = open;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  return null;
}
