const createFolder = (id, name, children = []) => ({
  id,
  type: "folder",
  name,
  unread: 1,
  children,
});

const createChat = (id, name, unread = 1) => ({
  id,
  type: "chat",
  name,
  unread,
  children: [],
});

const folders = [
  createFolder("sample-ooo", "○○部", [
    createChat("sample-ooo-talk", "雑談", 1),
    createChat("sample-ooo-event", "行事", 1),
    createChat("sample-ooo-work", "業務連絡", 1),
    createChat("sample-ooo-attendance", "出欠", 1),
  ]),
  createFolder("sample-circle", "サークル", [
    createChat("sample-circle-fitness", "体育会", 1),
    createChat("sample-circle-culture", "文化系", 1),
    createChat("sample-circle-other", "その他", 1),
  ]),
  createFolder("sample-edu", "学科関係", [
    createChat("sample-edu-lecture", "講義連絡", 1),
    createChat("sample-edu-seminar", "ゼミ", 1),
    createChat("sample-edu-lab", "研究室", 1),
    createChat("sample-edu-chat", "学科の雑談", 1),
    createChat("sample-edu-other", "その他", 1),
  ]),
];

let selectedFolderId = null;
let renamingFolderId = null;
let deleteTargetId = null;
const expandedFolderIds = new Set(["sample-ooo", "sample-circle", "sample-edu"]);
let draggedNodeId = null;
let holdTimer = null;
let dragExpandTimer = null;
let dragExpandFolderId = null;
let pendingNewFolderId = null;

function setRenameModalMode(mode) {
  const modal = document.getElementById("renameModal");
  if (!modal) return;

  const titleEl =
    document.getElementById("renameModalTitle") ||
    modal.querySelector("[data-rename-title]") ||
    modal.querySelector(".rename-modal__title") ||
    modal.querySelector("h2") ||
    modal.querySelector("h3");

  if (titleEl) {
    titleEl.textContent = mode === "create" ? "フォルダを追加" : "フォルダ名を変更";
  }

  modal.dataset.mode = mode;
}

function openRenameModal(folderId, mode = "rename") {
  const folder = findNodeById(folderId);
  if (!folder || !isFolder(folder)) return;

  renamingFolderId = folderId;
  selectedFolderId = folderId;
  pendingNewFolderId = mode === "create" ? folderId : null;

  const input = document.getElementById("renameInput");
  const modal = document.getElementById("renameModal");
  if (!input || !modal) return;

  setRenameModalMode(mode);
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

  pendingNewFolderId = null;
  renamingFolderId = null;
  closeRenameModal();
  renderFolderList();
}

function cancelRename() {
  if (renamingFolderId && pendingNewFolderId === renamingFolderId) {
    removeNodeById(renamingFolderId);
    if (selectedFolderId === renamingFolderId) {
      selectedFolderId = null;
    }
    pendingNewFolderId = null;
    renderFolderList();
  }

  renamingFolderId = null;
  closeRenameModal();
}

function showAddTypeModal() {
  const modal = document.getElementById("addTypeModal");
  if (!modal) return;
  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
}

function closeAddTypeModal() {
  const modal = document.getElementById("addTypeModal");
  if (!modal) return;
  modal.classList.remove("show");
  modal.setAttribute("aria-hidden", "true");
}

