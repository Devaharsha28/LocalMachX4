import {
  createDefaultProject,
  createTraditionalProject,
  createWing,
  createGroup,
  createPrimitive,
  createPropeller,
  createLight,
  exportToMachUpX,
  importFromMachUpX,
  saveAutosave,
  loadAutosave,
} from "./model.js";
import { AircraftViewport } from "./viewport.js";
import {
  renderForcesTable,
  renderDerivativesTable,
  renderDistributionsPlots,
} from "./plots.js";

// State
let project = loadAutosave() || createDefaultProject();
let selectedId = null;
let lastResults = null;
let activeDrawerTab = "forces";
let trimTargetCL = 0.4;
let trimTargetCm = 0.0;

const viewportEl = document.getElementById("viewport");
const viewport = new AircraftViewport(viewportEl, {
  onSelect: (id) => {
    selectedId = id;
    renderAll();
  },
  onTransformChange: (id, pos, rot, scale) => {
    const obj = project.objects.find((o) => o.id === id);
    if (!obj) return;
    obj.position = pos;
    obj.rotation = rot;
    if (obj.scaleEnabled) obj.scale = scale;
    renderObjectPanel();
    updateHud();
    triggerAutosave();
  },
});

// Collapsible panels
document.querySelectorAll(".panel-header").forEach((hdr) => {
  hdr.addEventListener("click", () => {
    const sec = hdr.parentElement;
    sec.classList.toggle("collapsed");
    hdr.querySelector(".tri").textContent = sec.classList.contains("collapsed") ? "▸" : "▾";
  });
});

// Top Menus
document.querySelectorAll(".menu-item").forEach((item) => {
  item.addEventListener("click", (e) => {
    e.stopPropagation();
    const wasOpen = item.classList.contains("open");
    document.querySelectorAll(".menu-item.open").forEach((m) => m.classList.remove("open"));
    if (!wasOpen) item.classList.add("open");
  });
});
document.addEventListener("click", () => {
  document.querySelectorAll(".menu-item.open").forEach((m) => m.classList.remove("open"));
});

document.querySelectorAll(".menu-action").forEach((act) => {
  act.addEventListener("click", (e) => {
    e.stopPropagation();
    document.querySelectorAll(".menu-item.open").forEach((m) => m.classList.remove("open"));
    handleCommand(act.dataset.cmd);
  });
});

// Bottom bar controls
document.getElementById("chk-grid").addEventListener("change", (e) => {
  viewport.setGridVisible(e.target.checked);
});
const chkSnap = document.getElementById("chk-snap");
const inpSnap = document.getElementById("inp-snap");
const updateSnap = () => viewport.setSnap(chkSnap.checked, inpSnap.value);
chkSnap.addEventListener("change", updateSnap);
inpSnap.addEventListener("change", updateSnap);

document.querySelectorAll(".tool-btn[data-mode]").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tool-btn[data-mode]").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    viewport.setTransformMode(btn.dataset.mode);
  });
});

// Keyboard shortcuts
window.addEventListener("keydown", (e) => {
  if (["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName)) return;
  const k = e.key.toLowerCase();
  if (k === "t") document.querySelector('.tool-btn[data-mode="translate"]').click();
  else if (k === "r") document.querySelector('.tool-btn[data-mode="rotate"]').click();
  else if (k === "s") document.querySelector('.tool-btn[data-mode="scale"]').click();
  else if (e.key === "Delete" || e.key === "Backspace") handleCommand("delete");
  else if ((e.ctrlKey || e.metaKey) && k === "d") {
    e.preventDefault();
    handleCommand("duplicate");
  }
});

// Drawer tabs
document.querySelectorAll(".drawer-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".drawer-tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    activeDrawerTab = tab.dataset.tab;
    renderDrawerContent();
  });
});
document.getElementById("btn-close-drawer").addEventListener("click", () => {
  document.getElementById("results-drawer").classList.remove("open");
});

// Modal helpers
const modalBackdrop = document.getElementById("modal-backdrop");
document.getElementById("modal-close").addEventListener("click", () => modalBackdrop.classList.remove("open"));
function openModal(title, bodyHtml, footHtml = "") {
  document.getElementById("modal-title").textContent = title;
  document.getElementById("modal-body").innerHTML = bodyHtml;
  document.getElementById("modal-foot").innerHTML = footHtml;
  modalBackdrop.classList.add("open");
}

function triggerAutosave() {
  if (document.getElementById("chk-autosave").checked) {
    saveAutosave(project);
  }
}

function getSelectedObj() {
  return project.objects.find((o) => o.id === selectedId) || null;
}

function setStatus(text, cls = "") {
  const el = document.getElementById("solver-status");
  el.textContent = text;
  el.className = cls;
}

function updateHud() {
  const obj = getSelectedObj();
  document.getElementById("hud-selected").textContent = obj
    ? `Selected: ${obj.name} (${obj.kind}) @ [${obj.position.map((v) => v.toFixed(2)).join(", ")}]`
    : "Selected: None";
}

// Renderers
function renderTree() {
  const tree = document.getElementById("component-tree");
  const byParent = new Map();
  for (const o of project.objects) {
    const p = o.connectTo || "MyAirplane";
    if (!byParent.has(p)) byParent.set(p, []);
    byParent.get(p).push(o);
  }

  let html = `
    <div class="tree-node" data-id="__root__">
      <div class="tree-left"><span class="tree-icon" style="background:#7f8c8d;"></span><span>${project.aircraftName}</span></div>
    </div>
    <div class="tree-node" data-id="__cg__" style="padding-left:18px;">
      <div class="tree-left"><span class="tree-icon" style="background:#8e44ad;"></span><span>Center of Gravity</span></div>
    </div>
    <div class="tree-node" data-id="__ac__" style="padding-left:18px;">
      <div class="tree-left"><span class="tree-icon" style="background:#00bcd4;"></span><span>Aerodynamic Center</span></div>
    </div>
  `;

  function walk(parentId, depth) {
    const kids = byParent.get(parentId) || [];
    for (const o of kids) {
      const iconCol =
        o.kind === "wing"
          ? "#3498db"
          : o.kind === "group"
            ? "#7f8c8d"
            : o.kind === "propeller"
              ? "#16a085"
              : o.kind?.endsWith("light")
                ? "#f1c40f"
                : "#e67e22";
      const sel = o.id === selectedId ? "selected" : "";
      html += `
        <div class="tree-node ${sel}" data-id="${o.id}" style="padding-left:${18 + depth * 14}px;">
          <div class="tree-left"><span class="tree-icon" style="background:${iconCol};"></span><span>${o.name}</span></div>
          ${o.kind === "wing" ? '<span class="tree-badge" title="Lifting Wing"></span>' : ""}
        </div>
      `;
      walk(o.id, depth + 1);
    }
  }
  walk("MyAirplane", 0);

  tree.innerHTML = html;
  tree.querySelectorAll(".tree-node").forEach((el) => {
    if (el.dataset.id === selectedId) el.classList.add("selected");
    el.addEventListener("click", () => {
      selectedId = el.dataset.id;
      renderAll();
    });
    el.addEventListener("dblclick", () => {
      if (el.dataset.id === "__root__") {
        handleCommand("aircraft-settings");
      }
    });
  });
}

