import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveUnit } from "@/hooks/use-active-unit";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  ChevronLeft, ChevronRight, Plus, Clock, User, Car, Trash2, Edit, Calendar as CalendarIcon, X,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/agenda")({
  head: () => ({ meta: [{ title: "Agenda — OficinaPro" }] }),
  component: AgendaPage,
});

/* ─── helpers ─── */
const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function startDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function isSameDay(d1: Date, d2: Date) {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

function fmtTime(d: string) {
  return new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

type Appointment = {
  id: string;
  unit_id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  status: string;
  customer_id: string | null;
  vehicle_id: string | null;
  mecanico_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  customers?: { nome: string } | null;
  vehicles?: { placa: string | null; modelo: string | null } | null;
};

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  agendado: { label: "Agendado", variant: "default" },
  concluido: { label: "Concluído", variant: "secondary" },
  cancelado: { label: "Cancelado", variant: "destructive" },
};

/* ─── main component ─── */
function AgendaPage() {
  const { activeUnitId } = useActiveUnit();
  const { user } = useAuth();
  const qc = useQueryClient();

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<Date | null>(today);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailAppt, setDetailAppt] = useState<Appointment | null>(null);
  const [editMode, setEditMode] = useState(false);

  // Date range for query (first of month to last)
  const rangeStart = new Date(viewYear, viewMonth, 1).toISOString();
  const rangeEnd = new Date(viewYear, viewMonth + 1, 0, 23, 59, 59).toISOString();

  /* ─── queries ─── */
  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["appointments", activeUnitId, viewYear, viewMonth],
    enabled: !!activeUnitId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*,customers(nome),vehicles(placa,modelo)")
        .eq("unit_id", activeUnitId!)
        .gte("start_time", rangeStart)
        .lte("start_time", rangeEnd)
        .order("start_time", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Appointment[];
    },
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["agenda-customers", activeUnitId],
    enabled: !!activeUnitId,
    queryFn: async () => {
      const { data } = await supabase.from("customers").select("id,nome").eq("unit_id", activeUnitId!).order("nome");
      return data ?? [];
    },
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ["agenda-vehicles", activeUnitId],
    enabled: !!activeUnitId,
    queryFn: async () => {
      const { data } = await supabase.from("vehicles").select("id,placa,modelo,customer_id").eq("unit_id", activeUnitId!).order("placa");
      return data ?? [];
    },
  });

  /* Group appointments by day */
  const apptsByDay = useMemo(() => {
    const map: Record<number, Appointment[]> = {};
    for (const a of appointments) {
      const day = new Date(a.start_time).getDate();
      if (!map[day]) map[day] = [];
      map[day].push(a);
    }
    return map;
  }, [appointments]);

  /* Selected date appointments */
  const selectedAppts = useMemo(() => {
    if (!selectedDate) return [];
    return appointments.filter(a => isSameDay(new Date(a.start_time), selectedDate));
  }, [appointments, selectedDate]);

  /* ─── mutations ─── */
  const createMut = useMutation({
    mutationFn: async (form: FormState) => {
      const { error } = await supabase.from("appointments").insert({
        unit_id: activeUnitId!,
        title: form.title,
        description: form.description || null,
        start_time: new Date(`${form.date}T${form.startTime}`).toISOString(),
        end_time: new Date(`${form.date}T${form.endTime}`).toISOString(),
        customer_id: form.customerId || null,
        vehicle_id: form.vehicleId || null,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointments"] });
      toast.success("Agendamento criado com sucesso!");
      setDialogOpen(false);
    },
    onError: () => toast.error("Erro ao criar agendamento"),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, form }: { id: string; form: FormState }) => {
      const { error } = await supabase.from("appointments").update({
        title: form.title,
        description: form.description || null,
        start_time: new Date(`${form.date}T${form.startTime}`).toISOString(),
        end_time: new Date(`${form.date}T${form.endTime}`).toISOString(),
        status: form.status,
        customer_id: form.customerId || null,
        vehicle_id: form.vehicleId || null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointments"] });
      toast.success("Agendamento atualizado!");
      setDetailAppt(null);
      setEditMode(false);
    },
    onError: () => toast.error("Erro ao atualizar"),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("appointments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointments"] });
      toast.success("Agendamento excluído!");
      setDetailAppt(null);
    },
    onError: () => toast.error("Erro ao excluir"),
  });

  /* ─── calendar nav ─── */
  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }
  function goToday() {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setSelectedDate(today);
  }

  /* ─── calendar grid ─── */
  const totalDays = daysInMonth(viewYear, viewMonth);
  const startDay = startDayOfWeek(viewYear, viewMonth);
  const prevMonthDays = viewMonth === 0 ? daysInMonth(viewYear - 1, 11) : daysInMonth(viewYear, viewMonth - 1);
  
  const cells: { day: number; current: boolean }[] = [];
  // Previous month trailing days
  for (let i = startDay - 1; i >= 0; i--) {
    cells.push({ day: prevMonthDays - i, current: false });
  }
  // Current month days
  for (let d = 1; d <= totalDays; d++) {
    cells.push({ day: d, current: true });
  }
  // Next month leading days
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    cells.push({ day: d, current: false });
  }

  if (!activeUnitId) {
    return (
      <div>
        <PageHeader title="Agenda" />
        <p className="text-muted-foreground">Selecione uma unidade para visualizar a agenda.</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Agenda"
        subtitle="Gerencie os agendamentos da oficina"
        actions={
          <Button onClick={() => { setEditMode(false); setDialogOpen(true); }} className="gap-2">
            <Plus className="h-4 w-4" /> Novo Agendamento
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* ─── Calendar ─── */}
        <div className="rounded-xl border bg-card shadow-sm">
          {/* Nav header */}
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={prevMonth} className="h-8 w-8">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={nextMonth} className="h-8 w-8">
                <ChevronRight className="h-4 w-4" />
              </Button>
              <h2 className="ml-2 font-display text-lg font-semibold">
                {MONTHS[viewMonth]} {viewYear}
              </h2>
            </div>
            <Button variant="ghost" size="sm" onClick={goToday}>
              Hoje
            </Button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 border-b">
            {DAYS.map(d => (
              <div key={d} className="py-2 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {cells.map((cell, idx) => {
              const isToday = cell.current && isSameDay(new Date(viewYear, viewMonth, cell.day), today);
              const isSelected = cell.current && selectedDate && isSameDay(new Date(viewYear, viewMonth, cell.day), selectedDate);
              const dayAppts = cell.current ? (apptsByDay[cell.day] ?? []) : [];
              const activeAppts = dayAppts.filter(a => a.status !== "cancelado");

              return (
                <button
                  key={idx}
                  onClick={() => {
                    if (cell.current) setSelectedDate(new Date(viewYear, viewMonth, cell.day));
                  }}
                  className={`relative flex min-h-[80px] flex-col items-start border-b border-r p-1.5 text-left transition-colors
                    ${!cell.current ? "bg-muted/30 text-muted-foreground/50" : "hover:bg-accent/30 cursor-pointer"}
                    ${isSelected ? "bg-primary/10 ring-2 ring-primary ring-inset" : ""}
                  `}
                >
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium
                    ${isToday ? "bg-primary text-primary-foreground" : ""}
                  `}>
                    {cell.day}
                  </span>
                  {activeAppts.length > 0 && (
                    <div className="mt-0.5 flex w-full flex-col gap-0.5">
                      {activeAppts.slice(0, 3).map(a => (
                        <div
                          key={a.id}
                          className={`truncate rounded px-1 py-0.5 text-[10px] font-medium leading-tight
                            ${a.status === "concluido"
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                              : "bg-primary/15 text-primary"
                            }
                          `}
                        >
                          {fmtTime(a.start_time)} {a.title}
                        </div>
                      ))}
                      {activeAppts.length > 3 && (
                        <span className="px-1 text-[10px] text-muted-foreground">
                          +{activeAppts.length - 3} mais
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ─── Daily Sidebar ─── */}
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-sm font-semibold">
                {selectedDate
                  ? selectedDate.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })
                  : "Selecione um dia"}
              </h3>
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : selectedAppts.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center">
                <CalendarIcon className="mx-auto h-8 w-8 text-muted-foreground/50" />
                <p className="mt-2 text-sm text-muted-foreground">Nenhum agendamento neste dia</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => { setEditMode(false); setDialogOpen(true); }}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" /> Agendar
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {selectedAppts.map(a => {
                  const st = STATUS_MAP[a.status] ?? STATUS_MAP.agendado;
                  return (
                    <button
                      key={a.id}
                      onClick={() => { setDetailAppt(a); setEditMode(false); }}
                      className="group flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors hover:bg-accent/50"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{a.title}</span>
                        <Badge variant={st.variant} className="text-[10px]">{st.label}</Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {fmtTime(a.start_time)} - {fmtTime(a.end_time)}
                        </span>
                        {a.customers?.nome && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {a.customers.nome}
                          </span>
                        )}
                        {a.vehicles?.placa && (
                          <span className="flex items-center gap-1">
                            <Car className="h-3 w-3" />
                            {a.vehicles.placa}
                          </span>
                        )}
                      </div>
                      {a.description && (
                        <p className="text-xs text-muted-foreground/80 line-clamp-2">{a.description}</p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border bg-card p-3 text-center">
              <div className="text-xl font-semibold text-primary">
                {appointments.filter(a => a.status === "agendado").length}
              </div>
              <div className="text-[10px] text-muted-foreground">Agendados</div>
            </div>
            <div className="rounded-lg border bg-card p-3 text-center">
              <div className="text-xl font-semibold text-emerald-600">
                {appointments.filter(a => a.status === "concluido").length}
              </div>
              <div className="text-[10px] text-muted-foreground">Concluídos</div>
            </div>
            <div className="rounded-lg border bg-card p-3 text-center">
              <div className="text-xl font-semibold text-destructive">
                {appointments.filter(a => a.status === "cancelado").length}
              </div>
              <div className="text-[10px] text-muted-foreground">Cancelados</div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Create Dialog ─── */}
      <AppointmentFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        customers={customers}
        vehicles={vehicles}
        initialDate={selectedDate}
        onSubmit={(form) => createMut.mutate(form)}
        loading={createMut.isPending}
      />

      {/* ─── Detail/Edit Dialog ─── */}
      {detailAppt && (
        <Dialog open={!!detailAppt} onOpenChange={(o) => { if (!o) { setDetailAppt(null); setEditMode(false); } }}>
          <DialogContent className="max-w-lg">
            {editMode ? (
              <AppointmentEditForm
                appointment={detailAppt}
                customers={customers}
                vehicles={vehicles}
                onSubmit={(form) => updateMut.mutate({ id: detailAppt.id, form })}
                onCancel={() => setEditMode(false)}
                loading={updateMut.isPending}
              />
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    {detailAppt.title}
                    <Badge variant={STATUS_MAP[detailAppt.status]?.variant ?? "default"}>
                      {STATUS_MAP[detailAppt.status]?.label ?? detailAppt.status}
                    </Badge>
                  </DialogTitle>
                  <DialogDescription>
                    {new Date(detailAppt.start_time).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{fmtTime(detailAppt.start_time)} - {fmtTime(detailAppt.end_time)}</span>
                  </div>
                  {detailAppt.customers?.nome && (
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span>{detailAppt.customers.nome}</span>
                    </div>
                  )}
                  {detailAppt.vehicles && (detailAppt.vehicles.placa || detailAppt.vehicles.modelo) && (
                    <div className="flex items-center gap-2 text-sm">
                      <Car className="h-4 w-4 text-muted-foreground" />
                      <span>{[detailAppt.vehicles.placa, detailAppt.vehicles.modelo].filter(Boolean).join(" — ")}</span>
                    </div>
                  )}
                  {detailAppt.description && (
                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-sm">{detailAppt.description}</p>
                    </div>
                  )}
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                  <Button variant="destructive" size="sm" onClick={() => deleteMut.mutate(detailAppt.id)} disabled={deleteMut.isPending}>
                    <Trash2 className="mr-1 h-3.5 w-3.5" /> Excluir
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setEditMode(true)}>
                    <Edit className="mr-1 h-3.5 w-3.5" /> Editar
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

/* ─── Form State ─── */
type FormState = {
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  customerId: string;
  vehicleId: string;
};

function defaultForm(date: Date | null): FormState {
  const d = date ?? new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    title: "",
    description: "",
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    startTime: "08:00",
    endTime: "09:00",
    status: "agendado",
    customerId: "",
    vehicleId: "",
  };
}

/* ─── Create Form Dialog ─── */
function AppointmentFormDialog({
  open, onOpenChange, customers, vehicles, initialDate, onSubmit, loading,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  customers: { id: string; nome: string }[];
  vehicles: { id: string; placa: string | null; modelo: string | null; customer_id: string }[];
  initialDate: Date | null;
  onSubmit: (form: FormState) => void;
  loading: boolean;
}) {
  const [form, setForm] = useState<FormState>(() => defaultForm(initialDate));

  // Reset form when dialog opens
  const handleOpenChange = (o: boolean) => {
    if (o) setForm(defaultForm(initialDate));
    onOpenChange(o);
  };

  const filteredVehicles = form.customerId
    ? vehicles.filter(v => v.customer_id === form.customerId)
    : vehicles;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo Agendamento</DialogTitle>
          <DialogDescription>Preencha os dados do agendamento</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.title.trim()) { toast.error("Informe o título"); return; }
            onSubmit(form);
          }}
          className="space-y-4"
        >
          <div>
            <Label htmlFor="appt-title">Título *</Label>
            <Input id="appt-title" placeholder="Ex: Troca de óleo, Revisão geral..." value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="appt-date">Data *</Label>
              <Input id="appt-date" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="appt-start">Início *</Label>
              <Input id="appt-start" type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="appt-end">Fim *</Label>
              <Input id="appt-end" type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Cliente</Label>
              <Select value={form.customerId} onValueChange={v => setForm(f => ({ ...f, customerId: v, vehicleId: "" }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar cliente" /></SelectTrigger>
                <SelectContent>
                  {customers.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Veículo</Label>
              <Select value={form.vehicleId} onValueChange={v => setForm(f => ({ ...f, vehicleId: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar veículo" /></SelectTrigger>
                <SelectContent>
                  {filteredVehicles.map(v => (
                    <SelectItem key={v.id} value={v.id}>{v.placa ?? v.modelo ?? "Sem placa"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="appt-desc">Observações</Label>
            <Textarea id="appt-desc" placeholder="Detalhes do serviço..." rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Criar Agendamento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Edit Form (inline in detail dialog) ─── */
function AppointmentEditForm({
  appointment, customers, vehicles, onSubmit, onCancel, loading,
}: {
  appointment: Appointment;
  customers: { id: string; nome: string }[];
  vehicles: { id: string; placa: string | null; modelo: string | null; customer_id: string }[];
  onSubmit: (form: FormState) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const startDate = new Date(appointment.start_time);
  const pad = (n: number) => String(n).padStart(2, "0");
  const [form, setForm] = useState<FormState>({
    title: appointment.title,
    description: appointment.description ?? "",
    date: `${startDate.getFullYear()}-${pad(startDate.getMonth() + 1)}-${pad(startDate.getDate())}`,
    startTime: `${pad(startDate.getHours())}:${pad(startDate.getMinutes())}`,
    endTime: (() => { const e = new Date(appointment.end_time); return `${pad(e.getHours())}:${pad(e.getMinutes())}`; })(),
    status: appointment.status,
    customerId: appointment.customer_id ?? "",
    vehicleId: appointment.vehicle_id ?? "",
  });

  const filteredVehicles = form.customerId
    ? vehicles.filter(v => v.customer_id === form.customerId)
    : vehicles;

  return (
    <>
      <DialogHeader>
        <DialogTitle>Editar Agendamento</DialogTitle>
        <DialogDescription>Altere os dados do agendamento</DialogDescription>
      </DialogHeader>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.title.trim()) { toast.error("Informe o título"); return; }
          onSubmit(form);
        }}
        className="space-y-4"
      >
        <div>
          <Label>Título *</Label>
          <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label>Data *</Label>
            <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
          </div>
          <div>
            <Label>Início *</Label>
            <Input type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} />
          </div>
          <div>
            <Label>Fim *</Label>
            <Input type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} />
          </div>
        </div>

        <div>
          <Label>Status</Label>
          <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="agendado">Agendado</SelectItem>
              <SelectItem value="concluido">Concluído</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Cliente</Label>
            <Select value={form.customerId} onValueChange={v => setForm(f => ({ ...f, customerId: v, vehicleId: "" }))}>
              <SelectTrigger><SelectValue placeholder="Selecionar cliente" /></SelectTrigger>
              <SelectContent>
                {customers.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Veículo</Label>
            <Select value={form.vehicleId} onValueChange={v => setForm(f => ({ ...f, vehicleId: v }))}>
              <SelectTrigger><SelectValue placeholder="Selecionar veículo" /></SelectTrigger>
              <SelectContent>
                {filteredVehicles.map(v => (
                  <SelectItem key={v.id} value={v.id}>{v.placa ?? v.modelo ?? "Sem placa"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label>Observações</Label>
          <Textarea rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
