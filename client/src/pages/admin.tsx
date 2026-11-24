import { WelcomeChecklistSettings } from "@/components/welcome-checklist-editor";
import { useLayoutEffect, useRef, useState } from "react";
import { ManagementLayout } from "@/components/management-layout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, ChevronRight, Database, Flag, History, Images, Settings, Shield, ShoppingBag, Skull, UserCog, Users, Utensils } from "lucide-react";
import { ExcelImport } from "@/components/excel-import";
import { ExcelExport } from "@/components/excel-export.tsx";
import { ResetDataSection } from "@/components/reset-data-section";
import { EndEventButton } from "@/components/end-event-button";
import { DiscountManagement } from "@/components/discount-management";
import { MealDiscountManagement } from "@/components/meal-discount-management";
import { ProductManagement } from "@/components/product-management";
import { MealProductManagement } from "@/components/meal-product-management";
import { DemoDataManager } from "@/components/demo-data-manager";
import { MakeupSettings } from "@/components/makeup-settings";
import { SouvenirErasureRequests } from "@/components/souvenir-erasure-requests";
import { SouvenirSettings } from "@/components/souvenir-settings";
import { EventDaySettings } from "@/components/event-day-settings";
import { EventBackupManager } from "@/components/event-backup-manager";
import { AnalyticsSettings } from "@/components/analytics-settings";
import { SyncModeManager } from "@/components/sync-mode-manager";
import { UserManagement } from "@/components/user-management";
import { AuditLogViewer } from "@/components/audit-log-viewer";
import { ParticipantTypeSection } from "@/components/participant-type-section";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ParticipantWithRelations, TimeSlot, SquadWithRelations } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const adminSections = [
  {
    label: "Participants et staff",
    items: [
      { id: "zombie", label: "Zombies", description: "Inscriptions, vagues et squads", icon: Skull, tone: "red" },
      { id: "survivant", label: "Survivants", description: "Inscriptions, vagues et équipes", icon: Users, tone: "blue" },
      { id: "staff", label: "Staff", description: "Fiches et équipes du staff", icon: UserCog, tone: "green" },
    ],
  },
  {
    label: "Ventes et repas",
    items: [
      { id: "boutique", label: "Boutique", description: "Catalogue, stocks et réductions", icon: ShoppingBag, tone: "violet" },
      { id: "repas", label: "Repas", description: "Produits, tarifs et réductions", icon: Utensils, tone: "amber" },
    ],
  },
  {
    label: "Événement et accès",
    items: [
      { id: "config", label: "Réglages de l’événement", description: "Date, maquillage, checklist et synchronisation", icon: Settings, tone: "slate" },
      { id: "souvenir", label: "Espaces souvenir", description: "Galerie, statistiques et demandes d’effacement", icon: Images, tone: "violet" },
      { id: "users", label: "Comptes et permissions", description: "Accès à l’application et rôles du staff", icon: Shield, tone: "blue" },
      { id: "historique", label: "Historique", description: "Activité et actions enregistrées", icon: History, tone: "slate" },
      { id: "donnees", label: "Sauvegardes et données", description: "Sauvegardes, analyses et données de démonstration", icon: Database, tone: "green" },
      { id: "cloture", label: "Clôture et réinitialisation", description: "Terminer l’événement ou effacer ses données", icon: Flag, tone: "red" },
    ],
  },
];

