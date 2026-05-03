/**
 * @fileoverview Spider Map visual editor.
 *
 * The Spider Map displays the site configuration as a draggable node graph.
 * "Haupt" (main) nodes represent category buttons; "Side" nodes represent
 * the option items beneath each category.  The centre node represents the
 * website itself and opens global settings when clicked.
 *
 * @example
 *   const editor = new SpiderMapEditor({
 *     getConfig:       () => currentConfig,
 *     onConfigChange:  (cfg) => { currentConfig = cfg; applySiteConfig(cfg); },
 *     onSave:          async (cfg) => { await saveConfigToGitHub(cfg, pat); },
 *     onUndo:          () => { ... },
 *     onRedo:          () => { ... },
 *     onReset:         async () => { ... },
 *     onLogout:        () => { ... },
 *     getHistoryState: () => ({ canUndo, canRedo }),
 *   });
 *   editor.open();
 */

import { DEFAULT_SITE_CONFIG } from "./constants.js";
import { normalizeSiteConfig } from "./config.js";
import {
  readImageFileAsDataUrl,
  sanitizeColor,
  sanitizeImageUrl,
  sanitizeItems,
  sanitizeString,
  slugify,
} from "./utils.js";

// ---------------------------------------------------------------------------
// Type definitions
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} MapNode
 * @property {string}                     id
 * @property {"center"|"haupt"|"side"}    type
 * @property {string}                     label
 * @property {number}                     x
 * @property {number}                     y
 * @property {string|null}                parentId
 * @property {string}                     [buttonId]
 * @property {string}                     [title]
 * @property {string}                     [backgroundColor]
 * @property {string}                     [textColor]
 * @property {string}                     [imageUrl]
 * @property {string}                     [stepBackgroundImageUrl]
 * @property {number}                     [itemIndex]
 * @property {number}                     createdOrder
 */

/**
 * @typedef {Object} DragState
 * @property {string}  nodeId
 * @property {number}  offsetX
 * @property {number}  offsetY
 * @property {number}  pointerId
 * @property {number}  startX
 * @property {number}  startY
 * @property {boolean} moved
 */

// ---------------------------------------------------------------------------
// SpiderMapEditor
// ---------------------------------------------------------------------------

export class SpiderMapEditor {
  // ── Layout constants ───────────────────────────────────────────────────────

  /** Radius from the centre node to each Haupt node (px). */
  static HAUPT_RADIUS = 240;
  /** Radius from a Haupt node to each of its Side nodes (px). */
  static SIDE_RADIUS = 165;
  /** Distance threshold below which a snap indicator is shown while dragging (px). */
  static SNAP_DIST = 90;
  /** Distance at which a dragged node is repositioned when released near another (px). */
  static SNAP_ATTACH_DIST = 170;
  /** Minimum pointer travel before a press is treated as a drag, not a click (px). */
  static DRAG_THRESHOLD = 5;
  /** Total angular spread of the Side-node fan around each Haupt node (radians). */
  static FAN_SPREAD = Math.PI / 2.5;

  // ── Instance state ─────────────────────────────────────────────────────────

  /** @type {MapNode[]} */
  _nodes = [];

  /**
   * Persisted node positions keyed by node ID.
   * These override the computed default layout when the graph is rebuilt.
   * @type {Record<string, {x: number, y: number}>}
   */
  _savedPositions = {};

  /** @type {DragState|null} */
  _dragging = null;

  /** ID of the node currently highlighted as a snap target, or `null`. @type {string|null} */
  _snapTargetId = null;

  /**
   * When the inline editor panel is open, this function reads the current
   * form state and returns the updated `SiteConfig`.
   * `null` when the panel is closed.
   * @type {(() => import('./constants.js').SiteConfig)|null}
   */
  _currentEditNodeReadFn = null;

  // ── Constructor ────────────────────────────────────────────────────────────