function numInput(val, onChange, step = "0.1") {
  const inp = document.createElement("input");
  inp.type = "text";
  inp.inputMode = "decimal";
  inp.className = "num-blue";
  inp.value = Number(val ?? 0).toFixed(4);

  const commit = () => {
    const num = parseFloat(inp.value);
    if (!Number.isNaN(num)) {
      onChange(num);
      inp.value = num.toFixed(4);
    } else {
      inp.value = Number(val ?? 0).toFixed(4);
    }
  };
  inp.addEventListener("change", commit);
  inp.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      commit();
      inp.blur();
    }
  });

  // Drag right to increase, left to decrease (click without drag to type)
  inp.addEventListener("mousedown", (e) => {
    if (document.activeElement === inp) return;
    e.preventDefault();
    const startX = e.clientX;
    const startVal = parseFloat(inp.value) || 0;
    const stepNum = parseFloat(step) || 0.1;
    let moved = false;

    const onMove = (me) => {
      const dx = me.clientX - startX;
      if (!moved && Math.abs(dx) < 3) return;
      if (!moved) {
        moved = true;
        document.body.style.cursor = "ew-resize";
      }
      const fine = me.shiftKey ? 0.1 : 1.0;
      const newVal = startVal + dx * stepNum * 0.25 * fine;
      inp.value = newVal.toFixed(4);
      onChange(newVal);
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      if (!moved) {
        inp.focus();
        inp.select();
      }
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  });

  return inp;
}

function addRow(container, labelText, controlEl) {
  const row = document.createElement("div");
  row.className = "row";
  const lbl = document.createElement("label");
  lbl.className = "lbl";
  lbl.textContent = labelText;
  const val = document.createElement("div");
  val.className = "val";
  val.appendChild(controlEl);
  row.appendChild(lbl);
  row.appendChild(val);
  container.appendChild(row);
}

function updatePanelVisibility() {
  const secObj = document.getElementById("sec-object");
  const secGeo = document.getElementById("sec-geometry");
  const secMat = document.getElementById("sec-material");
  const obj = getSelectedObj();
  const isSpecial = selectedId === "__root__" || selectedId === "__cg__" || selectedId === "__ac__";

  if (!obj && !isSpecial) {
    secObj.classList.add("hidden-panel");
    secGeo.classList.add("hidden-panel");
    secMat.classList.add("hidden-panel");
    return;
  }
  secObj.classList.remove("hidden-panel");
  if (selectedId === "__root__" || obj?.kind === "group" || obj?.kind?.endsWith("light")) {
    secGeo.classList.add("hidden-panel");
  } else {
    secGeo.classList.remove("hidden-panel");
  }
  if (obj?.material) {
    secMat.classList.remove("hidden-panel");
  } else {
    secMat.classList.add("hidden-panel");
  }
}

