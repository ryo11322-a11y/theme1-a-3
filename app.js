const createFolder = (id, name, children = []) => ({
  id,
  type: "folder",
  name,
  unread: 0,
  children,
});

const createChat = (id, name, unread = 0) => ({
  id,
  type: "chat",
  name,
  unread,
  children: [],
});

const folders = [
  createFolder("sample-ooo", "○○部", [
    createChat("sample-ooo-talk", "雑談", 1),
    createChat("sample-ooo-event", "行事", 0),
    createChat("sample-ooo-work", "業務連絡", 0),
    createChat("sample-ooo-attendance", "出欠", 0),
  ]),
  createFolder("sample-circle", "サークル", [
    createChat("sample-circle-fitness", "体育会", 0),
    createChat("sample-circle-culture", "文化系", 0),
    createChat("sample-circle-other", "その他", 0),
  ]),
  createFolder("sample-edu", "学科関係", [
    createChat("sample-edu-lecture", "講義連絡", 0),
    createChat("sample-edu-seminar", "ゼミ", 0),
    createChat("sample-edu-lab", "研究室", 0),
    createChat("sample-edu-chat", "学科の雑談", 0),
    createChat("sample-edu-other", "その他", 0),
  ]),
];

let selectedFolderId = null;
let renamingFolderId = null;
let deleteTargetId = null;
const expandedFolderIds = new Set(["sample-ooo", "sample-circle", "sample-edu"]);
let draggedNodeId = null;
let holdTimer = null;

function isFolder(node) {
  return !!node && node.type === "folder";
}

function normalizeName(name) {
  const trimmed = (name || "").trim();
  return trimmed === "" || trimmed.toLowerCase() === "untitled" ? "Untitled" : trimmed;
}

function isMobileLayout() {
  return window.matchMedia("(max-width: 720px)").matches;
}

function setMobileView(view) {
  const appShell = document.querySelector(".app-shell");
  if (!appShell) return;

  appShell.classList.toggle("mobile-files-open", view === "files");
  appShell.classList.toggle("mobile-chat-open", view === "chat");
}

function openFileListOnMobile() {
  if (!isMobileLayout()) return;
  setMobileView("files");
}

function openChatOnMobile() {
  if (!isMobileLayout()) return;
  setMobileView("chat");
}

function getSelectedNode() {
  if (!selectedFolderId) return null;
  return findNodeById(selectedFolderId);
}

function markChatAsRead(chatId) {
  const chat = findNodeById(chatId);
  if (chat && !isFolder(chat)) {
    chat.unread = 0;
  }
}

function updateContentPanel() {
  const selectedNode = getSelectedNode();
  const channelHeader = document.querySelector(".channel-header");
  const messageList = document.querySelector(".message-list");
  const composer = document.querySelector(".composer");
  const emptyState = document.querySelector(".empty-state");
  const isChatSelected = !!selectedNode && !isFolder(selectedNode);

  if (channelHeader) channelHeader.hidden = !isChatSelected;
  if (messageList) messageList.hidden = !isChatSelected;
  if (composer) composer.hidden = !isChatSelected;
  if (emptyState) emptyState.hidden = isChatSelected;

  if (isChatSelected) {
    const nameEl = document.querySelector(".channel-name");
    selectedNode.unread = 0;
    if (nameEl) nameEl.textContent = normalizeName(selectedNode.name || "Untitled");
    if (messageList) {
      const testMessage = selectedNode.id === "sample-ooo-talk";
      messageList.innerHTML = testMessage
        ? `
          <div class="message-row">
            <div class="avatar avatar-a">A</div>
            <div class="message-bubble">
              <div class="message-meta"><span class="sender">A</span><span class="time">09:00</span></div>
              <p>テストメッセージ</p>
            </div>
          </div>
        `
        : "";
    }
  }
}

function getUnreadTotal(item) {
  if (!item) return 0;

  if (!isFolder(item)) {
    return Number(item.unread || 0);
  }

  return item.children.reduce((sum, child) => sum + getUnreadTotal(child), 0);
}

function findNodeById(nodeId, items = folders) {
  for (const item of items) {
    if (item.id === nodeId) return item;
    if (isFolder(item) && item.children && item.children.length) {
      const found = findNodeById(nodeId, item.children);
      if (found) return found;
    }
  }
  return null;
}

function findParentFolder(nodeId, items = folders, parentFolder = null) {
  for (const item of items) {
    if (item.id === nodeId) return parentFolder;
    if (isFolder(item) && item.children && item.children.length) {
      const found = findParentFolder(nodeId, item.children, item);
      if (found !== undefined) return found;
    }
  }
  return null;
}

