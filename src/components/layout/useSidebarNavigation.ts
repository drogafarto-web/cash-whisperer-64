import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { navigationGroups, NavGroup } from './navigation.config';
import { AppRole } from '@/types/database';

export function useSidebarNavigation(role: AppRole | null) {
  const location = useLocation();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  // Inicializa grupos abertos baseado na rota atual
  useEffect(() => {
    const currentPath = location.pathname;
    const initialOpen: Record<string, boolean> = {};
    
    navigationGroups.forEach(group => {
      const hasActiveItem = group.items.some(item => currentPath === item.href);
      if (hasActiveItem) {
        initialOpen[group.id] = true;
      }
    });
    
    setOpenGroups(prev => ({ ...prev, ...initialOpen }));
  }, [location.pathname]);

  const toggleGroup = (groupId: string) => {
    setOpenGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  // Filtra grupos e itens baseado no papel do usuário
  const filteredGroups: NavGroup[] = navigationGroups
    .map(group => ({
      ...group,
      items: group.items.filter(item => role && item.roles.includes(role)),
    }))
    .filter(group => group.items.length > 0);

  const isActiveRoute = (href: string) => location.pathname === href;

  const isGroupActive = (group: NavGroup) => 
    group.items.some(item => location.pathname === item.href);

  const isGroupOpen = (groupId: string) => openGroups[groupId] ?? false;

  return {
    filteredGroups,
    openGroups,
    toggleGroup,
    isActiveRoute,
    isGroupActive,
    isGroupOpen,
    currentPath: location.pathname,
  };
}