function renderObjectPanel() {
  const body = document.getElementById("object-panel-body");
  body.innerHTML = "";
  if (selectedId === "__root__") {
    const nameInp = document.createElement("input");
    nameInp.type = "text";
    nameInp.value = project.aircraftName;
    nameInp.addEventListener("change", () => {
      project.aircraftName = nameInp.value.trim() || "MyAirplane";
      renderTree();
      triggerAutosave();
    });
    addRow(body, "Name", nameInp);
    addRow(body, "Weight", numInput(project.weight, (v) => { project.weight = v; triggerAutosave(); }, "1"));
    const btnCfg = document.createElement("button");
    btnCfg.className = "btn";
    btnCfg.style.width = "100%";
    btnCfg.textContent = "Aircraft & Solver Settings...";
    btnCfg.addEventListener("click", () => handleCommand("aircraft-settings"));
    body.appendChild(btnCfg);
    return;
  }
  if (selectedId === "__cg__") {
    const posWrap = document.createElement("div");
    posWrap.className = "vec3";
    [0, 1, 2].forEach((idx) => {
      posWrap.appendChild(numInput(project.cg[idx], (v) => {
        project.cg[idx] = v;
        viewport.syncProject(project, null);
        triggerAutosave();
      }));
    });
    addRow(body, "Position", posWrap);
    return;
  }
  if (selectedId === "__ac__") {
    const ac = lastResults?.aero_center?.aero_center;
    const acInfo = document.createElement("div");
    acInfo.style.color = "var(--text-muted)";
    acInfo.textContent = ac ? `[${ac.map((v) => Number(v).toFixed(4)).join(", ")}]` : "Run Aerodynamic Center to compute.";
    addRow(body, "Position", acInfo);
    return;
  }

  const obj = getSelectedObj();
  if (!obj) {
    body.innerHTML = '<div style="color:#777;">No object selected.</div>';
    return;
  }

  // Name
  const nameInp = document.createElement("input");
  nameInp.type = "text";
  nameInp.value = obj.name;
  nameInp.addEventListener("change", () => {
    obj.name = nameInp.value.trim() || obj.name;
    renderTree();
    updateHud();
    triggerAutosave();
  });
  addRow(body, "Name", nameInp);

  // Connect To
  const connSel = document.createElement("select");
  const rootOpt = document.createElement("option");
  rootOpt.value = "MyAirplane";
  rootOpt.textContent = project.aircraftName;
  connSel.appendChild(rootOpt);
  for (const other of project.objects) {
    if (other.id === obj.id) continue;
    if (other.kind === "wing" || other.kind === "group") {
      const opt = document.createElement("option");
      opt.value = other.id;
      opt.textContent = other.name;
      connSel.appendChild(opt);
    }
  }
  connSel.value = obj.connectTo || "MyAirplane";
  connSel.addEventListener("change", () => {
    obj.connectTo = connSel.value;
    renderAll();
    triggerAutosave();
  });
  addRow(body, "Connect To", connSel);

  // Connect Location (if parent is wing)
  const parentObj = project.objects.find((o) => o.id === obj.connectTo);
  if (parentObj?.kind === "wing") {
    const locSel = document.createElement("select");
    ["root", "tip"].forEach((l) => {
      const opt = document.createElement("option");
      opt.value = l;
      opt.textContent = l;
      locSel.appendChild(opt);
    });
    locSel.value = obj.connectLocation || "root";
    locSel.addEventListener("change", () => {
      obj.connectLocation = locSel.value;
      viewport.syncProject(project, selectedId);
      triggerAutosave();
    });
    addRow(body, "Location", locSel);
  }

  // Position
  const posWrap = document.createElement("div");
  posWrap.className = "vec3";
  [0, 1, 2].forEach((idx) => {
    posWrap.appendChild(
      numInput(obj.position[idx], (v) => {
        obj.position[idx] = v;
        viewport.syncProject(project, selectedId);
        updateHud();
        triggerAutosave();
      })
    );
  });
  addRow(body, "Position", posWrap);

  // Rotation
  const rotWrap = document.createElement("div");
  rotWrap.className = "vec3";
  [0, 1, 2].forEach((idx) => {
    rotWrap.appendChild(
      numInput(obj.rotation[idx], (v) => {
        obj.rotation[idx] = v;
        viewport.syncProject(project, selectedId);
        triggerAutosave();
      }, "1")
    );
  });
  addRow(body, "Rotation", rotWrap);

  // Scale
  if (!obj.kind?.endsWith("light")) {
    const scaleWrap = document.createElement("div");
    scaleWrap.className = "vec3";
    const sc = obj.scale || [1, 1, 1];
    [0, 1, 2].forEach((idx) => {
      scaleWrap.appendChild(
        numInput(sc[idx], (v) => {
          obj.scaleEnabled = true;
          if (!obj.scale) obj.scale = [1, 1, 1];
          obj.scale[idx] = Math.max(0.01, v);
          viewport.syncProject(project, selectedId);
          triggerAutosave();
        }, "0.1")
      );
    });
    addRow(body, "Scale", scaleWrap);
  }

  // Visible
  const visChk = document.createElement("input");
  visChk.type = "checkbox";
  visChk.checked = obj.visible !== false;
  visChk.addEventListener("change", () => {
    obj.visible = visChk.checked;
    viewport.syncProject(project, selectedId);
    triggerAutosave();
  });
  addRow(body, "Visible", visChk);

  if (obj.kind?.endsWith("light")) {
    addRow(body, "Color", createColorControl(obj.color || "#ffffff", (hex) => {
      obj.color = hex;
      viewport.syncProject(project, selectedId);
      triggerAutosave();
    }));
    if (obj.kind === "hemispherelight") {
      addRow(body, "Ground Color", createColorControl(obj.groundColor || "#444444", (hex) => {
        obj.groundColor = hex;
        viewport.syncProject(project, selectedId);
        triggerAutosave();
      }));
    }
    addRow(body, "Intensity", numInput(obj.intensity ?? 0.85, (v) => {
      obj.intensity = Math.max(0, v);
      viewport.syncProject(project, selectedId);
      triggerAutosave();
    }, "0.1"));
  }
}

function makeSubSection(parent, title, collapsed = true) {
  const wrap = document.createElement("div");
  wrap.className = `panel-subsection${collapsed ? " collapsed" : ""}`;
  const hdr = document.createElement("div");
  hdr.className = "sub-header";
  hdr.innerHTML = `<span class="tri">${collapsed ? "▸" : "▾"}</span> ${title}`;
  const subBody = document.createElement("div");
  subBody.className = "sub-body";
  hdr.addEventListener("click", () => {
    wrap.classList.toggle("collapsed");
    hdr.querySelector(".tri").textContent = wrap.classList.contains("collapsed") ? "▸" : "▾";
  });
  wrap.appendChild(hdr);
  wrap.appendChild(subBody);
  parent.appendChild(wrap);
  return subBody;
}

function renderAirfoilFields(container, af, onUpdate) {
  const nameInp = document.createElement("input");
  nameInp.type = "text";
  nameInp.value = af.name || "";
  nameInp.addEventListener("change", () => {
    af.name = nameInp.value;
    onUpdate();
  });
  addRow(container, "Airfoil (NACA)", nameInp);

  const fields = [
    ["Zero-Lift Alpha (rad)", "aL0", "0.001"],
    ["Lift Slope (1/rad)", "CLa", "0.05"],
    ["Zero-Lift Cm", "CmL0", "0.001"],
    ["Moment Slope (1/rad)", "Cma", "0.005"],
    ["Parasitic CD", "CD0", "0.001"],
    ["CD1", "CD1", "0.001"],
    ["CD2", "CD2", "0.001"],
    ["Max CL", "CL_max", "0.05"],
  ];
  for (const [label, key, step] of fields) {
    addRow(
      container,
      label,
      numInput(af[key], (v) => {
        af[key] = v;
        onUpdate();
      }, step)
    );
  }
}

