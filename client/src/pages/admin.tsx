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
import { SyncModeManager } from "@/components/sync-mode-manager";
import { SyncPushPullButtons } from "@/components/sync-push-pull-buttons";
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
      subtitle="Gestion complète de l'événement"
      showScanButton={true}
      scanLink="/scan"
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        {/* Menu principal */}
        <TabsList className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-8 gap-1 bg-muted/50 border border-border/50 p-1">
          <TabsTrigger value="config" className="gap-2 data-[state=active]:bg-purple-500/90 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-purple-500/20">
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Config</span>
          </TabsTrigger>
          <TabsTrigger value="zombie" className="gap-2 data-[state=active]:bg-red-500/90 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-red-500/20">
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">Zombies</span>
          </TabsTrigger>
          <TabsTrigger value="survivant" className="gap-2 data-[state=active]:bg-blue-500/90 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-blue-500/20">
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">Survivants</span>
          </TabsTrigger>
          <TabsTrigger value="staff" className="gap-2 data-[state=active]:bg-green-500/90 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-green-500/20">
            <UserCog className="w-4 h-4" />
            <span className="hidden sm:inline">Staff</span>
          </TabsTrigger>
          <TabsTrigger value="boutique" className="gap-2 data-[state=active]:bg-indigo-500/90 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-indigo-500/20">
            <ShoppingBag className="w-4 h-4" />
            <span className="hidden sm:inline">Boutique</span>
          </TabsTrigger>
          <TabsTrigger value="repas" className="gap-2 data-[state=active]:bg-orange-500/90 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-orange-500/20">
            <Utensils className="w-4 h-4" />
            <span className="hidden sm:inline">Repas</span>
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2 data-[state=active]:bg-pink-500/90 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-pink-500/20">
            <Shield className="w-4 h-4" />
            <span className="hidden sm:inline">Utilisateurs</span>
          </TabsTrigger>
          <TabsTrigger value="historique" className="gap-2 data-[state=active]:bg-yellow-500/90 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-yellow-500/20">
            <History className="w-4 h-4" />
            <span className="hidden sm:inline">Historique</span>
          </TabsTrigger>
        </TabsList>

        {/* Configuration Tab */}
        <TabsContent value="config" className="space-y-4">
          <h3 className="text-lg font-semibold text-purple-500">Configuration de l'événement</h3>

          {/* Sync Push/Pull Buttons */}
          <SyncPushPullButtons />

          {/* Sync Mode Manager */}
          <SyncModeManager />

          {/* End Event Button */}
          <EndEventButton />

          {/* Reset All Data Section */}
          <ResetDataSection
            title="Réinitialisation globale"
            description="Réinitialiser toutes les données de l'événement (ATTENTION : irréversible)"
            options={[
              { label: "Reset TOUTES les données", module: "all", description: "Supprime absolument tout" },
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
