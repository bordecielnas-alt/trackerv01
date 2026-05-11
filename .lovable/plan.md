## Objectif
Fusionner le contenu de l'onglet **Admin** dans l'onglet **Réglages** sous forme de sections dépliables (accordéon), puis supprimer l'onglet Admin.

## Modifications

### 1. `src/pages/SettingsPage.tsx`
- Importer `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent` depuis `@/components/ui/accordion`.
- Importer les hooks/utils utilisés dans Admin (`updateCredentials`, `getCurrentUsername`, `useTheme`, `THEME_PALETTE`, `loadCaldavConfig`, `saveCaldavConfig`, `testCaldav`, etc.) et le composant `ThemeSwatch`.
- Restructurer la page en accordéon avec 5 catégories dépliables :
  1. **Paramètres de tracking** (les paramètres actuels + formule de score)
  2. **Apparence** (sélection de thème clair/sombre)
  3. **Calendrier (CalDAV)** (config serveur)
  4. **Identifiants** (changement username/password)
  
  La première section ouverte par défaut (`defaultValue="tracking"`).
- Élargir `max-w-2xl` → `max-w-3xl` pour accueillir le contenu Admin.
- Conserver tous les dialogues et la logique existante de tracking.

### 2. `src/components/AppLayout.tsx`
- Retirer l'entrée `{ to: "/admin", label: "Admin", icon: ShieldCheck }` du tableau `navItems`.
- Retirer l'import inutilisé `ShieldCheck` de `lucide-react`.

### 3. `src/App.tsx`
- Retirer la route `<Route path="/admin" element={<AdminPage />} />`.
- Retirer l'import `AdminPage`.

### 4. `src/pages/AdminPage.tsx`
- Supprimer le fichier (le `ThemeSwatch` est déplacé en interne dans `SettingsPage.tsx` ou défini comme petit composant local).

### 5. Mémoire (`mem://index.md`)
- Mettre à jour la ligne Navigation Layout : retirer "Admin" de l'ordre de la sidebar.
- Mettre à jour la mémoire `mem://style/navigation-layout` en conséquence.

## Notes
- Aucun changement de logique métier : tout le code existant (auth, CalDAV, thèmes) est réutilisé tel quel.
- L'accordéon shadcn permet de plier/déplier chaque catégorie individuellement.
