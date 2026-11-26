/**
 * Project data model, MachUpX JSON export/import, and autosave.
 * Coordinate convention: MachUpX body-fixed (+X forward, +Y right, +Z down).
 */

export function defaultAirfoil(name = "NACA 2410") {
  if (name.includes("0010") || name.includes("0012")) {
    return {
      name,
      type: "linear",
      aL0: 0.0,
      CLa: 6.4336,
      CmL0: 0.0,
      Cma: 0.0,
      CD0: 0.00513,
      CD1: 0.0,
      CD2: 0.0984,
      CL_max: 1.4,
    };
  }
  return {
    name,
    type: "linear",
    aL0: -0.0368,
    CLa: 6.1976,
    CmL0: -0.0525,
    Cma: 0.0326,
    CD0: 0.00569,
    CD1: -0.0045,
    CD2: 0.0104,
    CL_max: 1.4,
  };
}

let _nextId = 1;
export function genId(prefix = "obj") {
  return `${prefix}_${_nextId++}`;
}

export function createWing(name = "Wing_1", overrides = {}) {
  return {
    id: genId("wing"),
    kind: "wing",
    name,
    connectTo: "MyAirplane",
    connectLocation: "root",
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scaleEnabled: false,
    scale: [1, 1, 1],
    visible: true,
    isMain: true,
    side: "both",
    yOffset: 0.0,
    semispan: 4.0,
    mountAngle: 0.0,
    washout: 0.0,
    sweep: 0.0,
    dihedral: 0.0,
    rootChord: 1.0,
    tipChord: 1.0,
    rootAirfoil: defaultAirfoil("NACA 2410"),
    tipAirfoil: defaultAirfoil("NACA 2410"),
    spanwiseSegments: 40,
    controlSurface: {
      enabled: false,
      rootSpan: 0.2,
      tipSpan: 0.8,
      cfRoot: 0.2,
      cfTip: 0.2,
      isSealed: true,
      elevatorMix: 1.0,
      rudderMix: 0.0,
      aileronMix: 0.0,
      flapMix: 0.0,
    },
    material: {
      color: "#d9e2ec",
      emissive: "#000000",
      shininess: 30,
      opacity: 1.0,
      wireframe: false,
    },
    ...overrides,
  };
}

export function createGroup(name = "Group_1") {
  return {
    id: genId("grp"),
    kind: "group",
    name,
    connectTo: "MyAirplane",
    connectLocation: "root",
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scaleEnabled: false,
    scale: [1, 1, 1],
    visible: true,
    material: { color: "#aaaaaa", emissive: "#000000", shininess: 30, opacity: 1.0, wireframe: false },
  };
}

export function createPrimitive(kind, name) {
  const base = {
    id: genId(kind),
    kind, // "box" | "circle" | "cylinder" | "sphere"
    name: name || `${kind[0].toUpperCase()}${kind.slice(1)}`,
    connectTo: "MyAirplane",
    connectLocation: "root",
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scaleEnabled: false,
    scale: [1, 1, 1],
    visible: true,
    material: { color: "#d9822b", emissive: "#000000", shininess: 30, opacity: 1.0, wireframe: false },
  };
  if (kind === "sphere") {
    return { ...base, radius: 0.3, widthSegments: 32, heightSegments: 16 };
  }
  if (kind === "cylinder") {
    return { ...base, radiusTop: 0.1, radiusBottom: 0.05, height: 3.0, radialSegments: 24, openEnded: false };
  }
  if (kind === "circle") {
    return { ...base, radius: 0.5, segments: 32 };
  }
  return { ...base, width: 1.0, height: 0.4, depth: 0.4 };
}

export function createPropeller(name = "Propeller_1") {
  return {
    id: genId("prop"),
    kind: "propeller",
    name,
    connectTo: "MyAirplane",
    connectLocation: "root",
    position: [0.5, 0, 0],
    rotation: [0, 0, 0],
    scaleEnabled: false,
    scale: [1, 1, 1],
    visible: true,
    diameter: 0.4,
    pitch: 0.25,
    hubRadius: 0.04,
    rootChord: 0.05,
    tipChord: 0.025,
    blades: 2,
    material: { color: "#2c3e50", emissive: "#000000", shininess: 40, opacity: 1.0, wireframe: false },
  };
}