function handleAddTypeSelection(type) {
  closeAddTypeModal();

  if (type === "chat") {
    const selectedNode = selectedFolderId ? findNodeById(selectedFolderId) : null;
    const parentFolder =
      selectedNode && isFolder(selectedNode)
        ? selectedNode
        : findParentFolder(selectedFolderId || "") || null;

    const targetArray = parentFolder ? parentFolder.children : folders;
    const newChat = createChat(
      `chat-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      "新しいチャット",
      1
    );

    targetArray.push(newChat);
    if (parentFolder) {
      expandedFolderIds.add(parentFolder.id);
    }

    selectedFolderId = newChat.id;
    renderFolderList();
    if (isMobileLayout()) {
      openChatOnMobile();
    }
    return;
  }

  addFolder();
}

function addFolder() {
  const selectedNode = selectedFolderId ? findNodeById(selectedFolderId) : null;
  const parentFolder =
    selectedNode && isFolder(selectedNode)
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
  openRenameModal(newFolder.id, "create");
}

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
      const testMessage = "これはテストです。チャットは機能しません。本来はここにチャットの画面が表示されます。";
      messageList.innerHTML = `
        <div class="message-row">
          <div class="avatar avatar-a">T</div>
          <div class="message-bubble">
            <div class="message-meta">
              <span class="sender">Test</span>
              <span class="time">今</span>
            </div>
            <p>${testMessage}</p>
          </div>
        </div>
      `;
    }
    if (composer) {
      composer.innerHTML = "";
      composer.setAttribute("aria-label", "テストメッセージ");
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

  if (
    isFolder(draggedNode) &&
    targetFolder &&
    isFolder(targetFolder) &&
    containsNodeId(draggedNode.id, targetFolder.id)
  ) {
    return;
  }

  sourceContext.parentArray.splice(sourceContext.index, 1);

  const targetArray = targetFolder && isFolder(targetFolder)
    ? targetFolder.children
    : folders;

  let insertIndex = targetArray.length;
  if (insertBeforeId) {
    const index = targetArray.findIndex((item) => item.id === insertBeforeId);
    if (index !== -1) insertIndex = index;
  }

  targetArray.splice(insertIndex, 0, draggedNode);
}

function getHoveredFolderRow(event) {
  const target = event.target;
  if (target instanceof Element) {
    const row = target.closest(".folder-row");
    if (row) return row;
  }

  return document.elementFromPoint(event.clientX, event.clientY)?.closest(".folder-row") || null;
}

function getDropLocation(targetNodeId, clientY) {
  if (!targetNodeId) return { targetFolderId: null, insertBeforeId: null };

  const targetNode = findNodeById(targetNodeId);
  if (!targetNode) return { targetFolderId: null, insertBeforeId: null };

  const parentFolder = findParentFolder(targetNodeId) || null;
  const parentArray = parentFolder ? parentFolder.children : folders;
  const index = parentArray.findIndex((item) => item.id === targetNodeId);

  if (index === -1) {
    return {
      targetFolderId: parentFolder ? parentFolder.id : null,
      insertBeforeId: null,
    };
  }

  const row = document.querySelector(`[data-node-id="${CSS.escape(targetNodeId)}"]`);
  const rect = row?.getBoundingClientRect();
  if (!rect) {
    return {
      targetFolderId: isFolder(targetNode) ? targetNode.id : (parentFolder ? parentFolder.id : null),
      insertBeforeId: null,
    };
  }

  const yRatio = (clientY - rect.top) / rect.height;
  const nextSiblingId = parentArray[index + 1]?.id ?? null;

  if (isFolder(targetNode)) {
    if (yRatio < 0.35) {
      return {
        targetFolderId: parentFolder ? parentFolder.id : null,
        insertBeforeId: targetNodeId,
      };
    }

    if (yRatio > 0.65) {
      return {
        targetFolderId: parentFolder ? parentFolder.id : null,
        insertBeforeId: nextSiblingId,
      };
    }

    return {
      targetFolderId: targetNode.id,
      insertBeforeId: null,
    };
  }

  if (yRatio < 0.5) {
    return {
      targetFolderId: parentFolder ? parentFolder.id : null,
      insertBeforeId: targetNodeId,
    };
  }

  return {
    targetFolderId: parentFolder ? parentFolder.id : null,
    insertBeforeId: nextSiblingId,
  };
}

function clearHoldTimer() {
  if (holdTimer) {
    clearTimeout(holdTimer);
    holdTimer = null;
  }
}

function clearDragExpandTimer() {
  if (dragExpandTimer) {
    clearTimeout(dragExpandTimer);
    dragExpandTimer = null;
  }
  dragExpandFolderId = null;
}

function clearDropHighlights() {
  document.querySelectorAll(".folder-row").forEach((row) => {
    row.classList.remove("drop-target", "drop-before", "drop-after", "drop-inside");
    delete row.dataset.dropPosition;
    delete row.dataset.insertBefore;
    delete row.dataset.targetFolderId;
    delete row.dataset.insertBeforeId;
  });
}

function scheduleFolderExpand(folderId) {
  if (!folderId || expandedFolderIds.has(folderId)) {
    clearDragExpandTimer();
    return;
  }

  const folder = findNodeById(folderId);
  if (!folder || !isFolder(folder)) {
    clearDragExpandTimer();
    return;
  }

  if (dragExpandFolderId === folderId && dragExpandTimer) return;

  clearDragExpandTimer();
  dragExpandFolderId = folderId;
  dragExpandTimer = setTimeout(() => {
    const target = findNodeById(folderId);
    if (target && isFolder(target) && !expandedFolderIds.has(folderId)) {
      expandedFolderIds.add(folderId);
      renderFolderList();
    }
    clearDragExpandTimer();
  }, 450);
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

        clearDropHighlights();

        if (isFolder(item) && !expandedFolderIds.has(item.id)) {
          scheduleFolderExpand(item.id);
        } else {
          clearDragExpandTimer();
        }

        const rect = row.getBoundingClientRect();
        const yRatio = (event.clientY - rect.top) / rect.height;
        const isFolderTarget = isFolder(item);
        const dropPosition = isFolderTarget
          ? (yRatio < 0.35 ? "before" : yRatio > 0.65 ? "after" : "inside")
          : (yRatio < 0.5 ? "before" : "after");

        row.classList.add("drop-target", `drop-${dropPosition}`);

        const { targetFolderId, insertBeforeId } = getDropLocation(item.id, event.clientY);
        row.dataset.insertBefore = String(event.clientY < rect.top + rect.height / 2);
        row.dataset.targetFolderId = targetFolderId || "";
        row.dataset.insertBeforeId = insertBeforeId || "";
        row.dataset.dropPosition = dropPosition;
      });

      row.addEventListener("drop", (event) => {
        event.preventDefault();
        event.stopPropagation();
        clearDragExpandTimer();

        const { targetFolderId, insertBeforeId } = getDropLocation(item.id, event.clientY);
        moveNodeToDestination(draggedNodeId, targetFolderId, insertBeforeId);
        draggedNodeId = null;
        clearHoldTimer();
        renderFolderList();
      });

      row.addEventListener("dragend", () => {
        row.classList.remove("drag-source", "drop-target", "drop-before", "drop-after", "drop-inside");
        clearDropHighlights();
        clearDragExpandTimer();
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
  const addFolderButton = document.getElementById("addFolderButton");
  if (addFolderButton) addFolderButton.addEventListener("click", showAddTypeModal);

  const addChatButton = document.getElementById("addChatButton");
  if (addChatButton) addChatButton.addEventListener("click", showAddTypeModal);

  const addTypeButtons = document.querySelectorAll("[data-add-type]");
  addTypeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      handleAddTypeSelection(button.dataset.addType);
    });
  });

  const closeAddTypeButton = document.getElementById("closeAddTypeModal");
  if (closeAddTypeButton) {
    closeAddTypeButton.addEventListener("click", closeAddTypeModal);
  }

  const addTypeModal = document.getElementById("addTypeModal");
  if (addTypeModal) {
    addTypeModal.addEventListener("click", (event) => {
      if (event.target === addTypeModal) closeAddTypeModal();
    });
  }

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

      clearDropHighlights();
      const targetRow = getHoveredFolderRow(event);
      if (!targetRow) {
        event.preventDefault();
        folderList.classList.add("drop-root");
        clearDragExpandTimer();
        return;
      }

      const targetNode = findNodeById(targetRow.dataset.nodeId);
      if (targetNode && isFolder(targetNode) && !expandedFolderIds.has(targetNode.id)) {
        scheduleFolderExpand(targetNode.id);
      } else {
        clearDragExpandTimer();
      }

      folderList.classList.remove("drop-root");
      event.preventDefault();
    });

    folderList.addEventListener("drop", (event) => {
      event.preventDefault();
      event.stopPropagation();
      folderList.classList.remove("drop-root");
      clearDropHighlights();
      clearDragExpandTimer();

      const targetRow = getHoveredFolderRow(event);
      if (!targetRow || !targetRow.dataset.nodeId) {
        moveNodeToDestination(draggedNodeId, null, null);
        draggedNodeId = null;
        clearHoldTimer();
        renderFolderList();
        return;
      }

      const { targetFolderId, insertBeforeId } = getDropLocation(targetRow.dataset.nodeId, event.clientY);
      moveNodeToDestination(draggedNodeId, targetFolderId, insertBeforeId);
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
