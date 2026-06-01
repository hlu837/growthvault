import { useState } from "react";
import { CreditCard, Plus, Snowflake, XCircle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import DashboardLayout from "@/components/DashboardLayout";
import { useCards, useRequestCard, useUpdateCardStatus, Card } from "@/hooks/useCards";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

const Cards = () => {
  const { t } = useTranslation();
  const { data: cards, isLoading } = useCards();
  const requestCard = useRequestCard();
  const updateStatus = useUpdateCardStatus();
  const { toast } = useToast();
  
  const [newCardName, setNewCardName] = useState("");
  const [newCardType, setNewCardType] = useState<"virtual" | "physical">("virtual");
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleRequestCard = async () => {
    if (!newCardName.trim()) {
      toast({ title: t("common.error"), description: t("errors.fillAllFields"), variant: "destructive" });
      return;
    }
    try {
      await requestCard.mutateAsync({ cardType: newCardType, cardName: newCardName });
      toast({ title: t("common.success"), description: t("success.cardRequested") });
      setNewCardName("");
      setDialogOpen(false);
    } catch (error: any) {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
    }
  };

  const handleToggleFreeze = async (card: Card) => {
    try {
      const newStatus = card.status === "frozen" ? "active" : "frozen";
      await updateStatus.mutateAsync({ cardId: card.id, status: newStatus });
      toast({ 
        title: t("common.success"), 
        description: newStatus === "frozen" ? t("success.cardFrozen") : t("success.cardUnfrozen")
      });
    } catch (error: any) {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
    }
  };

  const handleCancelCard = async (cardId: string) => {
    try {
      await updateStatus.mutateAsync({ cardId, status: "cancelled" });
      toast({ title: t("common.success"), description: t("success.cardCancelled") });
    } catch (error: any) {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <span className="px-2 py-1 text-xs rounded-full bg-accent/20 text-accent">{t("cards.active")}</span>;
      case "pending":
        return <span className="px-2 py-1 text-xs rounded-full bg-yellow-500/20 text-yellow-400">{t("cards.pending")}</span>;
      case "frozen":
        return <span className="px-2 py-1 text-xs rounded-full bg-blue-500/20 text-blue-400">{t("cards.frozen")}</span>;
      case "cancelled":
        return <span className="px-2 py-1 text-xs rounded-full bg-destructive/20 text-destructive">{t("cards.cancelled")}</span>;
      default:
        return null;
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{t("cards.title")}</h1>
            <p className="text-muted-foreground mt-1">{t("cards.subtitle")}</p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                {t("cards.requestCard")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("cards.requestNewCard")}</DialogTitle>
                <DialogDescription>{t("cards.requestNewCardDesc")}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>{t("cards.cardName")}</Label>
                  <Input placeholder={t("cards.cardNamePlaceholder")} value={newCardName} onChange={(e) => setNewCardName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>{t("cards.cardType")}</Label>
                  <Select value={newCardType} onValueChange={(v) => setNewCardType(v as "virtual" | "physical")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="virtual">{t("cards.virtualCard")}</SelectItem>
                      <SelectItem value="physical">{t("cards.physicalCard")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full" onClick={handleRequestCard} disabled={requestCard.isPending}>
                  {requestCard.isPending ? t("cards.submitting") : t("cards.submitRequest")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="grid md:grid-cols-2 gap-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-48 bg-secondary/30 animate-pulse rounded-xl" />
            ))}
          </div>
        ) : cards && cards.length > 0 ? (
          <div className="grid md:grid-cols-2 gap-4">
            {cards.map((card) => (
              <div 
                key={card.id}
                className={`relative p-6 rounded-xl border ${
                  card.status === "cancelled" 
                    ? "bg-card/50 border-destructive/30" 
                    : card.status === "frozen"
                    ? "bg-gradient-to-br from-blue-900/40 to-blue-800/20 border-blue-500/30"
                    : "bg-gradient-to-br from-card to-secondary border-border"
                }`}
              >
                <div className="flex justify-between items-start mb-8">
                  <CreditCard className={`w-10 h-10 ${card.status === "active" ? "text-accent" : "text-muted-foreground"}`} />
                  {getStatusBadge(card.status)}
                </div>

                <div className="mb-6">
                  <div className="text-2xl font-mono tracking-widest mb-2">
                    •••• •••• •••• {card.card_number || "••••"}
                  </div>
                  <div className="text-sm text-muted-foreground">{card.card_name}</div>
                </div>

                <div className="flex justify-between items-center">
                  <div className="text-xs text-muted-foreground uppercase">{card.card_type} Card</div>
                  
                  {card.status !== "cancelled" && card.status !== "pending" && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => handleToggleFreeze(card)} disabled={updateStatus.isPending} className="gap-1 text-xs">
                        {card.status === "frozen" ? (
                          <><CheckCircle className="w-3 h-3" /> {t("cards.unfreeze")}</>
                        ) : (
                          <><Snowflake className="w-3 h-3" /> {t("cards.freeze")}</>
                        )}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleCancelCard(card.id)} disabled={updateStatus.isPending} className="gap-1 text-xs text-destructive hover:text-destructive">
                        <XCircle className="w-3 h-3" /> {t("cards.cancelCard")}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 rounded-xl border border-border bg-card text-center">
            <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold mb-2">{t("cards.noCards")}</h3>
            <p className="text-sm text-muted-foreground mb-4">{t("cards.noCardsDesc")}</p>
            <Button onClick={() => setDialogOpen(true)}>{t("cards.requestFirstCard")}</Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Cards;