  /**
   * @param {Object} opts
   * @param {() => import('./constants.js').SiteConfig} opts.getConfig
   * @param {(config: import('./constants.js').SiteConfig) => void} opts.onConfigChange
   * @param {(config: import('./constants.js').SiteConfig) => Promise<void>} opts.onSave
   * @param {() => void} opts.onUndo
   * @param {() => void} opts.onRedo
   * @param {() => Promise<void>} opts.onReset
   * @param {() => void} opts.onLogout
   * @param {() => { canUndo: boolean, canRedo: boolean }} opts.getHistoryState
   */
  constructor({ getConfig, onConfigChange, onSave, onUndo, onRedo, onReset, onLogout, getHistoryState }) {
    this._getConfig       = getConfig;
    this._onConfigChange  = onConfigChange;
    this._onSave          = onSave;
    this._onUndo          = onUndo;
    this._onRedo          = onRedo;
    this._onReset         = onReset;
    this._onLogout        = onLogout;
    this._getHistoryState = getHistoryState;

    // ── DOM references ──────────────────────────────────────────────────────
    this._overlay       = document.getElementById("spider-map-overlay");
    this._mapCanvas     = document.getElementById("spider-map-canvas");
    this._mapSvg        = document.getElementById("spider-map-svg");
    this._closeBtn      = document.getElementById("spider-map-close");
    this._addHauptBtn   = document.getElementById("spider-map-add-haupt");
    this._undoBtn       = document.getElementById("spider-map-undo");
    this._redoBtn       = document.getElementById("spider-map-redo");
    this._saveBtn       = document.getElementById("spider-map-save");
    this._resetBtn      = document.getElementById("spider-map-reset");
    this._logoutBtn     = document.getElementById("spider-map-logout");
    this._editorPanel   = document.getElementById("sm-editor-panel");
    this._editorTitle   = document.getElementById("sm-editor-title");
    this._editorContent = document.getElementById("sm-editor-content");
    this._editorCloseBtn = document.getElementById("sm-editor-close");
    this._editorSaveBtn  = document.getElementById("sm-editor-save");

    if (!this._overlay || !this._mapCanvas || !this._mapSvg) return;
    this._bindEvents();
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Opens the Spider Map overlay and rebuilds the node graph from the current config. */
  open() {
    this._overlay.classList.remove("hidden");
    this._overlay.setAttribute("aria-hidden", "false");
    this._nodes = this._buildNodesFromConfig(this._getConfig());
    this._renderAll();
    this.updateHistoryButtons();
  }

  /** Closes the Spider Map overlay and cleans up any active drag or editor state. */
  close() {
    this._overlay.classList.add("hidden");
    this._overlay.setAttribute("aria-hidden", "true");
    if (this._dragging) this._endDrag();
    this._closeNodeEditor();
  }

  /** Re-reads the current config and redraws all nodes without reopening the overlay. */
  refresh() {
    this._nodes = this._buildNodesFromConfig(this._getConfig());
    this._renderAll();
    this.updateHistoryButtons();
  }

  /** Syncs the enabled/disabled state of the Undo and Redo toolbar buttons. */
  updateHistoryButtons() {
    const { canUndo, canRedo } = this._getHistoryState?.() ?? { canUndo: false, canRedo: false };
    if (this._undoBtn instanceof HTMLButtonElement) this._undoBtn.disabled = !canUndo;
    if (this._redoBtn instanceof HTMLButtonElement) this._redoBtn.disabled = !canRedo;
  }

  // ── Event binding ──────────────────────────────────────────────────────────

  /** Attaches all toolbar and pointer event listeners. Called once by the constructor. */
  _bindEvents() {
    this._closeBtn?.addEventListener("click",  () => this.close());
    this._addHauptBtn?.addEventListener("click", () => this._addHauptButton());
    this._undoBtn?.addEventListener("click",   () => this._onUndo?.());
    this._redoBtn?.addEventListener("click",   () => this._onRedo?.());
    this._saveBtn?.addEventListener("click",   () => this._onSave?.(this._getConfig()));
    this._resetBtn?.addEventListener("click",  () => this._onReset?.());
    this._logoutBtn?.addEventListener("click", () => this._onLogout?.());

    this._editorCloseBtn?.addEventListener("click", () => this._closeNodeEditor());
    this._editorSaveBtn?.addEventListener("click", () => {
      if (!this._currentEditNodeReadFn) return;
      const newConfig = this._currentEditNodeReadFn();
      this._onSave?.(newConfig);
      this._closeNodeEditor();
    });

    // Pointer events are captured on the overlay so drag continues even when
    // the pointer leaves a node element.
    this._overlay.addEventListener("pointermove", (e) => {
      if (!this._dragging || this._dragging.pointerId !== e.pointerId) return;
      this._moveDrag(e.clientX, e.clientY);
    });
    this._overlay.addEventListener("pointerup", (e) => {
      if (!this._dragging || this._dragging.pointerId !== e.pointerId) return;
      this._endDrag();
    });
    this._overlay.addEventListener("pointercancel", (e) => {
      if (!this._dragging || this._dragging.pointerId !== e.pointerId) return;
      this._endDrag();
    });
  }

  // ── Layout / position computation ─────────────────────────────────────────

  /**
   * Returns the pixel coordinates of the centre of the map canvas.
   * @returns {{ x: number, y: number }}
   */
  _getMapCenter() {
    return {
      x: this._mapCanvas.clientWidth  / 2,
      y: this._mapCanvas.clientHeight / 2,
    };
  }

  /**
   * Computes default pixel positions for every node using an even angular
   * distribution of Haupt nodes around the centre, with Side nodes fanned
   * outward from each Haupt.
   *
   * @param {import('./constants.js').SiteConfig} config
   * @returns {Record<string, {x: number, y: number}>}
   */
  _computeDefaultPositions(config) {
    const { x: cx, y: cy } = this._getMapCenter();
    const positions = { center: { x: cx, y: cy } };

    config.buttons.forEach((btn, btnIndex) => {
      const hauptAngle = (2 * Math.PI * btnIndex) / config.buttons.length - Math.PI / 2;
      const hauptId    = `haupt-${btn.id}`;
      const hauptX     = cx + Math.cos(hauptAngle) * SpiderMapEditor.HAUPT_RADIUS;
      const hauptY     = cy + Math.sin(hauptAngle) * SpiderMapEditor.HAUPT_RADIUS;

      positions[hauptId] = { x: hauptX, y: hauptY };

      btn.items.forEach((_, itemIndex) => {
        const count     = btn.items.length;
        const sideAngle = count > 1
          ? hauptAngle + SpiderMapEditor.FAN_SPREAD * (itemIndex / (count - 1) - 0.5)
          : hauptAngle;

        positions[`side-${hauptId}-${itemIndex}`] = {
          x: hauptX + Math.cos(sideAngle) * SpiderMapEditor.SIDE_RADIUS,
          y: hauptY + Math.sin(sideAngle) * SpiderMapEditor.SIDE_RADIUS,
        };
      });
    });

    return positions;
  }

  /**
   * Builds a flat `MapNode[]` from `config`.
   * Saved positions override computed defaults; the centre is used as
   * a last-resort fallback.
   *
   * @param {import('./constants.js').SiteConfig} config
   * @returns {MapNode[]}
   */
  _buildNodesFromConfig(config) {
    const defaultPositions = this._computeDefaultPositions(config);
    const getPos = (id) =>
      this._savedPositions[id] || defaultPositions[id] || this._getMapCenter();

    const nodes = [];

    const centerPos = getPos("center");
    nodes.push({
      id: "center", type: "center", label: "Webseite",
      x: centerPos.x, y: centerPos.y,
      parentId: null, createdOrder: 0,
    });

    config.buttons.forEach((btn, btnIndex) => {
      const hauptId  = `haupt-${btn.id}`;
      const hauptPos = getPos(hauptId);
      nodes.push({
        id: hauptId, type: "haupt", label: btn.label,
        x: hauptPos.x, y: hauptPos.y,
        parentId: "center", buttonId: btn.id, title: btn.title,
        backgroundColor: btn.backgroundColor, textColor: btn.textColor,
        imageUrl: btn.imageUrl, stepBackgroundImageUrl: btn.stepBackgroundImageUrl,
        createdOrder: btnIndex,
      });

      btn.items.forEach((item, itemIndex) => {
        const sideId  = `side-${hauptId}-${itemIndex}`;
        const sidePos = getPos(sideId);
        nodes.push({
          id: sideId, type: "side", label: item,
          x: sidePos.x, y: sidePos.y,
          parentId: hauptId, buttonId: btn.id,
          itemIndex, createdOrder: itemIndex,
        });
      });
    });

    return nodes;
  }

  /**
   * Derives the `buttons` array for the site config from the current node list.
   * Haupt nodes are sorted by `createdOrder`; their Side children likewise.
   *
   * @returns {import('./constants.js').ButtonConfig[]}
   */
  _rebuildConfigButtons() {
    return this._nodes
      .filter((n) => n.type === "haupt")
      .sort((a, b) => a.createdOrder - b.createdOrder)
      .map((hauptNode) => {
        const items = this._nodes
          .filter((n) => n.type === "side" && n.parentId === hauptNode.id)
          .sort((a, b) => a.createdOrder - b.createdOrder)
          .map((s) => s.label)
          .filter(Boolean);

        return {
          id:                   hauptNode.buttonId || slugify(hauptNode.label) || `button-${hauptNode.createdOrder + 1}`,
          label:                hauptNode.label,
          title:                hauptNode.title || `${hauptNode.label} Optionen`,
          backgroundColor:      hauptNode.backgroundColor || "",
          textColor:            hauptNode.textColor || "",
          imageUrl:             hauptNode.imageUrl || "",
          stepBackgroundImageUrl: hauptNode.stepBackgroundImageUrl || "",
          items:                items.length ? items : ["Option 1"],
        };
      });
  }

  /**
   * Re-derives the config from the current node list and notifies the app.
   * Called after every structural change (add, delete, rename, reorder).
   */
  _syncConfig() {
    const current   = this._getConfig();
    const newConfig = normalizeSiteConfig({ ...current, buttons: this._rebuildConfigButtons() });
    this._onConfigChange(newConfig);
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  /** Redraws all SVG connection lines. */
  _renderConnections() {
    while (this._mapSvg.firstChild) this._mapSvg.removeChild(this._mapSvg.firstChild);

    this._nodes.forEach((node) => {
      if (!node.parentId) return;
      const parent = this._nodes.find((n) => n.id === node.parentId);
      if (!parent) return;

      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", String(parent.x));
      line.setAttribute("y1", String(parent.y));
      line.setAttribute("x2", String(node.x));
      line.setAttribute("y2", String(node.y));
      line.setAttribute("class", node.type === "side" ? "sm-connection side-connection" : "sm-connection");
      this._mapSvg.appendChild(line);
    });
  }

  /**
   * Creates the DOM element for a single node, including control buttons
   * and drag/click event listeners.
   *
   * @param {MapNode} node
   * @returns {HTMLDivElement}
   */
  _createNodeElement(node) {
    const el = document.createElement("div");
    el.className = `sm-node ${node.type}`;
    el.dataset.smId = node.id;
    el.style.left = `${node.x}px`;
    el.style.top  = `${node.y}px`;

    const inner    = document.createElement("div");
    inner.className = "sm-node-inner";
    const labelEl  = document.createElement("span");
    labelEl.className = "sm-node-label";
    labelEl.textContent = node.label;
    inner.appendChild(labelEl);
    el.appendChild(inner);

    if (node.type === "center") {
      inner.title   = "Klicken zum Bearbeiten";
      inner.style.cursor = "pointer";
      el.addEventListener("click", () => this._openNodeEditor("center"));
      return el;
    }

    // ── Controls for haupt / side nodes ──────────────────────────────────────
    const controls = document.createElement("div");
    controls.className = "sm-node-controls";

    if (node.type === "haupt") {
      inner.title = "Klicken zum Bearbeiten";
      const addSideBtn = document.createElement("button");
      addSideBtn.type = "button";
      addSideBtn.className = "sm-node-btn";
      addSideBtn.title = "Side-Button hinzufügen";
      addSideBtn.textContent = "+";
      addSideBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this._addSideButton(node.id);
      });
      controls.appendChild(addSideBtn);
    }

    const renameBtn = document.createElement("button");
    renameBtn.type = "button";
    renameBtn.className = "sm-node-btn";
    renameBtn.title = "Umbenennen";
    renameBtn.textContent = "✏";
    renameBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this._renameNode(node.id);
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "sm-node-btn";
    deleteBtn.title = "Löschen";
    deleteBtn.textContent = "✕";
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this._deleteNode(node.id);
    });

    controls.append(renameBtn, deleteBtn);
    el.appendChild(controls);

    el.addEventListener("pointerdown", (e) => {
      if (e.target.closest(".sm-node-btn")) return;
      e.preventDefault();
      this._startDrag(node.id, e.clientX, e.clientY, e.pointerId);
    });

    return el;
  }

  /** Removes all node elements and redraws them, then refreshes SVG connections. */
  _renderAll() {
    Array.from(this._mapCanvas.querySelectorAll(".sm-node")).forEach((el) => el.remove());
    this._nodes.forEach((node) => this._mapCanvas.appendChild(this._createNodeElement(node)));
    this._renderConnections();
  }

  // ── Drag & drop ────────────────────────────────────────────────────────────

  /**
   * Begins a drag gesture for the node identified by `nodeId`.
   *
   * @param {string} nodeId
   * @param {number} clientX
   * @param {number} clientY
   * @param {number} pointerId
   */
  _startDrag(nodeId, clientX, clientY, pointerId) {
    const node = this._nodes.find((n) => n.id === nodeId);
    if (!node) return;

    const rect = this._mapCanvas.getBoundingClientRect();
    this._dragging = {
      nodeId,
      offsetX:  clientX - rect.left - node.x,
      offsetY:  clientY - rect.top  - node.y,
      pointerId,
      startX:   clientX,
      startY:   clientY,
      moved:    false,
    };

    this._overlay.setPointerCapture(pointerId);
    this._mapCanvas.querySelector(`[data-sm-id="${nodeId}"]`)?.classList.add("dragging");
  }

  /**
   * Updates the dragged node's position and the snap-target highlight.
   *
   * @param {number} clientX
   * @param {number} clientY
   */
  _moveDrag(clientX, clientY) {
    if (!this._dragging) return;

    if (
      !this._dragging.moved &&
      Math.hypot(clientX - this._dragging.startX, clientY - this._dragging.startY) > SpiderMapEditor.DRAG_THRESHOLD
    ) {
      this._dragging.moved = true;
    }

    const node = this._nodes.find((n) => n.id === this._dragging.nodeId);
    if (!node) return;

    const rect = this._mapCanvas.getBoundingClientRect();
    node.x = clientX - rect.left - this._dragging.offsetX;
    node.y = clientY - rect.top  - this._dragging.offsetY;
    this._savedPositions[node.id] = { x: node.x, y: node.y };

    // Find the closest other node for the snap indicator.
    let closestId   = null;
    let closestDist = SpiderMapEditor.SNAP_DIST;
    this._nodes.forEach((other) => {
      if (other.id === node.id) return;
      const dist = Math.hypot(other.x - node.x, other.y - node.y);
      if (dist < closestDist) { closestDist = dist; closestId = other.id; }
    });

    // Update snap-target highlight when the closest node changes.
    if (closestId !== this._snapTargetId) {
      this._mapCanvas.querySelector(`[data-sm-id="${this._snapTargetId}"]`)?.classList.remove("snap-target");
      this._snapTargetId = closestId;
      this._mapCanvas.querySelector(`[data-sm-id="${this._snapTargetId}"]`)?.classList.add("snap-target");
    }

    const el = this._mapCanvas.querySelector(`[data-sm-id="${node.id}"]`);
    if (el) {
      el.style.left = `${node.x}px`;
      el.style.top  = `${node.y}px`;
    }
    this._renderConnections();
  }

  /**
   * Finalises the drag: snaps the node to the target if within range,
   * removes the drag CSS class, and opens the inline editor for a
   * Haupt node that was clicked without moving.
   */
  _endDrag() {
    if (!this._dragging) return;

    const node     = this._nodes.find((n) => n.id === this._dragging.nodeId);
    const wasMoved = this._dragging.moved;
    const nodeId   = this._dragging.nodeId;

    if (this._snapTargetId && node) {
      const target = this._nodes.find((n) => n.id === this._snapTargetId);
      if (target) {
        const angle = Math.atan2(node.y - target.y, node.x - target.x);
        node.x = target.x + Math.cos(angle) * SpiderMapEditor.SNAP_ATTACH_DIST;
        node.y = target.y + Math.sin(angle) * SpiderMapEditor.SNAP_ATTACH_DIST;
        this._savedPositions[node.id] = { x: node.x, y: node.y };
      }
      this._mapCanvas.querySelector(`[data-sm-id="${this._snapTargetId}"]`)?.classList.remove("snap-target");
      this._snapTargetId = null;
    }

    const el = this._mapCanvas.querySelector(`[data-sm-id="${nodeId}"]`);
    if (el) {
      el.classList.remove("dragging");
      if (node) { el.style.left = `${node.x}px`; el.style.top = `${node.y}px`; }
    }

    this._dragging = null;
    this._renderConnections();

    // A press that did not travel past DRAG_THRESHOLD is treated as a click.
    if (!wasMoved) {
      const clickedNode = this._nodes.find((n) => n.id === nodeId);
      if (clickedNode?.type === "haupt") this._openNodeEditor(nodeId);
    }
  }

  // ── Node operations ────────────────────────────────────────────────────────

  /**
   * Prompts the user for a new label and updates the node.
   * Uses a custom `<dialog>` instead of `window.prompt`.
   *
   * @param {string} nodeId
   */
  async _renameNode(nodeId) {
    const node = this._nodes.find((n) => n.id === nodeId);
    if (!node) return;

    const newLabel = await this._showPrompt("Neuer Name:", node.label);
    if (newLabel === null) return;
    const trimmed = newLabel.trim();
    if (!trimmed) return;

    node.label = trimmed;
    this._renderAll();
    this._syncConfig();
  }

  /**
   * Removes a node (and its children for Haupt nodes) after user confirmation.
   * Uses a custom `<dialog>` instead of `window.alert` / `window.confirm`.
   * At least one Haupt node must remain.
   *
   * @param {string} nodeId
   */
  async _deleteNode(nodeId) {
    const node = this._nodes.find((n) => n.id === nodeId);
    if (!node) return;

    if (node.type === "haupt") {
      const hauptCount = this._nodes.filter((n) => n.type === "haupt").length;
      if (hauptCount <= 1) {
        await this._showAlert("Mindestens ein Haupt-Button muss vorhanden sein.");
        return;
      }

      const confirmed = await this._showConfirm(
        `"${node.label}" und alle zugehörigen Optionen löschen?`,
      );
      if (!confirmed) return;

      const toRemove = new Set([
        nodeId,
        ...this._nodes.filter((n) => n.parentId === nodeId).map((n) => n.id),
      ]);
      this._nodes = this._nodes.filter((n) => !toRemove.has(n.id));
      toRemove.forEach((id) => delete this._savedPositions[id]);
    } else {
      const confirmed = await this._showConfirm(`"${node.label}" löschen?`);
      if (!confirmed) return;

      this._nodes = this._nodes.filter((n) => n.id !== nodeId);
      delete this._savedPositions[nodeId];
      // Re-number siblings to keep createdOrder contiguous.
      this._nodes
        .filter((n) => n.type === "side" && n.parentId === node.parentId)
        .sort((a, b) => a.createdOrder - b.createdOrder)
        .forEach((s, i) => { s.createdOrder = i; s.itemIndex = i; });
    }

    this._renderAll();
    this._syncConfig();
  }

  /**
   * Adds a new Haupt node with a default Side node.
   * Note: the existing Haupt nodes are not redistributed; only the new node
   * is positioned at its computed angle.
   */
  _addHauptButton() {
    const config     = this._getConfig();
    const center     = this._nodes.find((n) => n.id === "center");
    if (!center) return;

    const hauptNodes = this._nodes.filter((n) => n.type === "haupt");
    const newOrder   = hauptNodes.length;
    // Place the new button evenly among newOrder+1 positions.
    const angle      = (2 * Math.PI * newOrder) / (newOrder + 1) - Math.PI / 2;
    const hauptX     = center.x + Math.cos(angle) * SpiderMapEditor.HAUPT_RADIUS;
    const hauptY     = center.y + Math.sin(angle) * SpiderMapEditor.HAUPT_RADIUS;

    const newHauptId  = `haupt-new-${Date.now()}`;
    const newButtonId = `new-btn-${Date.now()}`;

    this._nodes.push({
      id: newHauptId, type: "haupt", label: "Neuer Button",
      x: hauptX, y: hauptY,
      parentId: "center", buttonId: newButtonId,
      title: "Neue Optionen",
      backgroundColor: sanitizeColor(config.theme.accentColor, "#00d4ff"),
      textColor:       sanitizeColor(config.theme.textColor, "#ffffff"),
      imageUrl: "", stepBackgroundImageUrl: "",
      createdOrder: newOrder,
    });

    this._nodes.push({
      id: `side-${newHauptId}-0`, type: "side", label: "Option 1",
      x: hauptX + Math.cos(angle) * SpiderMapEditor.SIDE_RADIUS,
      y: hauptY + Math.sin(angle) * SpiderMapEditor.SIDE_RADIUS,
      parentId: newHauptId, buttonId: newButtonId,
      itemIndex: 0, createdOrder: 0,
    });

    this._renderAll();
    this._syncConfig();
  }

  /**
   * Adds a new Side node to the given Haupt node, fanned outward from
   * the centre direction.
   *
   * @param {string} hauptId
   */
  _addSideButton(hauptId) {
    const haupt    = this._nodes.find((n) => n.id === hauptId);
    if (!haupt) return;

    const center   = this._nodes.find((n) => n.id === "center");
    const siblings = this._nodes.filter((n) => n.type === "side" && n.parentId === hauptId);
    const idx      = siblings.length;
    const awayAngle = center
      ? Math.atan2(haupt.y - center.y, haupt.x - center.x)
      : 0;
    const fanAngle  = awayAngle + (idx - (siblings.length - 1) / 2) * 0.45;

    this._nodes.push({
      id: `side-${hauptId}-${Date.now()}`, type: "side",
      label: `Option ${idx + 1}`,
      x: haupt.x + Math.cos(fanAngle) * SpiderMapEditor.SIDE_RADIUS,
      y: haupt.y + Math.sin(fanAngle) * SpiderMapEditor.SIDE_RADIUS,
      parentId: hauptId, buttonId: haupt.buttonId,
      itemIndex: idx, createdOrder: idx,
    });

    this._renderAll();
    this._syncConfig();
  }

  // ── Inline editor panel ────────────────────────────────────────────────────

  /**
   * Opens the inline editor for the given node ID.
   * The centre node opens global website settings; Haupt nodes open button
   * settings. Side nodes are not directly editable in the panel.
   *
   * @param {string} nodeId
   */
  _openNodeEditor(nodeId) {
    const node = this._nodes.find((n) => n.id === nodeId);
    if (!node) return;

    if (node.type === "center") {
      if (this._editorTitle) this._editorTitle.textContent = "Webseite bearbeiten";
      this._currentEditNodeReadFn = this._buildWebsiteEditorContent(this._getConfig());
    } else if (node.type === "haupt") {
      if (this._editorTitle) this._editorTitle.textContent = `"${node.label}" bearbeiten`;
      const config       = this._getConfig();
      const buttonConfig = config.buttons.find((b) => b.id === node.buttonId) || {
        id: node.buttonId, label: node.label,
        title: node.title || `${node.label} Optionen`,
        backgroundColor: node.backgroundColor || "",
        textColor:       node.textColor || "",
        imageUrl:        node.imageUrl || "",
        stepBackgroundImageUrl: node.stepBackgroundImageUrl || "",
        items: [],
      };
      this._currentEditNodeReadFn = this._buildButtonEditorContent(node, buttonConfig);
    } else {
      return;
    }

    this._editorPanel?.classList.remove("hidden");
  }

  /** Closes the inline editor panel and clears its content. */
  _closeNodeEditor() {
    this._currentEditNodeReadFn = null;
    this._editorPanel?.classList.add("hidden");
    if (this._editorContent) this._editorContent.replaceChildren();
  }

  // ── Editor UI helpers ──────────────────────────────────────────────────────

  /**
   * @param {string} text
   * @returns {HTMLLabelElement}
   */
  _editorMakeLabel(text) {
    const lbl = document.createElement("label");
    lbl.textContent = text;
    return lbl;
  }

  /** @returns {HTMLDivElement} */
  _editorMakeDivider() {
    const hr = document.createElement("div");
    hr.className = "sm-editor-divider";
    return hr;
  }

  /**
   * @param {string} text
   * @returns {HTMLSpanElement}
   */
  _editorMakeSectionLabel(text) {
    const span = document.createElement("span");
    span.className = "sm-editor-section-label";
    span.textContent = text;
    return span;
  }

  /**
   * @param {string} type   - HTML input type attribute value
   * @param {unknown} value - Initial value
   * @returns {HTMLInputElement}
   */
  _editorMakeInput(type, value) {
    const input = document.createElement("input");
    input.type  = type;
    input.value = String(value ?? "");
    return input;
  }

  /**
   * @param {Array<[string, string]>} optionsArr - `[value, label]` pairs
   * @param {string} currentValue
   * @returns {HTMLSelectElement}
   */
  _editorMakeSelect(optionsArr, currentValue) {
    const sel = document.createElement("select");
    optionsArr.forEach(([val, text]) => {
      const opt = document.createElement("option");
      opt.value = val;
      opt.textContent = text;
      if (val === String(currentValue)) opt.selected = true;
      sel.appendChild(opt);
    });
    return sel;
  }

  /**
   * Builds a grouped image-upload control consisting of a label, a hidden
   * URL input, a file picker, a status paragraph, and a clear button.
   *
   * @param {string} labelText
   * @param {string} currentUrl
   * @returns {{ elements: HTMLElement[], read: () => string }}
   */
  _editorMakeImageUpload(labelText, currentUrl) {
    const lbl       = this._editorMakeLabel(labelText);
    const hidden    = this._editorMakeInput("hidden", currentUrl || "");
    const fileInput = document.createElement("input");
    fileInput.type   = "file";
    fileInput.accept = "image/*";

    const status = document.createElement("p");
    status.className   = "status";
    status.style.margin = "0";
    status.textContent  = currentUrl ? "Bild gesetzt." : "Kein Bild gewählt.";

    const clearBtn = document.createElement("button");
    clearBtn.type      = "button";
    clearBtn.className = "action-button ghost small";
    clearBtn.textContent = "Bild entfernen";

    fileInput.addEventListener("change", async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      try {
        const dataUrl = await readImageFileAsDataUrl(file);
        hidden.value   = sanitizeImageUrl(dataUrl);
        status.textContent = hidden.value ? `Bild "${file.name}" geladen.` : "Ungültiges Bild.";
      } catch {
        hidden.value   = "";
        status.textContent = "Bild konnte nicht geladen werden.";
      }
    });

    clearBtn.addEventListener("click", () => {
      hidden.value       = "";
      fileInput.value    = "";
      status.textContent = "Kein Bild gewählt.";
    });

    return {
      elements: [lbl, hidden, fileInput, status, clearBtn],
      read: () => sanitizeImageUrl(hidden.value),
    };
  }

  // ── Editor content builders ────────────────────────────────────────────────

  /**
   * Populates `#sm-editor-content` with global website settings fields
   * and returns a reader function that extracts the entered values as a
   * normalised `SiteConfig`.
   *
   * @param {import('./constants.js').SiteConfig} config
   * @returns {() => import('./constants.js').SiteConfig}
   */
  _buildWebsiteEditorContent(config) {
    const els = [];

    els.push(this._editorMakeSectionLabel("Texte"));
    const titleInput         = this._editorMakeInput("text", config.title);
    const subtitleInput      = this._editorMakeInput("text", config.subtitle);
    const startLabelInput    = this._editorMakeInput("text", config.startLabel);
    const categoryLabelInput = this._editorMakeInput("text", config.categoryLabel);
    els.push(
      this._editorMakeLabel("Titel"),          titleInput,
      this._editorMakeLabel("Untertitel"),     subtitleInput,
      this._editorMakeLabel("Start-Button"),   startLabelInput,
      this._editorMakeLabel("Kategorie-Überschrift"), categoryLabelInput,
    );

    els.push(this._editorMakeDivider(), this._editorMakeSectionLabel("Hintergrundbilder"));
    const landingBg  = this._editorMakeImageUpload("Landingpage Hintergrundbild (optional)", config.theme.landingBackgroundImageUrl);
    const categoryBg = this._editorMakeImageUpload("Kategorien Hintergrundbild (optional)", config.theme.categoryBackgroundImageUrl);
    els.push(...landingBg.elements, ...categoryBg.elements);

    els.push(this._editorMakeDivider(), this._editorMakeSectionLabel("Farben"));
    const accentColorInput  = this._editorMakeInput("color", config.theme.accentColor);
    const textColorInput    = this._editorMakeInput("color", config.theme.textColor);
    const bgColorInput      = this._editorMakeInput("color", config.theme.backgroundColor);
    const overlayColorInput = this._editorMakeInput("color", config.theme.overlayColor);
    const overlayOpacityInput = this._editorMakeInput("range", config.theme.overlayOpacity);
    overlayOpacityInput.min  = "0"; overlayOpacityInput.max  = "1"; overlayOpacityInput.step = "0.01";
    els.push(
      this._editorMakeLabel("Akzentfarbe"),    accentColorInput,
      this._editorMakeLabel("Textfarbe"),      textColorInput,
      this._editorMakeLabel("Hintergrundfarbe"), bgColorInput,
      this._editorMakeLabel("Overlay-Farbe"),  overlayColorInput,
      this._editorMakeLabel("Overlay-Stärke"), overlayOpacityInput,
    );

    els.push(this._editorMakeDivider(), this._editorMakeSectionLabel("Animation"));
    const animSpeedInput    = this._editorMakeInput("range", config.webgl.animationSpeed);
    animSpeedInput.min = "0.05"; animSpeedInput.max = "1.5"; animSpeedInput.step = "0.05";
    const waveStrengthInput = this._editorMakeInput("range", config.webgl.waveStrength);
    waveStrengthInput.min = "0.1"; waveStrengthInput.max = "1.8"; waveStrengthInput.step = "0.05";
    const glowStrengthInput = this._editorMakeInput("range", config.webgl.glowStrength);
    glowStrengthInput.min = "0.05"; glowStrengthInput.max = "1"; glowStrengthInput.step = "0.01";
    els.push(
      this._editorMakeLabel("Animationsgeschwindigkeit"), animSpeedInput,
      this._editorMakeLabel("Flow-Stärke"),  waveStrengthInput,
      this._editorMakeLabel("Glow-Stärke"),  glowStrengthInput,
    );

    els.push(this._editorMakeDivider(), this._editorMakeSectionLabel("Button-Stil"));
    const fontFamilyOptions = [
      ["Arial, Helvetica, sans-serif",               "Arial"],
      ["Verdana, Geneva, sans-serif",                "Verdana"],
      ["Tahoma, Geneva, sans-serif",                 "Tahoma"],
      ["'Trebuchet MS', Helvetica, sans-serif",      "Trebuchet MS"],
      ["Georgia, 'Times New Roman', serif",          "Georgia"],
      ["'Times New Roman', Times, serif",            "Times New Roman"],
      ["'Palatino Linotype', 'Book Antiqua', Palatino, serif", "Palatino"],
      ["'Courier New', Courier, monospace",          "Courier New"],
      ["Impact, Charcoal, sans-serif",               "Impact"],
      ["'Comic Sans MS', cursive",                   "Comic Sans MS"],
    ];
    const fontWeightOptions = [
      ["300", "Light (300)"],   ["400", "Normal (400)"],  ["500", "Medium (500)"],
      ["600", "Semibold (600)"], ["700", "Bold (700)"],   ["800", "Extrabold (800)"],
      ["900", "Black (900)"],
    ];
    const fontFamilySelect  = this._editorMakeSelect(fontFamilyOptions, config.theme.buttonFontFamily);
    const fontWeightSelect  = this._editorMakeSelect(fontWeightOptions, String(config.theme.buttonFontWeight));
    const borderRadiusInput = this._editorMakeInput("range", config.theme.buttonBorderRadius);
    borderRadiusInput.min = "0"; borderRadiusInput.max = "3"; borderRadiusInput.step = "0.05";
    const fontSizeInput = this._editorMakeInput("range", config.theme.buttonFontSize);
    fontSizeInput.min = "0.8"; fontSizeInput.max = "3"; fontSizeInput.step = "0.05";
    els.push(
      this._editorMakeLabel("Schriftart"),    fontFamilySelect,
      this._editorMakeLabel("Schriftstärke"), fontWeightSelect,
      this._editorMakeLabel("Eckenradius"),   borderRadiusInput,
      this._editorMakeLabel("Schriftgröße"),  fontSizeInput,
    );

    this._editorContent.replaceChildren(...els);

    // Return a reader function that collects the current form state.
    return () => normalizeSiteConfig({
      ...config,
      title:         sanitizeString(titleInput.value,         DEFAULT_SITE_CONFIG.title),
      subtitle:      sanitizeString(subtitleInput.value,      DEFAULT_SITE_CONFIG.subtitle),
      startLabel:    sanitizeString(startLabelInput.value,    DEFAULT_SITE_CONFIG.startLabel),
      categoryLabel: sanitizeString(categoryLabelInput.value, DEFAULT_SITE_CONFIG.categoryLabel),
      theme: {
        ...config.theme,
        accentColor:                accentColorInput.value  || DEFAULT_SITE_CONFIG.theme.accentColor,
        textColor:                  textColorInput.value    || DEFAULT_SITE_CONFIG.theme.textColor,
        backgroundColor:            bgColorInput.value      || DEFAULT_SITE_CONFIG.theme.backgroundColor,
        overlayColor:               overlayColorInput.value || DEFAULT_SITE_CONFIG.theme.overlayColor,
        overlayOpacity:             parseFloat(overlayOpacityInput.value) || DEFAULT_SITE_CONFIG.theme.overlayOpacity,
        landingBackgroundImageUrl:  landingBg.read(),
        categoryBackgroundImageUrl: categoryBg.read(),
        buttonFontFamily:   sanitizeString(fontFamilySelect.value,           DEFAULT_SITE_CONFIG.theme.buttonFontFamily),
        buttonFontWeight:   Number(fontWeightSelect.value)                || DEFAULT_SITE_CONFIG.theme.buttonFontWeight,
        buttonBorderRadius: parseFloat(borderRadiusInput.value)           || DEFAULT_SITE_CONFIG.theme.buttonBorderRadius,
        buttonFontSize:     parseFloat(fontSizeInput.value)               || DEFAULT_SITE_CONFIG.theme.buttonFontSize,
      },
      webgl: {
        animationSpeed: parseFloat(animSpeedInput.value)    || DEFAULT_SITE_CONFIG.webgl.animationSpeed,
        waveStrength:   parseFloat(waveStrengthInput.value) || DEFAULT_SITE_CONFIG.webgl.waveStrength,
        glowStrength:   parseFloat(glowStrengthInput.value) || DEFAULT_SITE_CONFIG.webgl.glowStrength,
      },
    });
  }

  /**
   * Populates `#sm-editor-content` with button-specific settings and returns
   * a reader function that applies the entered values to the node and config.
   *
   * @param {MapNode} hauptNode
   * @param {import('./constants.js').ButtonConfig} buttonConfig
   * @returns {() => import('./constants.js').SiteConfig}
   */
  _buildButtonEditorContent(hauptNode, buttonConfig) {
    const els = [];

    els.push(this._editorMakeSectionLabel("Button"));
    const labelInput = this._editorMakeInput("text", buttonConfig.label);
    const titleInput = this._editorMakeInput("text", buttonConfig.title);
    els.push(
      this._editorMakeLabel("Button Name"),    labelInput,
      this._editorMakeLabel("Optionen Titel"), titleInput,
    );

    els.push(this._editorMakeDivider(), this._editorMakeSectionLabel("Farben"));
    const bgColorInput   = this._editorMakeInput("color", sanitizeColor(buttonConfig.backgroundColor, "#00d4ff"));
    const textColorInput = this._editorMakeInput("color", sanitizeColor(buttonConfig.textColor, "#ffffff"));
    els.push(
      this._editorMakeLabel("Button Hintergrundfarbe"), bgColorInput,
      this._editorMakeLabel("Button Textfarbe"),        textColorInput,
    );

    els.push(this._editorMakeDivider(), this._editorMakeSectionLabel("Bilder"));
    const buttonImg = this._editorMakeImageUpload("Button Hintergrundbild (optional)", buttonConfig.imageUrl);
    const stepBgImg = this._editorMakeImageUpload("Schritt Hintergrundbild (optional)", buttonConfig.stepBackgroundImageUrl);
    els.push(...buttonImg.elements, ...stepBgImg.elements);

    els.push(this._editorMakeDivider(), this._editorMakeSectionLabel("Optionen"));
    const itemsTextarea = document.createElement("textarea");
    itemsTextarea.rows  = 6;
    itemsTextarea.value = buttonConfig.items.join("\n");
    els.push(this._editorMakeLabel("Einträge (je Zeile ein Eintrag)"), itemsTextarea);

    this._editorContent.replaceChildren(...els);

    return () => {
      const newLabel    = sanitizeString(labelInput.value, hauptNode.label);
      const newTitle    = sanitizeString(titleInput.value, buttonConfig.title);
      const newBgColor  = sanitizeColor(bgColorInput.value);
      const newTextColor = sanitizeColor(textColorInput.value);
      const newImageUrl  = buttonImg.read();
      const newStepBgUrl = stepBgImg.read();
      const newItems     = sanitizeItems(itemsTextarea.value, buttonConfig.items);

      // Apply edits directly to the node so the graph stays in sync.
      hauptNode.label                = newLabel;
      hauptNode.title                = newTitle;
      hauptNode.backgroundColor      = newBgColor;
      hauptNode.textColor            = newTextColor;
      hauptNode.imageUrl             = newImageUrl;
      hauptNode.stepBackgroundImageUrl = newStepBgUrl;

      // Rebuild Side nodes from the updated items list.
      this._nodes = this._nodes.filter((n) => !(n.type === "side" && n.parentId === hauptNode.id));
      const center     = this._nodes.find((n) => n.id === "center");
      const awayAngle  = center ? Math.atan2(hauptNode.y - center.y, hauptNode.x - center.x) : 0;
      const count      = newItems.length;
      newItems.forEach((item, idx) => {
        const sideAngle = count > 1 ? awayAngle + SpiderMapEditor.FAN_SPREAD * (idx / (count - 1) - 0.5) : awayAngle;
        this._nodes.push({
          id: `side-${hauptNode.id}-${idx}`, type: "side", label: item,
          x: hauptNode.x + Math.cos(sideAngle) * SpiderMapEditor.SIDE_RADIUS,
          y: hauptNode.y + Math.sin(sideAngle) * SpiderMapEditor.SIDE_RADIUS,
          parentId: hauptNode.id, buttonId: hauptNode.buttonId,
          itemIndex: idx, createdOrder: idx,
        });
      });

      this._renderAll();

      const current = this._getConfig();
      return normalizeSiteConfig({ ...current, buttons: this._rebuildConfigButtons() });
    };
  }

  // ── Custom dialogs ─────────────────────────────────────────────────────────

  /**
   * Opens a styled `<dialog>` with a text input and OK/Cancel buttons.
   * Returns the entered string, or `null` if the user cancelled.
   *
   * @param {string} message
   * @param {string} [defaultValue=""]
   * @returns {Promise<string|null>}
   */
  _showPrompt(message, defaultValue = "") {
    return new Promise((resolve) => {
      const dialog = this._createDialog();

      const p = document.createElement("p");
      p.className    = "sm-dialog-message";
      p.textContent  = message;

      const input    = document.createElement("input");
      input.type     = "text";
      input.value    = defaultValue;
      input.className = "sm-dialog-input";

      const { row, okBtn, cancelBtn } = this._createDialogButtons();
      dialog.append(p, input, row);
      document.body.appendChild(dialog);
      dialog.showModal();
      input.focus();
      input.select();

      const finish = (result) => {
        dialog.close();
        document.body.removeChild(dialog);
        resolve(result);
      };

      okBtn.addEventListener("click",     () => finish(input.value));
      cancelBtn.addEventListener("click", () => finish(null));
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter")  finish(input.value);
        if (e.key === "Escape") finish(null);
      });
    });
  }

  /**
   * Opens a styled `<dialog>` with OK and Cancel buttons.
   * Returns `true` when confirmed, `false` when cancelled.
   *
   * @param {string} message
   * @returns {Promise<boolean>}
   */
  _showConfirm(message) {
    return new Promise((resolve) => {
      const dialog = this._createDialog();

      const p = document.createElement("p");
      p.className   = "sm-dialog-message";
      p.textContent = message;

      const { row, okBtn, cancelBtn } = this._createDialogButtons();
      dialog.append(p, row);
      document.body.appendChild(dialog);
      dialog.showModal();

      const finish = (result) => {
        dialog.close();
        document.body.removeChild(dialog);
        resolve(result);
      };

      okBtn.addEventListener("click",     () => finish(true));
      cancelBtn.addEventListener("click", () => finish(false));
      dialog.addEventListener("keydown", (e) => {
        if (e.key === "Escape") finish(false);
      });
    });
  }

  /**
   * Opens a styled `<dialog>` with a single OK button (non-blocking alert).
   *
   * @param {string} message
   * @returns {Promise<void>}
   */
  _showAlert(message) {
    return new Promise((resolve) => {
      const dialog = this._createDialog();

      const p = document.createElement("p");
      p.className   = "sm-dialog-message";
      p.textContent = message;

      const row = document.createElement("div");
      row.className = "sm-dialog-buttons";

      const okBtn = document.createElement("button");
      okBtn.type      = "button";
      okBtn.className = "action-button small";
      okBtn.textContent = "OK";
      row.appendChild(okBtn);

      dialog.append(p, row);
      document.body.appendChild(dialog);
      dialog.showModal();

      const finish = () => {
        dialog.close();
        document.body.removeChild(dialog);
        resolve();
      };

      okBtn.addEventListener("click", finish);
      dialog.addEventListener("keydown", (e) => {
        if (e.key === "Escape" || e.key === "Enter") finish();
      });
    });
  }

  /**
   * Creates a bare `<dialog>` element styled to match the app theme.
   * @returns {HTMLDialogElement}
   */
  _createDialog() {
    const dialog = document.createElement("dialog");
    dialog.className = "sm-dialog";
    return dialog;
  }

  /**
   * Creates a button row with OK and Cancel buttons.
   * @returns {{ row: HTMLDivElement, okBtn: HTMLButtonElement, cancelBtn: HTMLButtonElement }}
   */
  _createDialogButtons() {
    const row = document.createElement("div");
    row.className = "sm-dialog-buttons";

    const cancelBtn = document.createElement("button");
    cancelBtn.type      = "button";
    cancelBtn.className = "action-button ghost small";
    cancelBtn.textContent = "Abbrechen";

    const okBtn = document.createElement("button");
    okBtn.type      = "button";
    okBtn.className = "action-button small";
    okBtn.textContent = "OK";

    row.append(cancelBtn, okBtn);
    return { row, okBtn, cancelBtn };
  }
}