function renderGeometryPanel() {
  const body = document.getElementById("geometry-panel-body");
  body.innerHTML = "";
  if (selectedId === "__cg__") {
    addRow(body, "Radius", numInput(project.cgRadius ?? 0.06, (v) => {
      project.cgRadius = Math.max(0.01, v);
      viewport.setMarkerRadii(project.cgRadius, project.acRadius);
      triggerAutosave();
    }, "0.01"));
    return;
  }
  if (selectedId === "__ac__") {
    addRow(body, "Radius", numInput(project.acRadius ?? 0.06, (v) => {
      project.acRadius = Math.max(0.01, v);
      viewport.setMarkerRadii(project.cgRadius, project.acRadius);
      triggerAutosave();
    }, "0.01"));
    return;
  }
  const obj = getSelectedObj();
  if (!obj) {
    body.innerHTML = '<div style="color:#777;">No object selected.</div>';
    return;
  }

  const sync = () => {
    viewport.syncProject(project, selectedId);
    triggerAutosave();
  };

  if (obj.kind === "wing") {
    const mainChk = document.createElement("input");
    mainChk.type = "checkbox";
    mainChk.checked = Boolean(obj.isMain);
    mainChk.addEventListener("change", () => {
      obj.isMain = mainChk.checked;
      sync();
    });
    addRow(body, "Main Wing", mainChk);

    const sideSel = document.createElement("select");
    [["both", "Both"], ["right", "Right"], ["left", "Left"]].forEach(([val, lbl]) => {
      const opt = document.createElement("option");
      opt.value = val;
      opt.textContent = lbl;
      sideSel.appendChild(opt);
    });
    sideSel.value = obj.side || "both";
    sideSel.addEventListener("change", () => {
      obj.side = sideSel.value;
      sync();
    });
    addRow(body, "Side", sideSel);

    const wingNums = [
      ["y-Offset", "yOffset", "0.1"],
      ["Semispan", "semispan", "0.1"],
      ["Mount Angle (deg)", "mountAngle", "0.5"],
      ["Washout (deg)", "washout", "0.5"],
      ["Sweep (deg)", "sweep", "1"],
      ["Dihedral (deg)", "dihedral", "1"],
      ["Root Chord", "rootChord", "0.1"],
      ["Tip Chord", "tipChord", "0.1"],
    ];
    for (const [label, key, step] of wingNums) {
      addRow(
        body,
        label,
        numInput(obj[key], (v) => {
          obj[key] = v;
          sync();
        }, step)
      );
    }

    const rootAfBody = makeSubSection(body, "Root Airfoil", true);
    renderAirfoilFields(rootAfBody, obj.rootAirfoil, sync);

    const tipAfBody = makeSubSection(body, "Tip Airfoil", true);
    renderAirfoilFields(tipAfBody, obj.tipAirfoil, sync);

    addRow(
      body,
      "Spanwise Segments",
      numInput(obj.spanwiseSegments, (v) => {
        obj.spanwiseSegments = Math.max(4, Math.round(v));
        sync();
      }, "1")
    );

    const csBody = makeSubSection(body, "Control Surface", !obj.controlSurface?.enabled);
    const cs = obj.controlSurface;
    const csChk = document.createElement("input");
    csChk.type = "checkbox";
    csChk.checked = Boolean(cs.enabled);
    csChk.addEventListener("change", () => {
      cs.enabled = csChk.checked;
      sync();
    });
    addRow(csBody, "Has control surface", csChk);

    const csFields = [
      ["Root/Span", "rootSpan", "0.05"],
      ["Tip/Span", "tipSpan", "0.05"],
      ["C_f (root)", "cfRoot", "0.05"],
      ["C_f (tip)", "cfTip", "0.05"],
      ["Elevator Mix", "elevatorMix", "0.1"],
      ["Rudder Mix", "rudderMix", "0.1"],
      ["Aileron Mix", "aileronMix", "0.1"],
      ["Flap Mix", "flapMix", "0.1"],
    ];
    for (const [label, key, step] of csFields) {
      addRow(
        csBody,
        label,
        numInput(cs[key], (v) => {
          cs[key] = v;
          sync();
        }, step)
      );
    }
  } else if (obj.kind === "sphere") {
    [["Radius", "radius", "0.05"], ["Width segs", "widthSegments", "2"], ["Height segs", "heightSegments", "2"]].forEach(
      ([lbl, k, st]) => addRow(body, lbl, numInput(obj[k], (v) => { obj[k] = v; sync(); }, st))
    );
  } else if (obj.kind === "cylinder") {
    [["Radius top", "radiusTop", "0.02"], ["Radius bottom", "radiusBottom", "0.02"], ["Height", "height", "0.1"], ["Radial segs", "radialSegments", "2"]].forEach(
      ([lbl, k, st]) => addRow(body, lbl, numInput(obj[k], (v) => { obj[k] = v; sync(); }, st))
    );
  } else if (obj.kind === "circle") {
    [["Radius", "radius", "0.05"], ["Segments", "segments", "2"]].forEach(
      ([lbl, k, st]) => addRow(body, lbl, numInput(obj[k], (v) => { obj[k] = v; sync(); }, st))
    );
  } else if (obj.kind === "box") {
    [["Width", "width", "0.1"], ["Height", "height", "0.1"], ["Depth", "depth", "0.1"]].forEach(
      ([lbl, k, st]) => addRow(body, lbl, numInput(obj[k], (v) => { obj[k] = v; sync(); }, st))
    );
  } else if (obj.kind === "propeller") {
    [
      ["Diameter", "diameter", "0.05"],
      ["Pitch", "pitch", "0.05"],
      ["Hub Radius", "hubRadius", "0.01"],
      ["Root Chord", "rootChord", "0.01"],
      ["Tip Chord", "tipChord", "0.01"],
      ["Blades", "blades", "1"],
    ].forEach(([lbl, k, st]) => addRow(body, lbl, numInput(obj[k], (v) => { obj[k] = v; sync(); }, st)));
  } else {
    body.innerHTML = '<div style="color:#777;">Container (no geometry).</div>';
  }
}

let activeColorPopover = null;
function closeColorPopover() {
  if (activeColorPopover) {
    activeColorPopover.remove();
    activeColorPopover = null;
  }
}
document.addEventListener("mousedown", (e) => {
  if (activeColorPopover && !activeColorPopover.contains(e.target) && !e.target.classList.contains("color-swatch-btn")) {
    closeColorPopover();
  }
});

