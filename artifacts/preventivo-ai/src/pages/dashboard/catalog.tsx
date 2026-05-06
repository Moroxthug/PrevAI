import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Download, Loader2, BookOpen, Tag, Ruler, Euro, X, Check, Import } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useListCatalogItems,
  getListCatalogItemsQueryKey,
  useCreateCatalogItem,
  useUpdateCatalogItem,
  useDeleteCatalogItem,
  useImportCatalogFromQuotes,
  useGetSubscription,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import type { CatalogItem } from "@workspace/api-client-react";

const UM_OPTIONS = ["mq", "ml", "mc", "cad", "ore", "kg", "a.c.", "pezzi", "kw", "lt", "t", "m", "%"];

const CATEGORIA_SUGGESTIONS = [
  "Tinteggiatura",
  "Demolizioni",
  "Opere edili",
  "Impianto elettrico",
  "Impianto idraulico",
  "Pavimentazioni",
  "Rivestimenti",
  "Infissi",
  "Coibentazione",
  "Carpenteria",
  "Manodopera",
  "Altro",
];

interface ItemFormData {
  nome: string;
  categoria: string;
  um: string;
  prezzoUnitario: string;
  note: string;
}

const EMPTY_FORM: ItemFormData = {
  nome: "",
  categoria: "",
  um: "cad",
  prezzoUnitario: "",
  note: "",
};

function formatCurrency(n: number) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n);
}