export function createLight(kind = "pointlight", name, overrides = {}) {
  const labelMap = {
    pointlight: "PointLight",
    spotlight: "SpotLight",
    directionallight: "DirectionalLight",
    hemispherelight: "HemisphereLight",
    ambientlight: "AmbientLight",
  };
  return {
    id: genId("light"),
    kind,
    name: name || labelMap[kind] || "Light",
    connectTo: "MyAirplane",
    connectLocation: "root",
    position: [6, 6, -10],
    rotation: [0, 0, 0],
    scaleEnabled: false,
    scale: [1, 1, 1],
    visible: true,
    color: "#ffffff",
    groundColor: "#444444",
    intensity: kind === "ambientlight" ? 0.5 : 0.85,
    distance: 0,
    ...overrides,
  };
}

export function createDefaultProject() {
  _nextId = 1;
  return {
    aircraftName: "MyAirplane",
    units: "English",
    weight: 100.0,
    cg: [0, 0, 0],
    cgRadius: 0.06,
    acRadius: 0.06,
    theme: "light",
    reference: { area: 0, longitudinal_length: 0, lateral_length: 0 },
    solver: {
      type: "nonlinear",
      convergence: 1e-10,
      relaxation: 0.9,
      max_iterations: 200,
    },
    condition: {
      velocity: 100.0,
      altitude: 0.0,
      alpha: 2.0,
      beta: 0.0,
      elevator: 0.0,
      rudder: 0.0,
      aileron: 0.0,
      flap: 0.0,
    },
    objects: [
      createLight("pointlight", "PointLight", { position: [8, 8, -12], intensity: 0.9 }),
    ],
  };
}

/** Create a default project pre-loaded with a traditional airplane (for examples). */
export function createTraditionalProject() {
  _nextId = 1;
  return {
    aircraftName: "MyAirplane",
    units: "English",
    weight: 100.0,
    cg: [0, 0, 0],
    reference: { area: 0, longitudinal_length: 0, lateral_length: 0 },
    solver: {
      type: "nonlinear",
      convergence: 1e-10,
      relaxation: 0.9,
      max_iterations: 200,
    },
    condition: {
      velocity: 100.0,
      altitude: 0.0,
      alpha: 2.0,
      beta: 0.0,
      elevator: 0.0,
      rudder: 0.0,
      aileron: 0.0,
      flap: 0.0,
    },
    objects: [
      createWing("MainWing", {
        semispan: 4.0,
        rootChord: 1.0,
        tipChord: 1.0,
        controlSurface: {
          enabled: true, rootSpan: 0.5, tipSpan: 0.95, cfRoot: 0.15, cfTip: 0.15,
          isSealed: true, elevatorMix: 0.0, rudderMix: 0.0, aileronMix: 1.0, flapMix: 0.0,
        },
      }),
      createWing("H_Stab", {
        isMain: false,
        position: [-3.0, 0, 0],
        semispan: 1.8,
        rootChord: 0.7,
        tipChord: 0.5,
        rootAirfoil: defaultAirfoil("NACA 0010"),
        tipAirfoil: defaultAirfoil("NACA 0010"),
        controlSurface: {
          enabled: true, rootSpan: 0.0, tipSpan: 1.0, cfRoot: 0.4, cfTip: 0.4,
          isSealed: true, elevatorMix: 1.0, rudderMix: 0.0, aileronMix: 0.0, flapMix: 0.0,
        },
      }),
      createWing("V_Stab", {
        isMain: false,
        side: "left",
        dihedral: 90.0,
        position: [-3.0, 0, -0.1],
        semispan: 1.5,
        rootChord: 0.8,
        tipChord: 0.5,
        rootAirfoil: defaultAirfoil("NACA 0010"),
        tipAirfoil: defaultAirfoil("NACA 0010"),
        controlSurface: {
          enabled: true, rootSpan: 0.0, tipSpan: 1.0, cfRoot: 0.4, cfTip: 0.4,
          isSealed: true, elevatorMix: 0.0, rudderMix: 1.0, aileronMix: 0.0, flapMix: 0.0,
        },
      }),
    ],
  };
}

/** Resolve accumulated position of an object through Group parents up to a Wing or Root. */
function resolveWingConnection(obj, byId) {
  let accPos = [...obj.position];
  let curr = obj;
  const visited = new Set([curr.id]);
  while (curr.connectTo && curr.connectTo !== "MyAirplane") {
    const parent = byId.get(curr.connectTo);
    if (!parent || visited.has(parent.id)) break;
    visited.add(parent.id);
    if (parent.kind === "wing") {
      return {
        parentWingId: parent._mxId,
        location: curr.connectLocation || "root",
        dx: accPos[0],
        dy: accPos[1],
        dz: accPos[2],
      };
    }
    accPos[0] += parent.position[0];
    accPos[1] += parent.position[1];
    accPos[2] += parent.position[2];
    curr = parent;
  }
  return {
    parentWingId: 0,
    location: "root",
    dx: accPos[0],
    dy: accPos[1],
    dz: accPos[2],
  };
}

