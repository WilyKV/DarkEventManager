# Architecture Decision Records (ADR)

Ce dossier contient les Architecture Decision Records du projet **DarkEventManager**.

## Qu'est-ce qu'un ADR ?

Un **Architecture Decision Record** (ADR) est un document qui capture une décision architecturale importante prise pour le projet, ainsi que son contexte, ses conséquences et les alternatives considérées.

Les ADR aident à :
- **Documenter** les décisions clés sans se perdre dans l'historique Git
- **Justifier** les choix architecturaux pour les nouveaux contributeurs
- **Réviser** les décisions passées à la lumière de nouvelles contraintes
- **Communiquer** les principes de conception du projet

## Format utilisé : MADR (Markdown Any Decision Records)

Chaque ADR suit la structure standard **MADR 2.1** :

1. **Titre** : Description concise de la décision
2. **Statut** : Proposé / Accepté / Accepté (partiellement) / Dépréciée / Remplacée
3. **Contexte** : Problème, contraintes, hypothèses
4. **Décision** : Choix fait et justification
5. **Conséquences** : Avantages et inconvénients
6. **Alternatives considérées** : Options rejetées et pourquoi

## Index des ADR

| Ref | Titre | Statut | Date |
|-----|-------|--------|------|
| [ADR-001](./0001-topologie-raspberry-pi-cave-local.md) | Topologie Raspberry Pi cave-local | Accepté | 2024-Q3 |
| [ADR-002](./0002-toggle-3-modes-connectivite.md) | Toggle 3 modes connectivité Cloud/Pi/Auto | Proposé | 2024-Q4 |
| [ADR-003](./0003-event-sourcing-local-first-lamport.md) | Event-sourcing local-first avec Lamport timestamps | Accepté (partiellement) | 2024-Q3 |
| [ADR-004](./0004-connect-pg-simple-session-store.md) | connect-pg-simple comme session store | Accepté | 2024-Q3 |
| [ADR-005](./0005-idempotence-achats-client-event-id.md) | Idempotence achats via clientEventId + index unique partiel | Accepté | 2024-Q3 |

## Comment ajouter un nouvel ADR ?

1. Créer un fichier numéroté : `00XX-description-courte.md`
2. Utiliser le format MADR
3. Lister la décision dans ce README
4. Committer avec `docs(adr): ADR-00X — titre`

## Liens utiles

- [MADR sur GitHub](https://adr.github.io/madr/)
- [ADR.rs](https://adr.rs/) — exemples et bonnes pratiques