function findNodeContext(nodeId, items = folders) {
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];

    if (item.id === nodeId) {
      return { item, parentArray: items, index };
    }

    if (isFolder(item) && item.children && item.children.length) {
      const childContext = findNodeContext(nodeId, item.children);
      if (childContext) {
        return childContext;
      }
    }
  }

  return null;
}

function containsNodeId(folderId, targetId) {
  const folder = findNodeById(folderId);
  if (!folder || !isFolder(folder)) return false;

  const walk = (items) => {
    for (const item of items) {
      if (item.id === targetId) return true;
      if (isFolder(item) && walk(item.children)) return true;
    }
    return false;
  };

  return walk(folder.children || []);
}

function removeNodeById(nodeId, items = folders) {
  const index = items.findIndex((item) => item.id === nodeId);
  if (index !== -1) {
    const [removedItem] = items.splice(index, 1);
    if (removedItem && isFolder(removedItem) && Array.isArray(removedItem.children)) {
      items.splice(index, 0, ...removedItem.children);
    }

    return true;
  }

  for (const item of items) {
    if (isFolder(item) && item.children && item.children.length) {
      if (removeNodeById(nodeId, item.children)) return true;
    }
  }

  return false;
}

function moveNodeToDestination(nodeId, targetFolderId = null, insertBeforeId = null) {
  if (!nodeId) return;

  const draggedNode = findNodeById(nodeId);
  if (!draggedNode) return;

  const sourceContext = findNodeContext(nodeId);
  if (!sourceContext) return;

  const targetFolder = targetFolderId ? findNodeById(targetFolderId) : null;

  // 自分の中に入れない
  if (
    isFolder(draggedNode) &&
    targetFolder &&
    isFolder(targetFolder) &&
    containsNodeId(draggedNode.id, targetFolder.id)
  ) {
    return;
  }

  // 元の位置から削除
  sourceContext.parentArray.splice(sourceContext.index, 1);

  // 移動先の配列
  const targetArray = targetFolder && isFolder(targetFolder)
    ? targetFolder.children
    : folders;

  // どこに入れるか
  let insertIndex = targetArray.length;
  if (insertBeforeId) {
    const index = targetArray.findIndex((item) => item.id === insertBeforeId);
    if (index !== -1) insertIndex = index;
  }

  targetArray.splice(insertIndex, 0, draggedNode);
}

function getDropLocation(targetNodeId, clientY) {
  const targetNode = findNodeById(targetNodeId);
  if (!targetNode) return { targetFolderId: null, insertBeforeId: null };

  if (isFolder(targetNode)) {
    return { targetFolderId: targetNode.id, insertBeforeId: null };
  }

  const parentFolder = findParentFolder(targetNodeId) || null;
  const parentArray = parentFolder ? parentFolder.children : folders;
  const index = parentArray.findIndex((item) => item.id === targetNodeId);

  if (index === -1) {
    return { targetFolderId: parentFolder ? parentFolder.id : null, insertBeforeId: null };
  }

  const row = document.querySelector(`[data-node-id="${CSS.escape(targetNodeId)}"]`);
  const rect = row?.getBoundingClientRect();
  const isBefore = rect ? clientY < rect.top + rect.height / 2 : true;
  const nextSiblingId = parentArray[index + 1]?.id ?? null;

  return {
    targetFolderId: parentFolder ? parentFolder.id : null,
    insertBeforeId: isBefore ? targetNodeId : nextSiblingId,
  };
}

function clearHoldTimer() {
  if (holdTimer) {
    clearTimeout(holdTimer);
    holdTimer = null;
  }
}

function openRenameModal(folderId) {
  const folder = findNodeById(folderId);
  if (!folder || !isFolder(folder)) return;

  renamingFolderId = folderId;
  selectedFolderId = folderId;

  const input = document.getElementById("renameInput");
  const modal = document.getElementById("renameModal");
  if (!input || !modal) return;

  input.value = folder.name || "";
  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
  setTimeout(() => input.focus(), 50);
}

function closeRenameModal() {
  const modal = document.getElementById("renameModal");
  if (!modal) return;
  modal.classList.remove("show");
  modal.setAttribute("aria-hidden", "true");
}

function saveFolderName() {
  if (!renamingFolderId) return;

  const folder = findNodeById(renamingFolderId);
  if (!folder || !isFolder(folder)) return;

  const input = document.getElementById("renameInput");
  folder.name = normalizeName(input?.value || "");

  renamingFolderId = null;
  closeRenameModal();
  renderFolderList();
}

function cancelRename() {
  renamingFolderId = null;
  closeRenameModal();
}

function openDeleteModal(folderId) {
  const folder = findNodeById(folderId);
  if (!folder || !isFolder(folder)) return;

  deleteTargetId = folderId;
  selectedFolderId = folderId;

  const modal = document.getElementById("deleteModal");
  const label = document.getElementById("deleteFolderName");
  if (!modal || !label) return;

  label.textContent = normalizeName(folder.name || "Untitled");
  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
}