function createColorControl(initialHex, onChange) {
  const wrap = document.createElement("div");
  wrap.className = "color-field";

  const swatch = document.createElement("button");
  swatch.type = "button";
  swatch.className = "color-swatch-btn";
  swatch.style.background = initialHex || "#d9e2ec";

  const hexInp = document.createElement("input");
  hexInp.type = "text";
  hexInp.className = "color-hex-inp";
  hexInp.value = (initialHex || "#d9e2ec").toUpperCase();

  const applyHex = (hex) => {
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return;
    swatch.style.background = hex;
    hexInp.value = hex.toUpperCase();
    onChange(hex.toLowerCase());
  };

  hexInp.addEventListener("change", () => {
    let v = hexInp.value.trim();
    if (!v.startsWith("#")) v = "#" + v;
    applyHex(v);
  });

  swatch.addEventListener("click", (e) => {
    e.stopPropagation();
    closeColorPopover();
    const rect = swatch.getBoundingClientRect();
    const pop = document.createElement("div");
    pop.className = "color-popover";
    // Anchor to the LEFT of the sidebar so it NEVER clips off the right edge!
    const left = Math.max(8, Math.min(window.innerWidth - 232, rect.left - 228));
    const top = Math.max(36, Math.min(window.innerHeight - 230, rect.top - 40));
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;

    const presets = [
      "#d9e2ec", "#ffffff", "#b0bec5", "#546e7a", "#263238", "#000000",
      "#e74c3c", "#ff8000", "#f1c40f", "#2ecc71", "#00bcd4", "#2980b9",
      "#8e44ad", "#ff6b81", "#d9822b", "#27ae60", "#1abc9c", "#34495e",
    ];
    pop.innerHTML = `
      <div class="color-popover-title"><span>Colors</span><button type="button" class="btn" style="padding:1px 5px;" id="cp-close">✕</button></div>
      <div class="color-swatches-grid">
        ${presets.map((c) => `<div class="color-preset" data-c="${c}" style="background:${c};" title="${c}"></div>`).join("")}
      </div>
      <div class="color-sliders">
        <div class="color-slider-row"><span>R</span><input type="range" min="0" max="255" id="cp-r" /><span id="cp-rv">0</span></div>
        <div class="color-slider-row"><span>G</span><input type="range" min="0" max="255" id="cp-g" /><span id="cp-gv">0</span></div>
        <div class="color-slider-row"><span>B</span><input type="range" min="0" max="255" id="cp-b" /><span id="cp-bv">0</span></div>
      </div>
    `;
    document.body.appendChild(pop);
    activeColorPopover = pop;

    const hexToRgb = (h) => [
      parseInt(h.slice(1, 3), 16) || 0,
      parseInt(h.slice(3, 5), 16) || 0,
      parseInt(h.slice(5, 7), 16) || 0,
    ];
    const rgbToHex = (r, g, b) =>
      "#" + [r, g, b].map((x) => Math.max(0, Math.min(255, x)).toString(16).padStart(2, "0")).join("");

    const [r0, g0, b0] = hexToRgb(hexInp.value);
    const rEl = pop.querySelector("#cp-r");
    const gEl = pop.querySelector("#cp-g");
    const bEl = pop.querySelector("#cp-b");
    const syncSliders = (r, g, b) => {
      rEl.value = r; gEl.value = g; bEl.value = b;
      pop.querySelector("#cp-rv").textContent = r;
      pop.querySelector("#cp-gv").textContent = g;
      pop.querySelector("#cp-bv").textContent = b;
    };
    syncSliders(r0, g0, b0);

    const onSlide = () => {
      const r = +rEl.value, g = +gEl.value, b = +bEl.value;
      syncSliders(r, g, b);
      applyHex(rgbToHex(r, g, b));
    };
    [rEl, gEl, bEl].forEach((s) => s.addEventListener("input", onSlide));

    pop.querySelectorAll(".color-preset").forEach((sw) => {
      sw.addEventListener("click", () => {
        const c = sw.dataset.c;
        const [r, g, b] = hexToRgb(c);
        syncSliders(r, g, b);
        applyHex(c);
      });
    });
    pop.querySelector("#cp-close").addEventListener("click", closeColorPopover);
  });

  wrap.appendChild(swatch);
  wrap.appendChild(hexInp);
  return wrap;
}

function renderMaterialPanel() {
  const body = document.getElementById("material-panel-body");
  body.innerHTML = "";
  const obj = getSelectedObj();
  if (!obj || !obj.material) {
    body.innerHTML = '<div style="color:#777;">No material.</div>';
    return;
  }
  const m = obj.material;
  const sync = () => {
    viewport.syncProject(project, selectedId);
    triggerAutosave();
  };

  addRow(body, "Color", createColorControl(m.color || "#d9e2ec", (hex) => { m.color = hex; sync(); }));

  addRow(body, "Shininess", numInput(m.shininess ?? 30, (v) => { m.shininess = v; sync(); }, "5"));
  addRow(body, "Opacity", numInput(m.opacity ?? 1, (v) => { m.opacity = Math.max(0.1, Math.min(1, v)); sync(); }, "0.1"));

  const wfChk = document.createElement("input");
  wfChk.type = "checkbox";
  wfChk.checked = Boolean(m.wireframe);
  wfChk.addEventListener("change", () => { m.wireframe = wfChk.checked; sync(); });
  addRow(body, "Wireframe", wfChk);
}

function renderConditionPanel() {
  const body = document.getElementById("condition-panel-body");
  body.innerHTML = "";
  const c = project.condition;
  const fields = [
    ["Velocity", "velocity", "5"],
    ["Altitude", "altitude", "50"],
    ["Alpha (deg)", "alpha", "0.5"],
    ["Beta (deg)", "beta", "0.5"],
    ["Elevator (deg)", "elevator", "1"],
    ["Rudder (deg)", "rudder", "1"],
    ["Aileron (deg)", "aileron", "1"],
    ["Flap (deg)", "flap", "1"],
  ];
  for (const [label, key, step] of fields) {
    addRow(
      body,
      label,
      numInput(c[key], (v) => {
        c[key] = v;
        viewport.syncProject(project, selectedId);
        triggerAutosave();
      }, step)
    );
  }
}

