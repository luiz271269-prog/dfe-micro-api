import { Link } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { GripVertical, Pencil, Check, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { navGroups as defaultGroups } from '@/lib/navConfig';
import { useMenuOrder } from '@/lib/useMenuOrder';

export default function SidebarNav({ collapsed, currentPath, onNavigate }) {
  const { groups, moveItem, reset } = useMenuOrder(defaultGroups);
  const [editMode, setEditMode] = useState(false);

  function onDragEnd(result) {
    const { source, destination } = result;
    if (!destination) return;
    moveItem(source.droppableId, source.index, destination.droppableId, destination.index);
  }

  const renderLink = (item, isActive, dragHandleProps) =>
  <Link
    to={item.path}
    onClick={() => !editMode && onNavigate?.()}
    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200
        ${isActive ?
    'bg-sidebar-primary text-sidebar-primary-foreground shadow-md shadow-sidebar-primary/20' :
    'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'}`
    }
    title={collapsed ? item.label : undefined}>
    
      {editMode && !collapsed &&
    <span {...dragHandleProps} className="text-sidebar-foreground/40 hover:text-sidebar-foreground cursor-grab active:cursor-grabbing -ml-1">
          <GripVertical className="w-4 h-4" />
        </span>
    }
      <item.icon className="w-5 h-5 shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>;


  // Modo recolhido ou sem edição: renderização simples, sem DnD
  if (collapsed || !editMode) {
    return (
      <nav className="flex-1 overflow-y-auto pr-1 pl-1 pt-1 pb-4">
        {!collapsed &&
        <div className="flex justify-end px-1 pb-2">
            <button
            onClick={() => setEditMode(true)}
            className="flex items-center gap-1.5 text-[10px] font-semibold text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors">
            
              <Pencil className="w-3 h-3" /> Organizar menu
            </button>
          </div>
        }
        {groups.map((group, gi) =>
        <div key={group.label} className={gi > 0 ? 'mt-4' : ''}>
            {!collapsed &&
          <div className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-sidebar-foreground/50">
                {group.label}
              </div>
          }
            {collapsed && gi > 0 && <div className="mx-2 my-2 border-t border-sidebar-border/50" />}
            <div className="space-y-0.5">
              {group.items.map((item) =>
            <div key={item.path}>{renderLink(item, currentPath === item.path)}</div>
            )}
            </div>
          </div>
        )}
      </nav>);

  }

  // Modo de edição: drag-and-drop entre grupos
  return (
    <nav className="flex-1 py-3 px-2 overflow-y-auto">
      <div className="flex items-center justify-between gap-2 px-1 pb-2">
        <button
          onClick={reset}
          className="flex items-center gap-1.5 text-[10px] font-semibold text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors">
          
          <RotateCcw className="w-3 h-3" /> Restaurar
        </button>
        <button
          onClick={() => setEditMode(false)}
          className="flex items-center gap-1.5 text-[10px] font-bold text-sidebar-primary-foreground bg-sidebar-primary px-2 py-1 rounded-md">
          
          <Check className="w-3 h-3" /> Concluir
        </button>
      </div>
      <DragDropContext onDragEnd={onDragEnd}>
        {groups.map((group, gi) =>
        <div key={group.label} className={gi > 0 ? 'mt-4' : ''}>
            <div className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-sidebar-foreground/50">
              {group.label}
            </div>
            <Droppable droppableId={group.label}>
              {(provided, snapshot) =>
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={`space-y-0.5 rounded-lg transition-colors min-h-[8px] ${snapshot.isDraggingOver ? 'bg-sidebar-accent/40 ring-1 ring-sidebar-primary/40' : ''}`}>
              
                  {group.items.map((item, idx) =>
              <Draggable key={item.path} draggableId={item.path} index={idx}>
                      {(dragProvided, dragSnapshot) =>
                <div
                  ref={dragProvided.innerRef}
                  {...dragProvided.draggableProps}
                  className={dragSnapshot.isDragging ? 'opacity-90' : ''}>
                  
                          {renderLink(item, currentPath === item.path, dragProvided.dragHandleProps)}
                        </div>
                }
                    </Draggable>
              )}
                  {provided.placeholder}
                </div>
            }
            </Droppable>
          </div>
        )}
      </DragDropContext>
    </nav>);

}