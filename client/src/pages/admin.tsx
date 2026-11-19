import { useState } from "react";
import { ManagementLayout } from "@/components/management-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, UserCog, Shield, Settings, ShoppingBag, Utensils, History } from "lucide-react";
import { ExcelImport } from "@/components/excel-import";
import { ExcelExport } from "@/components/excel-export.tsx";
import { ResetDataSection } from "@/components/reset-data-section";
import { EndEventButton } from "@/components/end-event-button";
import { DiscountManagement } from "@/components/discount-management";
import { MealDiscountManagement } from "@/components/meal-discount-management";
import { ProductManagement } from "@/components/product-management";
import { MealProductManagement } from "@/components/meal-product-management";
import { DemoDataManager } from "@/components/demo-data-manager";
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

export default function AdminPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("zombie");
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

  return (
    <ManagementLayout
      title="Administration"
      subtitle="Comptes, données et réglages"
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList aria-label="Sections d’administration" className="grid h-auto w-full grid-cols-2 gap-1 rounded-xl border border-border p-1 min-[480px]:grid-cols-4 xl:grid-cols-8">
          {[
            { id: "config", label: "Configuration", icon: Settings },
            { id: "zombie", label: "Zombies", icon: Users },
            { id: "survivant", label: "Survivants", icon: Users },
            { id: "staff", label: "Staff", icon: UserCog },
            { id: "boutique", label: "Boutique", icon: ShoppingBag },
            { id: "repas", label: "Repas", icon: Utensils },
            { id: "users", label: "Utilisateurs", icon: Shield },
            { id: "historique", label: "Historique", icon: History },
          ].map(({ id, label, icon: Icon }) => (
            <TabsTrigger key={id} value={id} className="min-h-11 justify-start gap-2 rounded-lg px-2 text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary xl:justify-center">
              <Icon className="size-4 shrink-0" aria-hidden />{label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Configuration Tab */}
        <TabsContent value="config" className="space-y-4">
          <EventDaySettings />
          <EventBackupManager />
          <AnalyticsSettings />
          <DemoDataManager />
          <SyncModeManager />

          {/* End Event Button */}
          <EndEventButton />

          {/* Reset All Data Section */}
          <ResetDataSection
            title="Réinitialisation de l’événement"
            description="Téléchargez et vérifiez une sauvegarde complète avant d’effacer les données de l’événement."
            options={[
              { label: "Réinitialiser les données de l’événement", module: "all",
                description: "Les fiches, les équipes, les créneaux, la date, les achats, le catalogue et les remises seront effacés. Vos comptes permettent de vous reconnecter pour restaurer la sauvegarde." },
            ]}
          />
        </TabsContent>

        {/* Zombie Tab */}
        <TabsContent value="zombie" className="space-y-4">
          <h3 className="text-lg font-semibold text-red-500">Gestion Zombies</h3>
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
        </TabsContent>

        {/* Survivant Tab */}
        <TabsContent value="survivant" className="space-y-4">
          <h3 className="text-lg font-semibold text-blue-500">Gestion Survivants</h3>
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
        </TabsContent>

        {/* Staff Tab */}
        <TabsContent value="staff" className="space-y-4">
          <h3 className="text-lg font-semibold text-green-500">Gestion Staff</h3>
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
        </TabsContent>

        {/* Boutique Tab */}
        <TabsContent value="boutique" className="space-y-4">
          <h3 className="text-lg font-semibold text-indigo-500">Gestion Boutique</h3>

          {/* Sous-menu Boutique */}
          <Tabs value={activeSubTab.boutique} onValueChange={(value) => setActiveSubTab({ ...activeSubTab, boutique: value })}>
            <TabsList className="bg-muted/30">
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
        </TabsContent>

        {/* Repas Tab */}
        <TabsContent value="repas" className="space-y-4">
          <h3 className="text-lg font-semibold text-orange-500">Gestion Repas</h3>

          {/* Sous-menu Repas */}
          <Tabs value={activeSubTab.repas} onValueChange={(value) => setActiveSubTab({ ...activeSubTab, repas: value })}>
            <TabsList className="bg-muted/30">
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
        </TabsContent>

        {/* Users Tab - Gestion des utilisateurs */}
        <TabsContent value="users" className="space-y-4">
          <h3 className="text-lg font-semibold text-pink-500">Gestion des Utilisateurs</h3>
          <UserManagement />
        </TabsContent>

        {/* Historique Tab - Logs d'audit */}
        <TabsContent value="historique" className="space-y-4">
          <h3 className="text-lg font-semibold text-yellow-500">Historique des Actions</h3>
          <AuditLogViewer />
        </TabsContent>
      </Tabs>
    </ManagementLayout>
  );
}
