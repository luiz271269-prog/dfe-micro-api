import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

// Recebe os grupos padrão (defaultGroups) e aplica a organização salva no usuário.
// A preferência é salva como { "Nome do Grupo": ["/path1", "/path2", ...] }
export function useMenuOrder(defaultGroups) {
  const [groups, setGroups] = useState(defaultGroups);
  const [loaded, setLoaded] = useState(false);

  // Mapa path -> item, para reconstruir a partir da ordem salva
  const buildFromSaved = useCallback((saved) => {
    const allItems = {};
    defaultGroups.forEach(g => g.items.forEach(it => { allItems[it.path] = it; }));

    const usedPaths = new Set();
    const next = defaultGroups.map(g => {
      const savedPaths = saved[g.label] || [];
      const items = [];
      savedPaths.forEach(p => {
        if (allItems[p] && !usedPaths.has(p)) {
          items.push(allItems[p]);
          usedPaths.add(p);
        }
      });
      return { label: g.label, items };
    });

    // Itens novos (que não estavam salvos) voltam ao grupo padrão original
    defaultGroups.forEach((g, gi) => {
      g.items.forEach(it => {
        if (!usedPaths.has(it.path)) {
          next[gi].items.push(it);
          usedPaths.add(it.path);
        }
      });
    });

    return next;
  }, [defaultGroups]);

  useEffect(() => {
    (async () => {
      try {
        const me = await base44.auth.me();
        const saved = me?.menu_order;
        if (saved && typeof saved === 'object') {
          setGroups(buildFromSaved(saved));
        }
      } catch (e) { /* mantém padrão */ }
      setLoaded(true);
    })();
  }, [buildFromSaved]);

  const persist = useCallback(async (next) => {
    const payload = {};
    next.forEach(g => { payload[g.label] = g.items.map(it => it.path); });
    try {
      await base44.auth.updateMe({ menu_order: payload });
    } catch (e) { /* ignora falha de persistência */ }
  }, []);

  // Move um item de um grupo para outro (ou reordena dentro do mesmo)
  const moveItem = useCallback((sourceGroup, sourceIndex, destGroup, destIndex) => {
    setGroups(prev => {
      const next = prev.map(g => ({ ...g, items: [...g.items] }));
      const from = next.find(g => g.label === sourceGroup);
      const to = next.find(g => g.label === destGroup);
      if (!from || !to) return prev;
      const [moved] = from.items.splice(sourceIndex, 1);
      to.items.splice(destIndex, 0, moved);
      persist(next);
      return next;
    });
  }, [persist]);

  const reset = useCallback(() => {
    setGroups(defaultGroups);
    persist(defaultGroups);
  }, [defaultGroups, persist]);

  return { groups, loaded, moveItem, reset };
}