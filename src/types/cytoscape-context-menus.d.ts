declare module "cytoscape-context-menus" {
  import type cytoscape from "cytoscape";

  const contextMenus: cytoscape.Ext;
  export default contextMenus;
}

declare namespace cytoscape {
  interface Core {
    contextMenus(options?: ContextMenuOptions | "get"): ContextMenuInstance;
  }

  interface ContextMenuEventObject {
    target?: SingularElementReturnValue | Core;
  }

  interface ContextMenuItem {
    id: string;
    content: string;
    tooltipText?: string;
    selector?: string;
    disabled?: boolean;
    show?: boolean;
    hasTrailingDivider?: boolean;
    coreAsWell?: boolean;
    onClickFunction?: (event: ContextMenuEventObject) => void;
    submenu?: ContextMenuItem[];
  }

  interface ContextMenuOptions {
    evtType?: string;
    menuItems?: ContextMenuItem[];
    menuItemClasses?: string[];
    contextMenuClasses?: string[];
    submenuIndicator?: {
      src: string;
      width: number;
      height: number;
    };
  }

  interface ContextMenuInstance {
    destroy: () => Core;
    isActive: () => boolean;
  }
}