function closeDeleteModal() {
  const modal = document.getElementById("deleteModal");
  if (!modal) return;
  modal.classList.remove("show");
  modal.setAttribute("aria-hidden", "true");
}

function confirmDelete() {
  if (!deleteTargetId) return;

  removeNodeById(deleteTargetId);
  if (selectedFolderId === deleteTargetId) selectedFolderId = null;

  deleteTargetId = null;
  closeDeleteModal();
  renderFolderList();
}

function cancelDelete() {
  deleteTargetId = null;
  closeDeleteModal();
}

function addFolder() {
  const selectedNode = selectedFolderId ? findNodeById(selectedFolderId) : null;
  const parentFolder = selectedNode && isFolder(selectedNode)
    ? selectedNode
    : findParentFolder(selectedFolderId || "") || null;

  const targetArray = parentFolder ? parentFolder.children : folders;
  const newFolder = createFolder(
    `folder-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    "Untitled",
    []
  );

  targetArray.push(newFolder);
  if (parentFolder) {
    expandedFolderIds.add(parentFolder.id);
  }

  selectedFolderId = newFolder.id;
  renderFolderList();
  openRenameModal(newFolder.id);
}

function renderFolderList() {
  const folderList = document.getElementById("folderList");
  if (!folderList) return;

  const drawTree = (items) => {
    const fragment = document.createDocumentFragment();

    items.forEach((item) => {
      const isItemFolder = isFolder(item);
      const hasChildren = isItemFolder && item.children && item.children.length > 0;
      const unreadTotal = getUnreadTotal(item);

      const wrapper = document.createElement("div");
      wrapper.className = "folder-node";

      const row = document.createElement("div");
      row.className = `folder-row${selectedFolderId === item.id ? " active" : ""}${isItemFolder ? " folder-row--folder" : " folder-row--chat"}`;
      row.dataset.nodeId = item.id;
      row.dataset.nodeType = item.type;
      row.draggable = true;

      const toggleWrap = document.createElement("span");
      toggleWrap.className = "folder-toggle-wrap";

      if (isItemFolder) {
        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = `folder-toggle${expandedFolderIds.has(item.id) ? " open" : ""}`;
        toggle.textContent = "›";
        toggle.setAttribute("aria-label", `${item.name} の展開状態を切り替え`);
        toggle.addEventListener("click", (event) => {
          event.stopPropagation();
          if (expandedFolderIds.has(item.id)) expandedFolderIds.delete(item.id);
          else expandedFolderIds.add(item.id);
          renderFolderList();
        });
        toggleWrap.appendChild(toggle);
      } else {
        const placeholder = document.createElement("span");
        placeholder.className = "folder-toggle-placeholder";
        placeholder.textContent = "";
        toggleWrap.appendChild(placeholder);
      }

      const nameWrap = document.createElement("div");
      nameWrap.className = "folder-name-wrap";

      const icon = document.createElement("span");
      icon.className = "folder-icon";
      icon.textContent = isItemFolder ? "📁" : "#";

      const label = document.createElement("span");
      label.className = "folder-label";
      label.textContent = normalizeName(item.name || "Untitled");

      nameWrap.append(icon, label);

      const count = document.createElement("span");
      count.className = `folder-count${unreadTotal > 0 ? "" : " empty"}`;
      count.textContent = unreadTotal > 0 ? String(unreadTotal) : "";

      const actions = document.createElement("div");
      actions.className = "folder-actions";

      if (isItemFolder) {
        const renameBtn = document.createElement("button");
        renameBtn.type = "button";
        renameBtn.className = "mini-action";
        renameBtn.textContent = "✎";
        renameBtn.setAttribute("aria-label", `${item.name} を名前変更`);
        renameBtn.addEventListener("click", (event) => {
          event.stopPropagation();
          openRenameModal(item.id);
        });

        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "mini-action";
        deleteBtn.textContent = "🗑";
        deleteBtn.setAttribute("aria-label", `${item.name} を削除`);
        deleteBtn.addEventListener("click", (event) => {
          event.stopPropagation();
          openDeleteModal(item.id);
        });

        actions.append(renameBtn, deleteBtn);
      }

      row.append(toggleWrap, nameWrap, count, actions);
      row.addEventListener("click", (event) => {
        if (event.target.closest("button")) return;

        if (isItemFolder && hasChildren) {
          selectedFolderId = item.id;
          updateContentPanel();
          renderFolderList();
          return;
        }

        if (!isItemFolder) {
          selectedFolderId = item.id;
          markChatAsRead(item.id);
          updateContentPanel();
          renderFolderList();
          if (isMobileLayout()) {
            openChatOnMobile();
          }
          return;
        }

        selectedFolderId = item.id;
        updateContentPanel();
      });

      row.addEventListener("pointerdown", (event) => {
        if (event.target.closest("button")) return;
        clearHoldTimer();
        holdTimer = setTimeout(() => {
          draggedNodeId = item.id;
          row.classList.add("drag-source");
          row.setAttribute("aria-grabbed", "true");
        }, 220);
      });

      row.addEventListener("pointerup", clearHoldTimer);
      row.addEventListener("pointerleave", clearHoldTimer);
      row.addEventListener("pointercancel", clearHoldTimer);

      row.addEventListener("dragstart", (event) => {
        draggedNodeId = item.id;
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", item.id);
        row.classList.add("drag-source");
      });

      row.addEventListener("dragover", (event) => {
        if (!draggedNodeId || draggedNodeId === item.id) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";

        const { targetFolderId, insertBeforeId } = getDropLocation(item.id, event.clientY);
        const rect = row.getBoundingClientRect();
        const isBefore = event.clientY < rect.top + rect.height / 2;

        row.classList.add("drop-target");
        row.dataset.insertBefore = String(isBefore);
        row.dataset.targetFolderId = targetFolderId || "";
        row.dataset.insertBeforeId = insertBeforeId || "";
      });

      row.addEventListener("drop", (event) => {
        event.preventDefault();
        event.stopPropagation();

        const { targetFolderId, insertBeforeId } = getDropLocation(item.id, event.clientY);
        moveNodeToDestination(draggedNodeId, targetFolderId, insertBeforeId);
        draggedNodeId = null;
        clearHoldTimer();
        renderFolderList();
      });

      row.addEventListener("dragend", () => {
        row.classList.remove("drag-source", "drop-target");
        draggedNodeId = null;
        clearHoldTimer();
      });

      wrapper.appendChild(row);

      if (isItemFolder && hasChildren && expandedFolderIds.has(item.id)) {
        const childrenContainer = document.createElement("div");
        childrenContainer.className = "folder-children";
        childrenContainer.appendChild(drawTree(item.children));
        wrapper.appendChild(childrenContainer);
      }

      fragment.appendChild(wrapper);
    });

    return fragment;
  };

  folderList.innerHTML = "";
  folderList.appendChild(drawTree(folders));
  updateContentPanel();
}

document.addEventListener("DOMContentLoaded", () => {
  const addButton = document.getElementById("addFolderButton");
  if (addButton) addButton.addEventListener("click", addFolder);

  const channelActionButton = document.querySelector(".channel-action");
  if (channelActionButton) {
    channelActionButton.addEventListener("click", () => {
      const appShell = document.querySelector(".app-shell");
      if (!appShell) return;
      const shouldOpenFiles = !appShell.classList.contains("mobile-files-open");
      setMobileView(shouldOpenFiles ? "files" : "chat");
    });
  }

  const channelBackButton = document.querySelector(".channel-back");
  if (channelBackButton) {
    channelBackButton.addEventListener("click", () => {
      openFileListOnMobile();
    });
  }

  document.getElementById("saveRename")?.addEventListener("click", saveFolderName);
  document.getElementById("cancelRename")?.addEventListener("click", cancelRename);
  document.getElementById("confirmDelete")?.addEventListener("click", confirmDelete);
  document.getElementById("cancelDelete")?.addEventListener("click", cancelDelete);
  document.getElementById("renameInput")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") saveFolderName();
    if (event.key === "Escape") cancelRename();
  });

  const folderList = document.getElementById("folderList");
  if (folderList) {
    folderList.addEventListener("dragover", (event) => {
      if (!draggedNodeId) return;
      event.preventDefault();
      folderList.classList.add("drop-root");
    });

    folderList.addEventListener("dragleave", () => {
      folderList.classList.remove("drop-root");
    });

    folderList.addEventListener("drop", (event) => {
      event.preventDefault();
      event.stopPropagation();
      folderList.classList.remove("drop-root");

      moveNodeToDestination(draggedNodeId, null, null);
      draggedNodeId = null;
      clearHoldTimer();
      renderFolderList();
    });
  }

  window.addEventListener("resize", () => {
    if (!isMobileLayout()) {
      const appShell = document.querySelector(".app-shell");
      if (appShell) {
        appShell.classList.remove("mobile-files-open", "mobile-chat-open");
      }
      return;
    }

    const appShell = document.querySelector(".app-shell");
    if (appShell && !appShell.classList.contains("mobile-files-open") && !appShell.classList.contains("mobile-chat-open")) {
      setMobileView("files");
    }
  });

  selectedFolderId = null;
  renamingFolderId = null;
  deleteTargetId = null;
  setMobileView("files");
  updateContentPanel();
  renderFolderList();
});
