import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Key, Trash2, Shield, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { USER_ROLES } from "@shared/schema";

interface User {
  id: number;
  username: string;
  roles: string;
  createdAt: Date;
  lastLoginAt: Date | null;
}

export function UserManagement() {
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [changePassword, setChangePassword] = useState("");

  // Récupérer la liste des utilisateurs
  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/auth/users"],
    queryFn: async () => {
      const res = await fetch("/api/auth/users", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
  });

  // Créer un utilisateur
  const createUserMutation = useMutation({
    mutationFn: async (data: { username: string; passwordHash: string; roles: string }) => {
      return apiRequest("POST", "/api/auth/users", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/users"] });
      toast({ title: "Utilisateur créé", description: "L'utilisateur a été créé avec succès" });
      setShowCreateDialog(false);
      setNewUsername("");
      setNewPassword("");
      setSelectedRoles([]);
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de créer l'utilisateur",
        variant: "destructive",
      });
    },
  });

  // Modifier le mot de passe
  const updatePasswordMutation = useMutation({
    mutationFn: async ({ userId, password }: { userId: number; password: string }) => {
      return apiRequest("PATCH", `/api/auth/users/${userId}/password`, { password });
    },
    onSuccess: () => {
      toast({ title: "Mot de passe modifié", description: "Le mot de passe a été mis à jour avec succès" });
      setShowPasswordDialog(false);
      setSelectedUser(null);
      setChangePassword("");
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de modifier le mot de passe",
        variant: "destructive",
      });
    },
  });

  // Supprimer un utilisateur
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      return apiRequest("DELETE", `/api/auth/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/users"] });
      toast({ title: "Utilisateur supprimé", description: "L'utilisateur a été supprimé avec succès" });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de supprimer l'utilisateur",
        variant: "destructive",
      });
    },
  });

  const handleCreateUser = () => {
    if (!newUsername || !newPassword) {
      toast({
        title: "Erreur",
        description: "Veuillez renseigner un nom d'utilisateur et un mot de passe",
        variant: "destructive",
      });
      return;
    }

    if (selectedRoles.length === 0) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner au moins un rôle",
        variant: "destructive",
      });
      return;
    }

    createUserMutation.mutate({
      username: newUsername,
      passwordHash: newPassword, // Will be hashed on server
      roles: JSON.stringify(selectedRoles),
    });
  };

  const handleChangePassword = () => {
    if (!selectedUser || !changePassword) {
      toast({
        title: "Erreur",
        description: "Veuillez renseigner un nouveau mot de passe",
        variant: "destructive",
      });
      return;
    }

    updatePasswordMutation.mutate({ userId: selectedUser.id, password: changePassword });
  };

  const handleDeleteUser = (user: User) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer l'utilisateur "${user.username}" ?`)) {
      deleteUserMutation.mutate(user.id);
    }
  };

  const toggleRole = (role: string) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const parseRoles = (rolesString: string): string[] => {
    try {
      return JSON.parse(rolesString);
    } catch {
      return [];
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-red-500/20 text-red-500 border-red-500/30";
      case "staff_zombie":
        return "bg-orange-500/20 text-orange-500 border-orange-500/30";
      case "staff_survivant":
        return "bg-blue-500/20 text-blue-500 border-blue-500/30";
      case "staff_repas":
        return "bg-green-500/20 text-green-500 border-green-500/30";
      case "staff_boutique":
        return "bg-purple-500/20 text-purple-500 border-purple-500/30";
      default:
        return "bg-gray-500/20 text-gray-500 border-gray-500/30";
    }
  };

  return (
    <div className="space-y-6">
      {/* Bouton créer un utilisateur */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Gestion des Utilisateurs
          </CardTitle>
          <CardDescription>
            Créez et gérez les comptes utilisateurs avec leurs rôles
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Créer un utilisateur
          </Button>
        </CardContent>
      </Card>

      {/* Liste des utilisateurs */}
      {isLoading ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">Chargement...</p>
          </CardContent>
        </Card>
      ) : users.length === 0 ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Aucun utilisateur trouvé</AlertDescription>
        </Alert>
      ) : (
        <div className="grid gap-4">
          {users.map((user) => {
            const roles = parseRoles(user.roles);
            return (
              <Card key={user.id}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-semibold">{user.username}</h3>
                        <div className="flex gap-2">
                          {roles.map((role) => (
                            <Badge key={role} variant="outline" className={getRoleBadgeColor(role)}>
                              {role}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Créé le : {new Date(user.createdAt).toLocaleDateString("fr-FR")}
                        {user.lastLoginAt && (
                          <> • Dernière connexion : {new Date(user.lastLoginAt).toLocaleDateString("fr-FR")}</>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => {
                          setSelectedUser(user);
                          setShowPasswordDialog(true);
                        }}
                      >
                        <Key className="w-4 h-4" />
                        Modifier le mot de passe
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="gap-2"
                        onClick={() => handleDeleteUser(user)}
                      >
                        <Trash2 className="w-4 h-4" />
                        Supprimer
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog - Créer un utilisateur */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Créer un nouvel utilisateur</DialogTitle>
            <DialogDescription>
              Ajoutez un nouveau compte avec nom d'utilisateur, mot de passe et rôles
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="username">Nom d'utilisateur</Label>
              <Input
                id="username"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="Ex: john_doe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 6 caractères"
              />
            </div>
            <div className="space-y-2">
              <Label>Rôles</Label>
              <div className="space-y-2">
                {Object.values(USER_ROLES).map((role) => (
                  <div key={role} className="flex items-center space-x-2">
                    <Checkbox
                      id={`role-${role}`}
                      checked={selectedRoles.includes(role)}
                      onCheckedChange={() => toggleRole(role)}
                    />
                    <Label
                      htmlFor={`role-${role}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      <Badge variant="outline" className={getRoleBadgeColor(role)}>
                        {role}
                      </Badge>
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreateUser} disabled={createUserMutation.isPending}>
              {createUserMutation.isPending ? "Création..." : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog - Modifier le mot de passe */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le mot de passe</DialogTitle>
            <DialogDescription>
              Changez le mot de passe pour l'utilisateur {selectedUser?.username}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">Nouveau mot de passe</Label>
              <Input
                id="new-password"
                type="password"
                value={changePassword}
                onChange={(e) => setChangePassword(e.target.value)}
                placeholder="Minimum 6 caractères"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPasswordDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleChangePassword} disabled={updatePasswordMutation.isPending}>
              {updatePasswordMutation.isPending ? "Modification..." : "Modifier"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