function sanitizeKey(name) {
  return (name || "wing").replace(/\s+/g, "_");
}

function extractNaca(name) {
  const m = String(name || "").match(/(\d{4,5})/);
  return m ? m[1] : null;
}

/** Export project to MachUpX aircraft.json and scene.json */
export function exportToMachUpX(project) {
  const wings = project.objects.filter((o) => o.kind === "wing" && o.visible !== false);
  const byId = new Map(project.objects.map((o) => [o.id, o]));

  // Assign deterministic positive integer IDs (1..N)
  wings.forEach((w, idx) => {
    w._mxId = idx + 1;
  });

  const airfoils = {};
  const wingsOut = {};
  const usedControls = new Set();

  for (const w of wings) {
    const segKey = sanitizeKey(w.name);
    const rootAfKey = `${segKey}_root_af`;
    const rootNaca = extractNaca(w.rootAirfoil?.name);
    airfoils[rootAfKey] = {
      type: w.rootAirfoil?.type || "linear",
      aL0: Number(w.rootAirfoil?.aL0 ?? 0),
      CLa: Number(w.rootAirfoil?.CLa ?? 6.2832),
      CmL0: Number(w.rootAirfoil?.CmL0 ?? 0),
      Cma: Number(w.rootAirfoil?.Cma ?? 0),
      CD0: Number(w.rootAirfoil?.CD0 ?? 0.006),
      CD1: Number(w.rootAirfoil?.CD1 ?? 0),
      CD2: Number(w.rootAirfoil?.CD2 ?? 0.01),
      CL_max: Number(w.rootAirfoil?.CL_max ?? 1.4),
      ...(rootNaca ? { geometry: { NACA: rootNaca } } : {}),
    };

    const tipAf = w.tipAirfoil || w.rootAirfoil;
    const tipDiffers =
      tipAf &&
      (tipAf.name !== w.rootAirfoil.name ||
        tipAf.aL0 !== w.rootAirfoil.aL0 ||
        tipAf.CLa !== w.rootAirfoil.CLa);
    let airfoilField = rootAfKey;
    if (tipDiffers) {
      const tipAfKey = `${segKey}_tip_af`;
      const tipNaca = extractNaca(tipAf.name);
      airfoils[tipAfKey] = {
        type: tipAf.type || "linear",
        aL0: Number(tipAf.aL0 ?? 0),
        CLa: Number(tipAf.CLa ?? 6.2832),
        CmL0: Number(tipAf.CmL0 ?? 0),
        Cma: Number(tipAf.Cma ?? 0),
        CD0: Number(tipAf.CD0 ?? 0.006),
        CD1: Number(tipAf.CD1 ?? 0),
        CD2: Number(tipAf.CD2 ?? 0.01),
        CL_max: Number(tipAf.CL_max ?? 1.4),
        ...(tipNaca ? { geometry: { NACA: tipNaca } } : {}),
      };
      airfoilField = [
        [0.0, rootAfKey],
        [1.0, tipAfKey],
      ];
    }

    const conn = resolveWingConnection(w, byId);
    const segObj = {
      ID: w._mxId,
      side: w.side || "both",
      is_main: Boolean(w.isMain),
      connect_to: {
        ID: conn.parentWingId,
        location: conn.location,
        dx: Number(conn.dx),
        dy: Number(conn.dy),
        dz: Number(conn.dz),
        y_offset: Number(w.yOffset || 0),
      },
      semispan: Number(w.semispan),
      sweep: Number(w.sweep || 0),
      dihedral: Number(w.dihedral || 0),
      chord:
        Number(w.rootChord) === Number(w.tipChord)
          ? Number(w.rootChord)
          : [
              [0.0, Number(w.rootChord)],
              [1.0, Number(w.tipChord)],
            ],
      twist: [
        [0.0, Number(w.mountAngle || 0)],
        [1.0, Number(w.mountAngle || 0) - Number(w.washout || 0)],
      ],
      airfoil: airfoilField,
      grid: {
        N: Math.max(4, parseInt(w.spanwiseSegments || 40, 10)),
      },
    };

    if (w.controlSurface?.enabled) {
      const mixing = {};
      if (Math.abs(w.controlSurface.elevatorMix) > 1e-9) {
        mixing.elevator = Number(w.controlSurface.elevatorMix);
        usedControls.add("elevator");
      }
      if (Math.abs(w.controlSurface.rudderMix) > 1e-9) {
        mixing.rudder = Number(w.controlSurface.rudderMix);
        usedControls.add("rudder");
      }
      if (Math.abs(w.controlSurface.aileronMix) > 1e-9) {
        mixing.aileron = Number(w.controlSurface.aileronMix);
        usedControls.add("aileron");
      }
      if (Math.abs(w.controlSurface.flapMix) > 1e-9) {
        mixing.flap = Number(w.controlSurface.flapMix);
        usedControls.add("flap");
      }
      if (Object.keys(mixing).length > 0) {
        const cfRoot = Number(w.controlSurface.cfRoot ?? 0.2);
        const cfTip = Number(w.controlSurface.cfTip ?? cfRoot);
        segObj.control_surface = {
          root_span: Number(w.controlSurface.rootSpan ?? 0.2),
          tip_span: Number(w.controlSurface.tipSpan ?? 0.8),
          chord_fraction:
            cfRoot === cfTip
              ? cfRoot
              : [
                  [0.0, cfRoot],
                  [1.0, cfTip],
                ],
          is_sealed: Boolean(w.controlSurface.isSealed ?? true),
          control_mixing: mixing,
        };
      }
    }

    wingsOut[segKey] = segObj;
  }

  const controlsDef = {};
  const controlState = {};
  const symmetryMap = {
    elevator: true,
    flap: true,
    aileron: false,
    rudder: false,
  };
  for (const cname of usedControls) {
    controlsDef[cname] = { is_symmetric: symmetryMap[cname] ?? true };
    controlState[cname] = Number(project.condition[cname] ?? 0);
  }

  const refOut = {};
  if (Number(project.reference?.area) > 0) refOut.area = Number(project.reference.area);
  if (Number(project.reference?.longitudinal_length) > 0)
    refOut.longitudinal_length = Number(project.reference.longitudinal_length);
  if (Number(project.reference?.lateral_length) > 0)
    refOut.lateral_length = Number(project.reference.lateral_length);

  const aircraft = {
    CG: project.cg.map(Number),
    weight: Number(project.weight || 100),
    reference: refOut,
    controls: controlsDef,
    airfoils,
    wings: wingsOut,
  };

  const apName = sanitizeKey(project.aircraftName || "MyAirplane");
  const scene = {
    tag: `${apName} generated by MachUpX Local GUI`,
    solver: {
      type: project.solver?.type || "nonlinear",
      convergence: Number(project.solver?.convergence ?? 1e-10),
      relaxation: Number(project.solver?.relaxation ?? 0.9),
      max_iterations: parseInt(project.solver?.max_iterations ?? 200, 10),
    },
    units: project.units || "English",
    scene: {
      atmosphere: {},
      aircraft: {
        [apName]: {
          file: "aircraft.json",
          state: {
            position: [0, 0, -Number(project.condition?.altitude || 0)],
            velocity: Number(project.condition?.velocity || 100),
            alpha: Number(project.condition?.alpha || 0),
            beta: Number(project.condition?.beta || 0),
          },
          control_state: controlState,
        },
      },
    },
  };

  return { aircraftName: apName, aircraft, scene };
}