function ItemFormDialog({
  open,
  onClose,
  initial,
  onSave,
  isSaving,
  title,
}: {
  open: boolean;
  onClose: () => void;
  initial: ItemFormData;
  onSave: (data: ItemFormData) => void;
  isSaving: boolean;
  title: string;
}) {
  const [form, setForm] = useState<ItemFormData>(initial);

  const set = (k: keyof ItemFormData, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleOpenChange = (o: boolean) => {
    if (!o) { onClose(); }
  };

  const valid = form.nome.trim() && form.um.trim() && form.prezzoUnitario !== "" && !isNaN(Number(form.prezzoUnitario));

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Descrizione lavorazione *</Label>
            <Input
              placeholder="es. Tinteggiatura pareti interne"
              value={form.nome}
              onChange={e => set("nome", e.target.value)}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Unità di misura *</Label>
              <Select value={form.um} onValueChange={v => set("um", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UM_OPTIONS.map(u => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Prezzo unitario (€) *</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                placeholder="es. 12.50"
                value={form.prezzoUnitario}
                onChange={e => set("prezzoUnitario", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Select value={form.categoria || "__none__"} onValueChange={v => set("categoria", v === "__none__" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona categoria (opzionale)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Nessuna categoria</SelectItem>
                {CATEGORIA_SUGGESTIONS.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Note (opzionale)</Label>
            <Input
              placeholder="es. include materiali"
              value={form.note}
              onChange={e => set("note", e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>Annulla</Button>
          <Button onClick={() => onSave(form)} disabled={!valid || isSaving} className="gap-2">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Salva
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function CatalogPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: subscription } = useGetSubscription();
  const { data: items = [], isLoading } = useListCatalogItems();

  const createItem = useCreateCatalogItem();
  const updateItem = useUpdateCatalogItem();
  const deleteItem = useDeleteCatalogItem();
  const importFromQuotes = useImportCatalogFromQuotes();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const isPro = subscription?.isActive && subscription?.plan === "monthly_pro";

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListCatalogItemsQueryKey() });

  const handleCreate = (form: ItemFormData) => {
    createItem.mutate({
      data: {
        nome: form.nome.trim(),
        categoria: form.categoria.trim() || undefined,
        um: form.um.trim(),
        prezzoUnitario: Number(form.prezzoUnitario),
        note: form.note.trim() || undefined,
      }
    }, {
      onSuccess: () => {
        setIsCreateOpen(false);
        invalidate();
        toast({ title: "Voce aggiunta al listino" });
      },
      onError: () => toast({ title: "Errore", description: "Impossibile aggiungere la voce", variant: "destructive" }),
    });
  };

  const handleUpdate = (form: ItemFormData) => {
    if (!editingItem) return;
    updateItem.mutate({
      id: editingItem.id,
      data: {
        nome: form.nome.trim(),
        categoria: form.categoria.trim() || undefined,
        um: form.um.trim(),
        prezzoUnitario: Number(form.prezzoUnitario),
        note: form.note.trim() || undefined,
      }
    }, {
      onSuccess: () => {
        setEditingItem(null);
        invalidate();
        toast({ title: "Voce aggiornata" });
      },
      onError: () => toast({ title: "Errore", description: "Impossibile aggiornare la voce", variant: "destructive" }),
    });
  };

  const handleDelete = () => {
    if (!deletingId) return;
    deleteItem.mutate({ id: deletingId }, {
      onSuccess: () => {
        setDeletingId(null);
        invalidate();
        toast({ title: "Voce eliminata" });
      },
      onError: () => toast({ title: "Errore", description: "Impossibile eliminare la voce", variant: "destructive" }),
    });
  };

  const handleImport = () => {
    importFromQuotes.mutate(undefined, {
      onSuccess: (result) => {
        invalidate();
        if (result.imported === 0) {
          toast({ title: "Nessuna nuova voce trovata", description: "Tutte le lavorazioni dai tuoi preventivi sono già nel listino." });
        } else {
          toast({
            title: `${result.imported} voci importate`,
            description: result.skipped > 0 ? `${result.skipped} voci già presenti saltate.` : undefined,
          });
        }
      },
      onError: () => toast({ title: "Errore durante l'importazione", variant: "destructive" }),
    });
  };

  const groupedByCategory = items.reduce<Record<string, CatalogItem[]>>((acc, item) => {
    const cat = item.categoria ?? "Senza categoria";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const categories = Object.keys(groupedByCategory).sort((a, b) => {
    if (a === "Senza categoria") return 1;
    if (b === "Senza categoria") return -1;
    return a.localeCompare(b);
  });

  if (!isPro) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <BookOpen className="h-12 w-12 text-gray-300" />
        <h2 className="text-xl font-semibold text-gray-700">Listino Prezzi — Piano Pro</h2>
        <p className="text-gray-500 max-w-md">
          Il listino prezzi personalizzato è disponibile nel piano Pro. Attiva il piano Pro per gestire le tue lavorazioni e prezzi unitari, e farli usare dall'AI nei preventivi.
        </p>
        <Button onClick={() => window.location.href = "/dashboard/settings?tab=billing"} className="gap-2 mt-2">
          Scopri il Piano Pro
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Listino Prezzi</h1>
          <p className="text-muted-foreground mt-1">
            Gestisci le tue lavorazioni e prezzi unitari. L'AI li usa come riferimento quando genera nuovi preventivi.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            className="gap-2"
            onClick={handleImport}
            disabled={importFromQuotes.isPending}
          >
            {importFromQuotes.isPending
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Download className="h-4 w-4" />}
            Importa dai preventivi
          </Button>
          <Button className="gap-2" onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Aggiungi voce
          </Button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : items.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <BookOpen className="h-10 w-10 text-gray-300" />
            <div>
              <p className="font-medium text-gray-700">Il tuo listino è vuoto</p>
              <p className="text-sm text-gray-500 mt-1">
                Aggiungi le tue lavorazioni manualmente oppure importale dai preventivi già creati.
              </p>
            </div>
            <div className="flex gap-2 mt-2">
              <Button variant="outline" className="gap-2" onClick={handleImport} disabled={importFromQuotes.isPending}>
                {importFromQuotes.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Importa dai preventivi
              </Button>
              <Button className="gap-2" onClick={() => setIsCreateOpen(true)}>
                <Plus className="h-4 w-4" />
                Aggiungi voce
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Summary bar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Card className="p-4">
              <div className="text-2xl font-bold">{items.length}</div>
              <div className="text-sm text-muted-foreground">Voci totali</div>
            </Card>
            <Card className="p-4">
              <div className="text-2xl font-bold">{categories.filter(c => c !== "Senza categoria").length}</div>
              <div className="text-sm text-muted-foreground">Categorie</div>
            </Card>
            <Card className="p-4 col-span-2 sm:col-span-1">
              <div className="text-2xl font-bold">
                {formatCurrency(items.reduce((s, i) => s + i.prezzoUnitario, 0) / items.length)}
              </div>
              <div className="text-sm text-muted-foreground">Prezzo medio</div>
            </Card>
          </div>

          {/* Items by category */}
          {categories.map(cat => (
            <Card key={cat}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Tag className="h-4 w-4 text-violet-500" />
                  {cat}
                  <Badge variant="secondary" className="ml-auto">{groupedByCategory[cat].length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {groupedByCategory[cat].map(item => (
                    <div key={item.id} className="flex items-center gap-3 px-6 py-3 hover:bg-gray-50 transition-colors group">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{item.nome}</div>
                        {item.note && <div className="text-xs text-muted-foreground truncate">{item.note}</div>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className="text-xs font-mono">
                          <Ruler className="h-3 w-3 mr-1 opacity-60" />
                          {item.um}
                        </Badge>
                        <span className="text-sm font-semibold text-green-700 min-w-[80px] text-right">
                          {formatCurrency(item.prezzoUnitario)}
                        </span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => setEditingItem(item)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => setDeletingId(item.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <ItemFormDialog
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        initial={EMPTY_FORM}
        onSave={handleCreate}
        isSaving={createItem.isPending}
        title="Aggiungi voce al listino"
      />

      {/* Edit dialog */}
      {editingItem && (
        <ItemFormDialog
          open={!!editingItem}
          onClose={() => setEditingItem(null)}
          initial={{
            nome: editingItem.nome,
            categoria: editingItem.categoria ?? "",
            um: editingItem.um,
            prezzoUnitario: String(editingItem.prezzoUnitario),
            note: editingItem.note ?? "",
          }}
          onSave={handleUpdate}
          isSaving={updateItem.isPending}
          title="Modifica voce"
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deletingId} onOpenChange={o => { if (!o) setDeletingId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare questa voce?</AlertDialogTitle>
            <AlertDialogDescription>
              La voce verrà rimossa dal tuo listino. I preventivi già generati non saranno influenzati.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteItem.isPending}
            >
              {deleteItem.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