function renderAnalysisPanel() {
  const body = document.getElementById("analysis-panel-body");
  body.innerHTML = "";

  const runSel = document.createElement("select");
  runSel.id = "sel-run-action";
  [
    ["full", "Full Analysis (All)"],
    ["solve", "Forces and Moments"],
    ["derivatives", "Performance Derivatives"],
    ["aero_center", "Aerodynamic Center"],
    ["stall_onset", "Stall Onset"],
    ["target_cl", "Target CL"],
    ["trim", "Pitch Trim"],
    ["distributions", "Distributions"],
  ].forEach(([val, lbl]) => {
    const opt = document.createElement("option");
    opt.value = val;
    opt.textContent = lbl;
    runSel.appendChild(opt);
  });
  addRow(body, "Run", runSel);

  const trimOpts = document.createElement("div");
  trimOpts.style.display = "none";
  addRow(trimOpts, "Target CL", numInput(trimTargetCL, (v) => { trimTargetCL = v; }, "0.05"));
  const cmRow = document.createElement("div");
  addRow(cmRow, "Target Cm", numInput(trimTargetCm, (v) => { trimTargetCm = v; }, "0.01"));
  trimOpts.appendChild(cmRow);
  body.appendChild(trimOpts);
  runSel.addEventListener("change", () => {
    const v = runSel.value;
    trimOpts.style.display = (v === "trim" || v === "target_cl") ? "block" : "none";
    cmRow.style.display = v === "trim" ? "block" : "none";
  });

  const btnRow = document.createElement("div");
  btnRow.className = "btn-row";
  const btnUpdate = document.createElement("button");
  btnUpdate.className = "btn btn-primary";
  btnUpdate.textContent = "Update Results";
  btnUpdate.addEventListener("click", () => runSolver(runSel.value));

  const btnSave = document.createElement("button");
  btnSave.className = "btn";
  btnSave.textContent = "Save Results";
  btnSave.addEventListener("click", () => {
    if (!lastResults) return alert("Run an analysis first.");
    downloadJson(`${project.aircraftName}_results.json`, lastResults);
  });
  btnRow.appendChild(btnUpdate);
  btnRow.appendChild(btnSave);
  body.appendChild(btnRow);

  const ref = lastResults?.reference_geometry || {};
  const tot = lastResults?.forces?.total || {};
  const sm = lastResults?.derivatives?.stability?.["%_static_margin"];
  const trim = lastResults?.trim;

  const readouts = document.createElement("div");
  readouts.className = "readout-grid";
  const f = (v, d = 4) => (v !== undefined && v !== null ? Number(v).toFixed(d) : "—");
  readouts.innerHTML = `
    <div class="readout-item"><span>Ref Area</span><span>${f(ref.area, 3)}</span></div>
    <div class="readout-item"><span>Lat Len</span><span>${f(ref.lateral_length, 3)}</span></div>
    <div class="readout-item"><span>CL</span><span>${f(tot.CL)}</span></div>
    <div class="readout-item"><span>CD</span><span>${f(tot.CD)}</span></div>
    <div class="readout-item"><span>CS</span><span>${f(tot.CS)}</span></div>
    <div class="readout-item"><span>Cl</span><span>${f(tot.Cl)}</span></div>
    <div class="readout-item"><span>Cm</span><span>${f(tot.Cm)}</span></div>
    <div class="readout-item"><span>Cn</span><span>${f(tot.Cn)}</span></div>
    <div class="readout-item"><span>Static Margin</span><span>${sm !== undefined ? f(sm, 1) + "%" : "—"}</span></div>
    <div class="readout-item"><span>Trim Alpha</span><span>${trim ? f(trim.alpha, 2) + "°" : "—"}</span></div>
  `;
  body.appendChild(readouts);

  const btnDrawer = document.createElement("button");
  btnDrawer.className = "btn";
  btnDrawer.style.width = "100%";
  btnDrawer.style.marginTop = "8px";
  btnDrawer.textContent = "Open Detailed Results & Plots";
  btnDrawer.addEventListener("click", () => {
    document.getElementById("results-drawer").classList.add("open");
    renderDrawerContent();
  });
  body.appendChild(btnDrawer);
}

function renderDrawerContent() {
  const el = document.getElementById("drawer-content");
  if (!lastResults) {
    el.innerHTML = '<div style="color:#666;">Run an analysis from the ANALYSIS panel to inspect results.</div>';
    return;
  }
  if (activeDrawerTab === "forces") {
    let notes = "";
    if (lastResults.trim) {
      notes += `<div style="margin-bottom:8px;padding:6px 10px;background:#e8f4fd;border:1px solid #b6d4fe;">
        <b>Pitch Trim:</b> Alpha = ${Number(lastResults.trim.alpha).toFixed(4)} deg, Elevator = ${Number(lastResults.trim.elevator).toFixed(4)} deg
      </div>`;
    }
    if (lastResults.target_cl) {
      notes += `<div style="margin-bottom:8px;padding:6px 10px;background:#eafaf1;border:1px solid #a9dfbf;">
        <b>Target CL (${Number(lastResults.target_cl.CL).toFixed(4)}):</b> Alpha = ${Number(lastResults.target_cl.alpha).toFixed(4)} deg
      </div>`;
    }
    if (lastResults.stall_onset) {
      const st = lastResults.stall_onset;
      notes += `<div style="margin-bottom:8px;padding:6px 10px;background:#fef9e7;border:1px solid #f9e79f;">
        <b>Stall Onset:</b> Alpha = ${Number(st.alpha).toFixed(2)} deg, CL = ${Number(st.CL).toFixed(4)}${st.segment ? `, Critical Segment = ${st.segment} (max section CL = ${Number(st.max_section_CL).toFixed(3)} vs CL_max ${Number(st.CL_max_limit).toFixed(2)})` : ""}
      </div>`;
    }
    el.innerHTML = notes + renderForcesTable(lastResults.forces);
  } else if (activeDrawerTab === "derivatives") {
    el.innerHTML = renderDerivativesTable(lastResults.derivatives);
  } else if (activeDrawerTab === "distributions") {
    el.innerHTML = renderDistributionsPlots(lastResults.distributions);
  } else {
    el.innerHTML = `<pre style="font-size:11px;margin:0;white-space:pre-wrap;">${JSON.stringify(lastResults, null, 2)}</pre>`;
  }
}