/** Import a MachUpX example (scene + aircraft JSON) into our editable project model */
export function importFromMachUpX(aircraftName, sceneJson, aircraftJson) {
  _nextId = 1;
  const scAc = sceneJson.scene?.aircraft?.[aircraftName] || {};
  const state = scAc.state || {};
  const ctrlState = scAc.control_state || {};

  const project = {
    aircraftName,
    units: sceneJson.units || "English",
    weight: aircraftJson.weight ?? 100,
    cg: aircraftJson.CG ? [...aircraftJson.CG] : [0, 0, 0],
    reference: {
      area: aircraftJson.reference?.area ?? 0,
      longitudinal_length: aircraftJson.reference?.longitudinal_length ?? 0,
      lateral_length: aircraftJson.reference?.lateral_length ?? 0,
    },
    solver: {
      type: sceneJson.solver?.type || "nonlinear",
      convergence: sceneJson.solver?.convergence ?? 1e-10,
      relaxation: sceneJson.solver?.relaxation ?? 0.9,
      max_iterations: sceneJson.solver?.max_iterations ?? 200,
    },
    condition: {
      velocity: state.velocity ?? 100,
      altitude: state.position ? -state.position[2] : 0,
      alpha: state.alpha ?? 2.0,
      beta: state.beta ?? 0.0,
      elevator: ctrlState.elevator ?? 0.0,
      rudder: ctrlState.rudder ?? 0.0,
      aileron: ctrlState.aileron ?? 0.0,
      flap: ctrlState.flap ?? 0.0,
    },
    objects: [],
  };

  const idToObjId = new Map();
  const wingEntries = Object.entries(aircraftJson.wings || {});

  // First pass: create objects
  for (const [wName, w] of wingEntries) {
    const afName = typeof w.airfoil === "string" ? w.airfoil : w.airfoil?.[0]?.[1] || "NACA_0010";
    const afDef = aircraftJson.airfoils?.[afName] || {};
    const rootAf = {
      name: afName.replace(/_/g, " "),
      type: afDef.type || "linear",
      aL0: afDef.aL0 ?? 0,
      CLa: afDef.CLa ?? 6.2832,
      CmL0: afDef.CmL0 ?? 0,
      Cma: afDef.Cma ?? 0,
      CD0: afDef.CD0 ?? 0.006,
      CD1: afDef.CD1 ?? 0,
      CD2: afDef.CD2 ?? 0.01,
      CL_max: afDef.CL_max ?? 1.4,
    };

    let rootChord = 1.0;
    let tipChord = 1.0;
    if (typeof w.chord === "number") {
      rootChord = tipChord = w.chord;
    } else if (Array.isArray(w.chord) && w.chord.length >= 2) {
      rootChord = w.chord[0][1];
      tipChord = w.chord[w.chord.length - 1][1];
    }

    let mountAngle = 0;
    let washout = 0;
    if (typeof w.twist === "number") {
      mountAngle = w.twist;
    } else if (Array.isArray(w.twist) && w.twist.length >= 2) {
      mountAngle = w.twist[0][1];
      washout = mountAngle - w.twist[w.twist.length - 1][1];
    }

    const sweepVal = typeof w.sweep === "number" ? w.sweep : Array.isArray(w.sweep) ? w.sweep[w.sweep.length - 1][1] : 0;
    const dihedVal = typeof w.dihedral === "number" ? w.dihedral : Array.isArray(w.dihedral) ? w.dihedral[0][1] : 0;

    const cs = w.control_surface;
    const cf = cs?.chord_fraction;
    const cfRoot = typeof cf === "number" ? cf : Array.isArray(cf) ? cf[0][1] : 0.2;
    const cfTip = typeof cf === "number" ? cf : Array.isArray(cf) ? cf[cf.length - 1][1] : 0.2;

    const obj = createWing(wName, {
      isMain: w.is_main ?? true,
      side: w.side || "both",
      yOffset: w.connect_to?.y_offset ?? 0,
      position: [w.connect_to?.dx ?? 0, w.connect_to?.dy ?? 0, w.connect_to?.dz ?? 0],
      connectLocation: w.connect_to?.location || "root",
      semispan: w.semispan ?? 4.0,
      sweep: sweepVal,
      dihedral: dihedVal,
      rootChord,
      tipChord,
      mountAngle,
      washout,
      rootAirfoil: rootAf,
      tipAirfoil: { ...rootAf },
      spanwiseSegments: w.grid?.N ?? 40,
      controlSurface: cs
        ? {
            enabled: true,
            rootSpan: cs.root_span ?? 0.0,
            tipSpan: cs.tip_span ?? 1.0,
            cfRoot,
            cfTip,
            isSealed: cs.is_sealed ?? true,
            elevatorMix: cs.control_mixing?.elevator ?? 0,
            rudderMix: cs.control_mixing?.rudder ?? 0,
            aileronMix: cs.control_mixing?.aileron ?? 0,
            flapMix: cs.control_mixing?.flap ?? 0,
          }
        : createWing().controlSurface,
    });
    idToObjId.set(w.ID, obj.id);
    obj._origConnectId = w.connect_to?.ID ?? 0;
    project.objects.push(obj);
  }

  // Second pass: resolve connectTo IDs
  for (const obj of project.objects) {
    if (obj._origConnectId && idToObjId.has(obj._origConnectId)) {
      obj.connectTo = idToObjId.get(obj._origConnectId);
    } else {
      obj.connectTo = "MyAirplane";
    }
    delete obj._origConnectId;
  }

  return project;
}

const AUTOSAVE_KEY = "machupx_gui_autosave_v1";

export function saveAutosave(project) {
  try {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(project));
  } catch {
    // ignore quota errors
  }
}

export function loadAutosave() {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