export default function AdminPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<Record<string, string>>({
    boutique: "items",
    repas: "items",
  });

  const { data: zombieParticipants = [] } = useQuery<ParticipantWithRelations[]>({
    queryKey: ["/api/participants", { type: "zombie" }],
    queryFn: async () => {
      const res = await fetch("/api/participants?type=zombie");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: survivantParticipants = [] } = useQuery<ParticipantWithRelations[]>({
    queryKey: ["/api/participants", { type: "survivant" }],
    queryFn: async () => {
      const res = await fetch("/api/participants?type=survivant");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: zombieTimeSlots = [] } = useQuery<TimeSlot[]>({
    queryKey: ["/api/time-slots", { type: "zombie" }],
    queryFn: async () => {
      const res = await fetch("/api/time-slots?type=zombie");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: survivantTimeSlots = [] } = useQuery<TimeSlot[]>({
    queryKey: ["/api/time-slots", { type: "survivant" }],
    queryFn: async () => {
      const res = await fetch("/api/time-slots?type=survivant");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: zombieSquads = [] } = useQuery<SquadWithRelations[]>({
    queryKey: ["/api/squads/with-participants", { type: "zombie" }],
    queryFn: async () => {
      const res = await fetch("/api/squads/with-participants?type=zombie");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: survivantSquads = [] } = useQuery<SquadWithRelations[]>({
    queryKey: ["/api/squads/with-participants", { type: "survivant" }],
    queryFn: async () => {
      const res = await fetch("/api/squads/with-participants?type=survivant");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: staffParticipants = [] } = useQuery<ParticipantWithRelations[]>({
    queryKey: ["/api/participants", { type: "staff" }],
    queryFn: async () => {
      const res = await fetch("/api/participants?type=staff");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: staffTimeSlots = [] } = useQuery<TimeSlot[]>({
    queryKey: ["/api/time-slots", { type: "staff" }],
    queryFn: async () => {
      const res = await fetch("/api/time-slots?type=staff");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: staffSquads = [] } = useQuery<SquadWithRelations[]>({
    queryKey: ["/api/squads/with-participants", { type: "staff" }],
    queryFn: async () => {
      const res = await fetch("/api/squads/with-participants?type=staff");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const deleteTimeSlotMutation = useMutation({
    mutationFn: async (timeSlotId: number) => {
      return await apiRequest("DELETE", `/api/time-slots/${timeSlotId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === "string" && key.startsWith("/api/time-slots");
        }
      });
      toast({
        title: "Créneau supprimé",
        description: "Le créneau horaire a été supprimé avec succès.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer ce créneau. Il est peut-être utilisé par des participants.",
        variant: "destructive",
      });
      console.error("Error deleting time slot:", error);
    },
  });

  const deleteSquadMutation = useMutation({
    mutationFn: async (squadId: number) => {
      return await apiRequest("DELETE", `/api/squads/${squadId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === "string" && key.startsWith("/api/squads");
        }
      });
      toast({
        title: "Squad supprimé",
        description: "Le squad a été supprimé avec succès.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer ce squad.",
        variant: "destructive",
      });
      console.error("Error deleting squad:", error);
    },
  });

  const selectedSection = adminSections.flatMap(group => group.items).find(item => item.id === activeTab);
  const sectionHeading = useRef<HTMLHeadingElement>(null);
  const sectionButtons = useRef(new Map<string, HTMLButtonElement>());
  const previousSection = useRef<string | null>(null);

  useLayoutEffect(() => {
    if (activeTab) sectionHeading.current?.focus();
    else if (previousSection.current) sectionButtons.current.get(previousSection.current)?.focus();
    previousSection.current = activeTab;
  }, [activeTab]);

  return (
    <ManagementLayout
      title="Administration"
      subtitle="Comptes, données et réglages"
    >
      {!selectedSection ? (
        <div className="space-y-7">
          {adminSections.map(group => (
            <section key={group.label} aria-label={group.label}>
              <h2 className="mb-3 text-lg font-semibold tracking-tight">{group.label}</h2>
              <div className="workspace-card-grid">
                {group.items.map(({ id, label, description, icon: Icon, tone }) => (
                  <button type="button" key={id} className="workspace-link"
                    ref={button => {
                      if (button) sectionButtons.current.set(id, button);
                      else sectionButtons.current.delete(id);
                    }}
                    onClick={() => setActiveTab(id)}>
                    <span className="workspace-icon size-11" data-tone={tone}><Icon className="size-5" aria-hidden /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{label}</span>
                      <span className="mt-1 block text-sm text-muted-foreground">{description}</span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <section className="space-y-5" aria-labelledby="admin-section">
          <Button variant="outline" className="min-h-11" onClick={() => setActiveTab(null)}><ArrowLeft aria-hidden /> Toutes les rubriques</Button>
          <div className="flex items-center gap-3">
            <span className="workspace-icon size-11" data-tone={selectedSection.tone}><selectedSection.icon className="size-5" aria-hidden /></span>
            <div>
              <h2 id="admin-section" ref={sectionHeading} tabIndex={-1} className="text-xl font-bold tracking-tight">{selectedSection.label}</h2>
              <p className="text-sm text-muted-foreground">{selectedSection.description}</p>
            </div>
          </div>
          {activeTab === "config" && <div className="space-y-4">
            <EventDaySettings />
            <MakeupSettings />
            <WelcomeChecklistSettings />
            <SyncModeManager />
          </div>}
          {activeTab === "souvenir" && <div className="space-y-4">
            <SouvenirSettings />
            <SouvenirErasureRequests />
          </div>}
          {activeTab === "donnees" && <div className="space-y-4">
            <EventBackupManager />
            <AnalyticsSettings />
            <DemoDataManager />
          </div>}
          {activeTab === "cloture" && <div className="space-y-4">
            <EndEventButton />
            <ResetDataSection
              title="Réinitialisation de l’événement"
              description="Téléchargez et vérifiez une sauvegarde complète avant d’effacer les données de l’événement."
              options={[
                { label: "Réinitialiser les données de l’événement", module: "all",
                  description: "Les fiches, les équipes, les créneaux, la date, les achats, le catalogue et les remises seront effacés. Vos comptes permettent de vous reconnecter pour restaurer la sauvegarde." },
              ]}
            />
          </div>}

          {/* Zombie Tab */}
          {activeTab === "zombie" && <div className="space-y-4">
            <ParticipantTypeSection
              type="zombie"
              color="red"
              title="Participants Zombies"
              participants={zombieParticipants}
              timeSlots={zombieTimeSlots}
              squads={zombieSquads}
              onDeleteTimeSlot={(id) => deleteTimeSlotMutation.mutate(id)}
              onDeleteSquad={(id) => deleteSquadMutation.mutate(id)}
            />
          </div>}

          {/* Survivant Tab */}
          {activeTab === "survivant" && <div className="space-y-4">
            <ParticipantTypeSection
              type="survivant"
              color="blue"
              title="Participants Survivants"
              participants={survivantParticipants}
              timeSlots={survivantTimeSlots}
              squads={survivantSquads}
              onDeleteTimeSlot={(id) => deleteTimeSlotMutation.mutate(id)}
              onDeleteSquad={(id) => deleteSquadMutation.mutate(id)}
            />
          </div>}

          {/* Staff Tab */}
          {activeTab === "staff" && <div className="space-y-4">
            <ParticipantTypeSection
              type="staff"
              color="green"
              title="Participants Staff"
              participants={staffParticipants}
              timeSlots={staffTimeSlots}
              squads={staffSquads}
              onDeleteTimeSlot={(id) => deleteTimeSlotMutation.mutate(id)}
              onDeleteSquad={(id) => deleteSquadMutation.mutate(id)}
            />
          </div>}

          {/* Boutique Tab */}
          {activeTab === "boutique" && <div className="space-y-4">

            {/* Sous-menu Boutique */}
            <Tabs value={activeSubTab.boutique} onValueChange={(value) => setActiveSubTab({ ...activeSubTab, boutique: value })}>
              <TabsList className="workspace-tabs">
                <TabsTrigger value="items">Produits</TabsTrigger>
                <TabsTrigger value="discounts">Réductions</TabsTrigger>
              </TabsList>

              {/* Produits */}
              <TabsContent value="items" className="space-y-4 mt-4">
                {/* Manual Product Management */}
                <ProductManagement />

                {/* Import/Export Excel */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
                  {/* Import */}
                  <ExcelImport type="boutique" module="items" />

                  {/* Export */}
                  <ExcelExport type="boutique" module="items" />
                </div>

                {/* Reset Section for Shop */}
                <ResetDataSection
                  title="Réinitialisation Boutique"
                  description="Supprimer les données de la boutique"
                  options={[
                    { label: "Reset Produits Boutique", module: "shop", description: "Supprime tous les produits de la boutique" },
                    { label: "Reset Achats Boutique", module: "purchases", description: "Supprime tout l'historique des achats" },
                  ]}
                />
              </TabsContent>

              {/* Réductions */}
              <TabsContent value="discounts" className="space-y-4 mt-4">
                <DiscountManagement />
              </TabsContent>
            </Tabs>
          </div>}

          {/* Repas Tab */}
          {activeTab === "repas" && <div className="space-y-4">

            {/* Sous-menu Repas */}
            <Tabs value={activeSubTab.repas} onValueChange={(value) => setActiveSubTab({ ...activeSubTab, repas: value })}>
              <TabsList className="workspace-tabs">
                <TabsTrigger value="items">Produits</TabsTrigger>
                <TabsTrigger value="discounts">Réductions</TabsTrigger>
              </TabsList>

              {/* Produits */}
              <TabsContent value="items" className="space-y-4 mt-4">
                {/* Manual Product Management */}
                <MealProductManagement />

                {/* Import/Export Excel */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
                  {/* Import */}
                  <ExcelImport type="repas" module="items" />

                  {/* Export */}
                  <ExcelExport type="repas" module="items" />
                </div>

                {/* Reset Section for Meals */}
                <ResetDataSection
                  title="Réinitialisation Repas"
                  description="Supprimer les données des repas"
                  options={[
                    { label: "Reset Produits Repas", module: "meals", description: "Supprime tous les produits de repas" },
                    { label: "Reset Achats Repas", module: "meal-purchases", description: "Supprime tout l'historique des achats de repas" },
                  ]}
                />
              </TabsContent>

              {/* Réductions */}
              <TabsContent value="discounts" className="space-y-4 mt-4">
                <MealDiscountManagement />
              </TabsContent>
            </Tabs>
          </div>}

          {/* Users Tab - Gestion des utilisateurs */}
          {activeTab === "users" && <div className="space-y-4">
            <UserManagement />
          </div>}

          {/* Historique Tab - Logs d'audit */}
          {activeTab === "historique" && <div className="space-y-4">
            <AuditLogViewer />
          </div>}
        </section>
      )}
    </ManagementLayout>
  );
}