async function runSolver(action) {
  const exported = exportToMachUpX(project);
  setStatus(`Running MachUpX (${action})...`, "running");
  const overlay = document.getElementById("loading-overlay");
  if (overlay) overlay.classList.add("open");
  try {
    const resp = await fetch(`/api/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scene: exported.scene,
        aircraft: exported.aircraft,
        aircraft_name: exported.aircraftName,
        options: action === "trim"
          ? { CL: trimTargetCL, Cm: trimTargetCm }
          : action === "target_cl"
            ? { CL: trimTargetCL }
            : { run_trim: action === "full" },
      }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      setStatus(`Error: ${data.detail || "Solver failed"}`, "error");
      alert(`MachUpX Error:\n\n${data.detail || "Unknown error"}`);
      return;
    }
    lastResults = { ...(lastResults || {}), ...data };
    if (data.trim) {
      if (data.trim.alpha !== undefined) project.condition.alpha = Number(data.trim.alpha);
      if (data.trim.elevator !== undefined) project.condition.elevator = Number(data.trim.elevator);
    }
    if (data.target_cl?.alpha !== undefined) {
      project.condition.alpha = Number(data.target_cl.alpha);
    }
    if (data.aero_center?.aero_center) {
      viewport.setAeroCenter(data.aero_center.aero_center);
    }
    setStatus(`Solved (${action})`, "ok");
    renderConditionPanel();
    renderAnalysisPanel();
    viewport.syncProject(project, selectedId);
    document.getElementById("results-drawer").classList.add("open");
    renderDrawerContent();
  } catch (err) {
    setStatus("Network error", "error");
    alert(`Failed to reach backend: ${err.message}`);
  } finally {
    if (overlay) overlay.classList.remove("open");
  }
}

function downloadJson(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

async function handleCommand(cmd) {
  if (cmd === "new") {
    project = createDefaultProject();
    selectedId = null;
    lastResults = null;
    viewport.setAeroCenter(null);
    renderAll();
  } else if (cmd === "open") {
    document.getElementById("file-open-input").click();
  } else if (cmd === "save") {
    downloadJson(`${project.aircraftName}_project.json`, project);
  } else if (cmd === "ex-traditional" || cmd === "ex-flying-wing") {
    const exName = cmd === "ex-traditional" ? "traditional" : "flying_wing";
    setStatus(`Loading ${exName} example...`, "running");
    try {
      const r = await fetch(`/api/examples/${exName}`);
      const d = await r.json();
      project = importFromMachUpX(d.aircraft_name, d.scene, d.aircraft);
    } catch {
      project = createTraditionalProject();
    }
    selectedId = project.objects[0]?.id || null;
    lastResults = null;
    viewport.setAeroCenter(null);
    setStatus(`Loaded ${exName}`, "ok");
    renderAll();
  } else if (cmd === "export-mx") {
    const exp = exportToMachUpX(project);
    downloadJson(`${exp.aircraftName}_aircraft.json`, exp.aircraft);
    downloadJson(`${exp.aircraftName}_scene.json`, exp.scene);
  } else if (cmd === "export-stl") {
    const exp = exportToMachUpX(project);
    setStatus("Exporting STL via MachUpX...", "running");
    const resp = await fetch("/api/export_stl", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scene: exp.scene, aircraft: exp.aircraft, aircraft_name: exp.aircraftName }),
    });
    if (!resp.ok) {
      const err = await resp.json();
      setStatus("STL Export Error", "error");
      return alert(err.detail);
    }
    const blob = await resp.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${exp.aircraftName}.stl`;
    a.click();
    setStatus("STL exported", "ok");
  } else if (cmd === "exit") {
    setStatus("Shutting down...", "running");
    try {
      await fetch("/api/shutdown", { method: "POST" });
    } catch { /* server may already be gone */ }
    window.close();
    setTimeout(() => alert("Server stopped. You can close this tab."), 800);
  } else if (cmd === "add-wing") {
    const w = createWing(`Wing_${project.objects.length + 1}`);
    project.objects.push(w);
    selectedId = w.id;
    renderAll();
  } else if (cmd === "add-group") {
    const g = createGroup(`Group_${project.objects.length + 1}`);
    project.objects.push(g);
    selectedId = g.id;
    renderAll();
  } else if (cmd === "add-propeller") {
    const p = createPropeller(`Propeller_${project.objects.length + 1}`);
    project.objects.push(p);
    selectedId = p.id;
    renderAll();
  } else if (cmd === "add-box" || cmd === "add-circle" || cmd === "add-cylinder" || cmd === "add-sphere") {
    const kind = cmd.replace("add-", "");
    const p = createPrimitive(kind, `${kind[0].toUpperCase() + kind.slice(1)}_${project.objects.length + 1}`);
    project.objects.push(p);
    selectedId = p.id;
    renderAll();
  } else if (
    cmd === "add-pointlight" ||
    cmd === "add-spotlight" ||
    cmd === "add-directionallight" ||
    cmd === "add-hemispherelight" ||
    cmd === "add-ambientlight"
  ) {
    const kind = cmd.replace("add-", "");
    const l = createLight(kind);
    project.objects.push(l);
    selectedId = l.id;
    renderAll();
  } else if (cmd === "theme-light" || cmd === "theme-dark") {
    project.theme = cmd === "theme-dark" ? "dark" : "light";
    renderAll();
  } else if (cmd === "tut-conventional") {
    openModal(
      "Tutorial: Conventional Aircraft Workflow",
      `<ol style="padding-left:18px;line-height:1.5;">
         <li>Start with <b>File → New</b> for a clean scene.</li>
         <li><b>Add → Wing</b> for the Main Wing (<code>isMain = true</code>).</li>
         <li><b>Add → Group</b> (rename to <code>Tail</code>) and nest <code>H-Stab</code> &amp; <code>V-Stab</code> inside it via <b>Connect To</b>.</li>
         <li>Enable <b>Control Surface</b> on wings and set Elevator/Rudder/Aileron mixes.</li>
         <li>Use <b>Add → Sphere / Cylinder / Box / Propeller</b> for visual fuselage, boom, payload &amp; prop.</li>
         <li>Open <b>MATERIAL</b> to color each part (popover opens left without clipping).</li>
         <li>Run <b>ANALYSIS → Pitch Trim</b> or <b>Full Analysis</b> via MachUpX!</li>
       </ol>`
    );
  } else if (cmd === "tut-trim") {
    openModal(
      "Tutorial: Pitch Trim & Static Margin",
      `<ol style="padding-left:18px;line-height:1.5;">
         <li>Ensure at least one horizontal tail has a Control Surface with <b>Elevator Mix = 1.0</b>.</li>
         <li>In <b>ANALYSIS</b>, choose <b>Pitch Trim</b>, enter your cruise <b>Target CL</b> (e.g. 0.46) and <b>Target Cm = 0</b>, and click <b>Update Results</b>.</li>
         <li>Adjust Main Wing <b>Mount Angle</b> to bring trim Alpha near 0°.</li>
         <li>Run <b>Performance Derivatives</b> to inspect <b>Static Margin (%)</b> and stability derivatives, or <b>Aerodynamic Center</b> to plot the AC marker.</li>
       </ol>`
    );
  } else if (cmd === "duplicate") {
    const obj = getSelectedObj();
    if (!obj) return;
    const copy = JSON.parse(JSON.stringify(obj));
    copy.id = `${obj.kind}_${Date.now()}`;
    copy.name = `${obj.name}_copy`;
    copy.position[0] -= 0.5;
    project.objects.push(copy);
    selectedId = copy.id;
    renderAll();
  } else if (cmd === "delete") {
    if (!selectedId) return;
    project.objects = project.objects.filter((o) => o.id !== selectedId);
    selectedId = project.objects[0]?.id || null;
    renderAll();
  } else if (cmd.startsWith("cam-")) {
    viewport.setCameraPreset(cmd.replace("cam-", ""));
  } else if (cmd === "toggle-results") {
    document.getElementById("results-drawer").classList.toggle("open");
    renderDrawerContent();
  } else if (cmd === "aircraft-settings") {
    openModal(
      "Aircraft & Solver Settings",
      `
        <div class="row"><label class="lbl">Aircraft Name</label><div class="val"><input id="ms-name" type="text" value="${project.aircraftName}" /></div></div>
        <div class="row"><label class="lbl">Units</label><div class="val"><select id="ms-units"><option value="English" ${project.units === "English" ? "selected" : ""}>English</option><option value="SI" ${project.units === "SI" ? "selected" : ""}>SI</option></select></div></div>
        <div class="row"><label class="lbl">Weight</label><div class="val"><input id="ms-weight" type="number" value="${project.weight}" /></div></div>
        <div class="row"><label class="lbl">CG [X, Y, Z]</label><div class="val vec3"><input id="ms-cgx" type="number" step="0.1" value="${project.cg[0]}" /><input id="ms-cgy" type="number" step="0.1" value="${project.cg[1]}" /><input id="ms-cgz" type="number" step="0.1" value="${project.cg[2]}" /></div></div>
        <div class="row"><label class="lbl">Solver Type</label><div class="val"><select id="ms-stype"><option value="nonlinear" ${project.solver.type === "nonlinear" ? "selected" : ""}>nonlinear</option><option value="linear" ${project.solver.type === "linear" ? "selected" : ""}>linear</option><option value="scipy_fsolve" ${project.solver.type === "scipy_fsolve" ? "selected" : ""}>scipy_fsolve</option></select></div></div>
        <div class="row"><label class="lbl">Relaxation</label><div class="val"><input id="ms-relax" type="number" step="0.1" value="${project.solver.relaxation}" /></div></div>
        <div class="row"><label class="lbl">Max Iterations</label><div class="val"><input id="ms-maxiter" type="number" value="${project.solver.max_iterations}" /></div></div>
      `,
      `<button class="btn btn-primary" id="ms-save">Apply</button>`
    );
    document.getElementById("ms-save").addEventListener("click", () => {
      project.aircraftName = document.getElementById("ms-name").value.trim() || "MyAirplane";
      project.units = document.getElementById("ms-units").value;
      project.weight = parseFloat(document.getElementById("ms-weight").value) || 100;
      project.cg = [
        parseFloat(document.getElementById("ms-cgx").value) || 0,
        parseFloat(document.getElementById("ms-cgy").value) || 0,
        parseFloat(document.getElementById("ms-cgz").value) || 0,
      ];
      project.solver.type = document.getElementById("ms-stype").value;
      project.solver.relaxation = parseFloat(document.getElementById("ms-relax").value) || 0.9;
      project.solver.max_iterations = parseInt(document.getElementById("ms-maxiter").value, 10) || 200;
      modalBackdrop.classList.remove("open");
      renderAll();
    });
  } else if (cmd === "axis-help") {
    openModal(
      "MachUpX Axis Conventions",
      `<p><b>Body-Fixed Frame:</b></p>
       <ul>
         <li><b>+X (Red):</b> Forward (nose) · <b>-X:</b> Aft (tail)</li>
         <li><b>+Y (Green):</b> Starboard (right wing) · <b>-Y:</b> Port (left wing)</li>
         <li><b>+Z (Blue):</b> Downward · <b>-Z:</b> Upward</li>
       </ul>
       <p><b>Angles:</b> Positive sweep sweeps aft (-X). Positive dihedral tips upward (-Z). Positive twist = nose up.</p>`
    );
  } else if (cmd === "shortcuts") {
    openModal(
      "Keyboard Shortcuts",
      `<ul>
         <li><b>T</b> — Translate gizmo</li>
         <li><b>R</b> — Rotate gizmo</li>
         <li><b>S</b> — Scale gizmo</li>
         <li><b>Ctrl+D</b> — Duplicate selected</li>
         <li><b>Delete</b> — Delete selected</li>
       </ul>`
    );
  } else if (cmd === "about") {
    openModal(
      "About LocalMachX4",
      `<p>LocalMachX4 — a local browser-based aircraft designer powered by the open-source <b>MachUpX v2.7.2</b> generalized numerical lifting-line solver (USU AeroLab, MIT License).</p>`
    );
  }
}

document.getElementById("file-open-input").addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (parsed.objects && parsed.condition) {
        project = parsed;
        selectedId = project.objects[0]?.id || null;
        lastResults = null;
        renderAll();
      } else {
        alert("Unrecognized project JSON format.");
      }
    } catch (err) {
      alert(`Failed to parse JSON: ${err.message}`);
    }
  };
  reader.readAsText(file);
  e.target.value = "";
});

function renderAll() {
  document.body.classList.toggle("dark-theme", project.theme === "dark");
  updatePanelVisibility();
  renderTree();
  renderObjectPanel();
  renderGeometryPanel();
  renderMaterialPanel();
  renderConditionPanel();
  renderAnalysisPanel();
  viewport.syncProject(project, selectedId);
  updateHud();
  triggerAutosave();
}

renderAll();
