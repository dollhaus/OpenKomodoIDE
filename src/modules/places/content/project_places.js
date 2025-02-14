// Copyright (c) 2000-2011 ActiveState Software Inc.
// See the file LICENSE.txt for licensing information.

// Define the ko.places.projects namespace

if (typeof(ko) == 'undefined') {
    var ko = {};
}
if (!('places' in ko)) {
    ko.places = {};
}
if (!('projects' in ko.places)) {
    ko.places.projects = {};
}

(function() {

var log = ko.logging.getLogger("project_places_js");
log.setLevel(ko.logging.LOG_DEBUG);

const PROJECT_URI_REGEX = /^.*\/(.+?)\.(?:kpf|komodoproject)$/;

var _globalPrefs;
var _placePrefs;
var _g_showProjectPath;
var _bundle = Components.classes["@mozilla.org/intl/stringbundle;1"]
    .getService(Components.interfaces.nsIStringBundleService)
    .createBundle("chrome://komodo-places/locale/places.properties");

this.XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

this.PlacesProjectManager = function(owner) {
    this.owner = owner;
}

this.PlacesProjectManager.prototype = {
  addProject: function(project, position) {
        if (typeof(position) == "undefined" || position === null) {
            this.owner.projectsTreeView.addProject(project);
        } else {
            try {
                this.owner.projectsTreeView.addProjectAtPosition(project, 0);
            } catch(ex) {
                dump("PlacesProjectManager.addProject: " + ex + "\n");
            }
        }
    },
  getSelectedItem: function() {
        return this.owner.projectsTreeView.getSelectedItem();
    },
  refreshParentShowChild: function(parentPart, newPart) {
        return this.owner.refreshParentShowChild(parentPart, newPart);
    },
  
  refresh: function(project) {
        // this.owner.projectsTreeView.refresh(project);
        this.owner.projectsTreeView.invalidate();
    },
  refreshRow: function(project) {
        this.owner.projectsTreeView.refresh(project);
    },
  removeProject: function(project) {
        this.owner.projectsTreeView.removeProject(project);
    },
/*
  replaceProject: function(oldURL, project) {
        dump("**************** Drop replaceProject\n");
        return;
    },
*/
  savePrefs: function(project) {
        this.owner.projectsTreeView.savePrefs(project);
    },
  setCurrentProject: function(project) {
        this.owner.projectsTreeView.currentProject = project;
    },
  removeUnopenedProject: function(url) {
        this.owner.removeUnopenedProject(url);
    },
  getSelectedItems: function(rootsOnly) {
        return this._getSelectedItems(rootsOnly);
    },

  _getSelectedItems: function(rootsOnly) {
        if (typeof(rootsOnly) == "undefined") rootsOnly = false;
        var o1 = {}, o2 = {};
        this.owner.projectsTreeView.getSelectedItems(rootsOnly, o1, o2);
        return o1.value;
    },
  
  _getSelectedItem: function(context) {
        var items = this._getSelectedItems();
        if (items.length != 1) {
            log.error(context + ": Expected 1 selected item, got " + items.length);
            return null;
        }
        var item = items[0];
        if (!item) {
            log.error(context + ": no part in selection");
            return null;
        }
        return item;
    },

  // Methods for the projects context menu

  addExistingFile: function(event, sender) {
        var parentPart = this._getSelectedItem("addExistingFile");
        var newParts = ko.projects.addFile(parentPart);
        if (newParts.length) {
            this.owner.projectsTreeView.showChild(parentPart, newParts[0]);
        }
    },

  addNewFile: function(event, sender) {
        var parentPart = this._getSelectedItem("addNewFile");
        var this_ = this;
        var callback = function(part) {
            if (part) {
                this_.owner.projectsTreeView.showChild(parentPart, part);
            } else {
                ko.dialogs.alert(_bundle.GetStringFromName("cant associate nondisk file with a project"));
            }
        };
        // This has to be done via a callback because creating a file
        // via a template is an async call.
        ko.projects.addNewFileFromTemplate(parentPart, callback);
    },
  
  addGroup: function(event, sender) {
        var parentPart = this._getSelectedItem("addGroup");
        var part = ko.projects.addGroup(parentPart);
        if (part) {
            this.owner.projectsTreeView.showChild(parentPart, part);
        }
    },

  addLiveFolder: function(event, sender) {
        var parentPart = this._getSelectedItem("addLiveFolder");
        var prompt = _bundle.GetStringFromName("Select a new or existing folder");
        var path = ko.filepicker.getFolder(parentPart.project.getFile().dirName,
                                            prompt);
        if (!path) {
            return;
        }
        var uri = ko.uriparse.pathToURI(path);
        var part = ko.projects.addPartWithURLAndType(uri, 'livefolder', parentPart);
        if (part) {
            this.owner.projectsTreeView.showChild(parentPart, part);
        }
    },
  
  addRemoteFile: function(event, sender) {
        var parentPart = this._getSelectedItem("addExistingFile");
        var parts = ko.projects.addRemoteFile(parentPart);
        if (parts.length) {
            this.owner.projectsTreeView.showChild(parentPart, parts[0]);
        }
    },
  
  addRemoteFolder: function(event, sender) {
        var parentPart = this._getSelectedItem("addRemoteFolder");
        var part = ko.projects.addRemoteFolder(parentPart);
        if (part) {
            this.owner.projectsTreeView.showChild(parentPart, part);
        }
    },
  
  // The UI calls removeItems, which uses peFolder and baseManager
  // to actually delete the selected items.  It then calls into
  // removeSelectedItems, which will update the tree.
  
  removeItems: function(event, sender) {
        var parts = this._getSelectedItems(false);
        ko.projects.removeItems(parts, this.owner.projectsTreeView.selection.count);
    },
  removeSelectedItems: function(allItems) {
        // For updating the view, just get the roots
        var parts = this._getSelectedItems(true);
        this.owner.projectsTreeView.removeItems(parts, parts.length);
        this.owner.projectsTreeView.selection.clearSelection();
    },

  renameGroup: function(event, sender) {
        var part = this._getSelectedItem("renameGroup");
        var oldname = part.name;
        var newname = ko.dialogs.renameFileWrapper(oldname);
        if (!newname) {
            return;
        } else if (newname == oldname) {
            ko.dialogs.alert(_bundle.formatStringFromName("Old file and new basename are the same.template", [oldname, newname], 2));
            return;
        }
        part.name = newname;
    },

  showInFinder: function(event, sender) {
        var part = this._getSelectedItem("showInFinder");
        if (!part) {
            return;
        }
        var path = ko.uriparse.displayPath(part.url);
        if (!path) {
            log.error("showInFinder: no path for url " + path.url);
            return;
        }
        if (part.type == "livefolder") {
            path = ko.uriparse.dirName(path);
        }
        var sysUtilsSvc = Components.classes["@activestate.com/koSysUtils;1"].
                    getService(Components.interfaces.koISysUtils);
        sysUtilsSvc.ShowFileInFileManager(path);
    },
  
  sortAscending: 1,
  sortDescending: -1,
  sortProjects: function(direction) {
        var treeview = this.owner.projectsTreeView;
        treeview.sortBy("name", direction);
        treeview.sortRows();
        treeview.invalidate();
    },
  
  _EOF_ : null
};

this.createPlacesProjectView = function() {
    _globalPrefs = (Components.classes["@activestate.com/koPrefService;1"].
                   getService(Components.interfaces.koIPrefService).prefs);
    _placePrefs = _globalPrefs.getPref("places");
    _g_showProjectPath = _globalPrefs.getPref("places").getBoolean('showProjectPath', false);
    this.projectsTree = document.getElementById("placesSubpanelProjects_MPV");
    this.projectsTreeView = Components.classes["@activestate.com/koKPFTreeView;1"]
                          .createInstance(Components.interfaces.koIKPFTreeView);
    if (!this.projectsTreeView) {
        throw new Error("couldn't create a KPF ProjectsTreeView");
    }
    this.projectsTree.treeBoxObject
                        .QueryInterface(Components.interfaces.nsITreeBoxObject)
                        .view = this.projectsTreeView;
    this.projectsTreeView.initialize();
    this.initProjectMRUCogMenu_MPV();
    this.manager = new this.PlacesProjectManager(this);
    ko.projects.manager.setViewMgr(this.manager);
    this.projectCommandHelper = new this.ProjectCommandHelper(this, this.manager);
    // Delegate all the context-menu commands to the projectCommandHelper
    this.projectCommandHelper.injectHelperFunctions(this);
    this.projectCommandHelper.injectSpecificFunctions(this,
        {
            openProjectInNewWindow:1,
            openProjectInCurrentWindow:1,
         });

    document.getElementById("placesSubpanelProjects_MPV").addEventListener('keypress',
                            this.handle_keypress_setup, true);
    if (_placePrefs.hasPref("project_sort_direction")) {
        // See bug 89283 for an explanation of why all windows
        // now have the same sort direction.
        var direction = _placePrefs.getLongPref("project_sort_direction");
        setTimeout(function(mgr, direction) {
                mgr.sortProjects(direction);
            }, 1, this.manager, direction);
    } else {
        // dump('loading... _placePrefs.hasPref("project_sort_direction"): not found\n');
    }
};

this.handle_keypress_setup = function(event) {
    return ko.places.projects.onTreeKeyPress(event);
};

this.activateView = function() {
    ko.projects.manager.setViewMgr(this.manager);
};

this.rebuildView = function() {
    this.projectsTree.treeBoxObject.beginUpdateBatch();
    try {
        this.projectsTreeView.clearTree();
    } finally {
        this.projectsTree.treeBoxObject.endUpdateBatch();
    }
};

this._copyTree = function(srcParentNode, destParentNode) {
    var srcNodes = srcParentNode.childNodes;
    var len = srcNodes.length;
    var attr, destNode, attributes;
    for (var i = 0; i < len; i++) {
        var srcNode = srcNodes[i];
        destNode = document.createElementNS(this.XUL_NS, srcNode.nodeName);
        attributes = srcNode.attributes;
        for (var j = 0; j < attributes.length; j++) {
            attr = attributes[j];
            destNode.setAttribute(attr.name, attr.value);
        }
        destNode.setAttribute("id", this._menuIdPrefix + srcNode.id);
        destParentNode.appendChild(destNode);
        this._copyTree(srcNode, destNode);
    }
}

this.initProjectMRUCogMenu_MPV = function() {
    var srcMenu = parent.document.getElementById("popup_project");
    var destMenu = document.getElementById("placesSubpanelProjectsToolsPopup_MPV");
    var srcNodes = srcMenu.childNodes;
    var node, newNode;
    var len = srcNodes.length;
    for (var i = 0; i < len; i++) {
        node = srcNodes[i];
        if (node.getAttribute("skipCopyToCogMenu") != "true") {
            newNode = node.cloneNode(false);
            newNode.id = node.id + "_places_projects_cog";
            destMenu.appendChild(newNode);
        }
    }
    try {
        srcMenu = document.getElementById("projectPlacesCog_SortMenu");
        var firstChild = destMenu.firstChild;
        srcNodes = srcMenu.childNodes;
        len = srcNodes.length;
        for (i = 0; i < len; i++) {
            node = srcNodes[i];
            newNode = node.cloneNode(false);
            newNode.id = node.id + "_places_projects_cog";
            destMenu.insertBefore(newNode, firstChild);
        }
    } catch(ex) {
        log.exception("initProjectMRUCogMenu_MPV: error: " + ex + "\n");
    }
    window.frameElement.hookupObservers("panel-proxy-commandset");
};

this.copyNewItemMenu = function(targetNode, targetPrefix) {
    var srcNodes = document.getElementById("placesSubpanelProjects_AddItemsMenu").childNodes;
    var attr, node, attributes, value;
    for (var i = 0; i < srcNodes.length; i++) {
        var srcNode = srcNodes[i];
        node = document.createElementNS(this.XUL_NS, srcNode.nodeName);
        attributes = srcNode.attributes;
        for (var j = 0; j < attributes.length; j++) {
            attr = attributes[j];
            value = attr.value;
            if (targetPrefix == "SPV_projView_"
                && attr.name == "oncommand") {
                value = value.replace("ko.places.projects.manager.",
                                      "ko.places.projects_SPV.manager.");
            }
            node.setAttribute(attr.name, value);
        }
        node.setAttribute("id", "projCtxt_" + srcNode.id);
        targetNode.appendChild(node);
    }
};

this.refreshParentShowChildWithTreeview = function(parentPart, newPart,
                                                   projectsTree, treeview) {
    // Expand the extracted folder part and then select it.
    treeview.refresh(parentPart);
    var parentPartIndex = treeview.getIndexByPart(parentPart);
    if (parentPartIndex == -1) {
        log.warn("refreshParentShowChild: can't find part "
                 + parentPart.name
                 + " in the tree");
        return;
    }
    if (!treeview.isContainerOpen(parentPartIndex)) {
        treeview.toggleOpenState(parentPartIndex);
    }
    var childPartIndex  = treeview.getIndexByPart(newPart);
    if (childPartIndex == -1) {
        log.warn("refreshParentShowChild: can't find part "
                 + newPart.name
                 + " in the tree");
        return;
    }
    treeview.selection.select(childPartIndex);
    projectsTree.treeBoxObject.ensureRowIsVisible(childPartIndex);
};

this.refreshParentShowChild = function(parentPart, newPart) {
    this.refreshParentShowChildWithTreeview(parentPart, newPart,
                                            this.projectsTree,
                                            this.projectsTreeView);
};

this.terminate = function() {
    // One sort direction for all windows, last one wins.
    _placePrefs.setLongPref("project_sort_direction",
                            this.projectsTreeView.sortDirection);
    this.projectsTreeView.terminate();
    if (this.projectsTree.treeBoxObject)
        this.projectsTree.treeBoxObject.view = null;
};

// Methods for dealing with the projects tree context menu.

this._projectTestLabelMatcher = /^t:project\|(.+)\|(.+)$/;
this.allowed_click_nodes = ["placesSubpanelProjectsTreechildren",
                            "projectView_AddItemPopup",
                            "placesRootButton"],
this._checkedPublishingMenuLocation = false;
this.initProjectsContextMenu = function(event, menupopup) {
    var clickedNodeId = event.explicitOriginalTarget.id;
    if (this.allowed_click_nodes.indexOf(clickedNodeId) == -1) {
        // We don't want to fillup this context menu (i.e. it's likely a
        // sub-menu such as the scc context menu).
        return false;
    } else if (clickedNodeId == "menu_projCtxt_addMenu_Popup") {
        return true;
    }
    if (!this._checkedPublishingMenuLocation) {
        this._checkedPublishingMenuLocation = true;
        var childNodes = menupopup.childNodes;
        var numNodes = childNodes.length;
        var projectPropertiesPosn = -1, publishingMenuPosn = -1, sccMenuPosn = -1;
        var publishingNode;
        var numToFind = 2;
        for (var i = childNodes.length - 1; i >= 0 && numToFind > 0; i--) {
            switch (childNodes[i].id) {
                case "menu_projCtxt_publishingMenu":
                publishingMenuPosn = i;
                publishingNode = childNodes[i];
                numToFind--;
                break;
                case "menu_projCtxt_projectProperties":
                projectPropertiesPosn = i;
                numToFind--;
                break;
            }
        }
        if (numToFind == 0 && publishingMenuPosn >= projectPropertiesPosn) {
            // Move it so it's after the sccMenu
            menupopup.removeChild(publishingNode);
            menupopup.insertBefore(publishingNode, childNodes[sccMenuPosn + 1]);
        }
    }
    var row = {};
    this.projectsTree.treeBoxObject.getCellAt(event.pageX, event.pageY, row, {},{});
    var index = row.value;
    var treeView = this.projectsTreeView;
    var selectedIndices = ko.treeutils.getSelectedIndices(treeView,
                                                          false /*rootsOnly*/);
    var selectedItems = selectedIndices.map(function(i) treeView.getRowItem(i));
    var currentProject = ko.projects.manager.currentProject;
    if (!selectedItems.length && currentProject) {
        selectedItems = [currentProject];
    }
    var selectedUrls = selectedItems ? selectedItems.map(function(item) item.url) : [];
    var isRootNode = !selectedItems.length && index == -1;
    var itemTypes;
    if (isRootNode) {
        itemTypes = ['root'];
    } else {
        itemTypes = selectedItems.map(function(item) item.type);
    }
    this._selectionInfo = {
      currentProject: (selectedUrls.length == 1
                       && currentProject
                       && currentProject.url == selectedUrls[0]),
      index: index,
      itemTypes: itemTypes,
      multipleNodesSelected: selectedIndices.length > 1,
      projectIsDirty: selectedItems.filter(function(item) item.isDirty).length > 0,
      needSeparator: [false],
      lastVisibleNode: null,
      selectedUrls: selectedUrls,
      noneSelected: selectedUrls.length == 0,
      isLocal: selectedUrls.length > 0 && selectedUrls[0].indexOf("file://") == 0,
      __END__:null
    };
    this._selectionInfo.isRemote = !this._selectionInfo.isLocal;
    this._processProjectsMenu_TopLevel(menupopup);
    delete this._selectionInfo;
    return true;
}

this._processProjectsMenu_TopLevel = function(menuNode) {
    var selectionInfo = this._selectionInfo;
    var itemTypes = selectionInfo.itemTypes;
    var directive;
    if (!!(directive = menuNode.getAttribute('hideIf'))
        && ko.places.matchAnyType(directive, itemTypes)) {
        menuNode.setAttribute('collapsed', true);
        return; // No need to do anything else
    } else if (!!(directive = menuNode.getAttribute('hideUnless'))
               && !ko.places.matchAnyType(directive, itemTypes)) {
        menuNode.setAttribute('collapsed', true);
        return; // No need to do anything else
    }
    if (menuNode.id == "menu_projCtxt_addMenu_Popup"
        && menuNode.childNodes.length == 0) {
        ko.places.projects.copyNewItemMenu(menuNode, "projView_");
        selectionInfo.lastVisibleNode = null;
    } else if (menuNode.nodeName == "menuseparator") {
        if (selectionInfo.needSeparator[0]) {
            menuNode.removeAttribute('collapsed');
            selectionInfo.needSeparator[0] = false;
            selectionInfo.lastVisibleNode = menuNode;
        } else {
            menuNode.setAttribute('collapsed', true);
        }
        return;
    }
    selectionInfo.needSeparator[0] = true;
    selectionInfo.lastVisibleNode = menuNode;
    menuNode.removeAttribute('collapsed');
    ko.places.testDisableNode(menuNode, selectionInfo);
    if (menuNode.id == "menu_projCtxt_SCCmenu") {
        selectionInfo.isFolder = (selectionInfo.itemTypes[0] == 'project'
                                  || selectionInfo.itemTypes[0] == 'folder'
                                  || selectionInfo.itemTypes[0] == 'file'
                                  || gPlacesViewMgr.view.isContainer(selectionInfo.index));
        var commonMenuIdPart = "menu_projCtxt_sccMenu";
        this.initProject_SCC_ContextMenu(menuNode, commonMenuIdPart);
        return;
    }
    var childNodes = menuNode.childNodes;
    var childNodesLength = childNodes.length;
    if (childNodesLength) {
        selectionInfo.needSeparator.unshift(false);
        for (var i = 0; i < childNodesLength; i++) {
            this._processProjectsMenu_TopLevel(childNodes[i]);
        }
        if (selectionInfo.lastVisibleNode
            && selectionInfo.lastVisibleNode.nodeName == "menuseparator") {
            // Collapse the final node
            selectionInfo.lastVisibleNode.setAttribute('collapsed', true);
            selectionInfo.lastVisibleNode = null;
        }
        selectionInfo.needSeparator.shift();
    }
};

this.initProject_SCC_ContextMenu = function(menuNode, commonPart) {
    var popupmenu = menuNode.childNodes[0];
    var selectionInfo = this._selectionInfo;
    if (!selectionInfo.isLocal) {
        ko.places.viewMgr._disable_all_items(popupmenu);
        return;
    }
    var enabled_scc_components = ko.scc.getAvailableSCCComponents(true);
    if (!enabled_scc_components.length) {
        // No scc components are enabled for functional.
        ko.places.viewMgr._disable_all_items(popupmenu);
        return;
    }
    if (selectionInfo.multipleNodesSelected) {
        ko.places.viewMgr._disable_all_items(popupmenu);
        return;
    }
    var index = selectionInfo.index;
    var uri = selectionInfo.selectedUrls[0];
    var fileObj = (Components.classes["@activestate.com/koFileService;1"].
                   getService(Components.interfaces.koIFileService).
                   getFileFromURI(uri));
    var sccObj = {};
    var isFolder = selectionInfo.itemTypes[0] == "livefolder";
    if (!ko.places.viewMgr._determineItemSCCSupport(fileObj, sccObj, isFolder)) {
        // use this function to disable everything
        ko.places.viewMgr._disable_all_items(popupmenu);
        return;
    }
    var status_by_name = ko.places.viewMgr.setupSCCStatus(fileObj, sccObj, isFolder);
    for (var menuitem, i = 0; menuitem = popupmenu.childNodes[i]; ++i) {
        var id = menuitem.id;
        var lastPart = id.substring(commonPart.length).toLowerCase();
        if (status_by_name[lastPart]) {
            menuitem.removeAttribute("disabled");
            var command = ("ko.projects.SCC.doCommand('"
                           + menuitem.getAttribute("observes")
                           + "');");
            menuitem.setAttribute("oncommand", command);
        } else {
            menuitem.setAttribute("disabled", "true");
        }
    }
};

this.getFocusedProjectView = function() {
    var w = require("ko/windows").getMain();
    if ( ! xtk.domutils.elementInFocus(w.document.getElementById('placesViewbox')))
        return null;
    if (xtk.domutils.elementInFocus(document.getElementById('placesSubpanelProjects_MPV'))) {
        return this;
    }
    return null;
};

this.toggleSubpanel = function() {
    var splitter = document.getElementById("placesSubpanelSplitter");
    var state = splitter.getAttribute("state");
    if (state == "collapsed") {
        splitter.setAttribute("state", "");
    }
    else {
        splitter.setAttribute("state", "collapsed");
    }
    this._updateSubpanelFromState();
};

this._updateSubpanelFromState = function() {
    var splitter = document.getElementById("placesSubpanelSplitter");
    var deck = document.getElementById("placesSubpanelDeck");
    var state = splitter.getAttribute("state");
	
	if (state == "collapsed")
	{
		deck.collapsed = true;
	}
	else
	{
		deck.collapsed = false;
	}
}

this.stopEvent = function(event) {
    event.preventDefault();
    event.stopPropagation();
    return false;
};

}).apply(ko.places.projects);
