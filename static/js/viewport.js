import * as THREE from "three";
import { OrbitControls } from "/static/vendor/OrbitControls.js";
import { TransformControls } from "/static/vendor/TransformControls.js";

/**
 * Three.js 3D Viewport for MachUpX Aircraft Designer.
 * Maps MachUpX body-fixed (+X fwd, +Y right, +Z down) to Three.js (+X fwd, +Y up, +Z right)
 * via aircraftGroup.rotation.x = +Math.PI / 2.
 */
export class AircraftViewport {
  constructor(container, callbacks = {}) {
    this.container = container;
    this.callbacks = callbacks; // onSelect(id), onTransformChange(id, pos, rot, scale)

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x999999);

    const w = container.clientWidth || 800;
    const h = container.clientHeight || 600;
    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.05, 500);
    this.camera.position.set(7, 4.5, 7);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    container.appendChild(this.renderer.domElement);

    // Baseline soft Lighting (always present as subtle fill; user lights are added per project)
    this.defaultFillAmbient = new THREE.AmbientLight(0xffffff, 0.35);
    this.scene.add(this.defaultFillAmbient);
    this.defaultDir1 = new THREE.DirectionalLight(0xffffff, 0.5);
    this.defaultDir1.position.set(10, 15, 10);
    this.scene.add(this.defaultDir1);
    this.defaultDir2 = new THREE.DirectionalLight(0xddeeff, 0.25);
    this.defaultDir2.position.set(-10, -8, -10);
    this.scene.add(this.defaultDir2);
    this.userLights = [];

    // Ground Grid
    this.grid = new THREE.GridHelper(20, 20, 0x444444, 0xbbbbbb);
    this.scene.add(this.grid);

    // Root aircraft group: MachUpX body frame -> Three.js Y-up
    this.aircraftGroup = new THREE.Group();
    this.aircraftGroup.rotation.x = Math.PI / 2;
    this.scene.add(this.aircraftGroup);

    // Body-frame axis indicator at origin: Red +X (fwd), Green +Y (right), Blue +Z (down)
    this.axesHelper = new THREE.AxesHelper(1.5);
    this.aircraftGroup.add(this.axesHelper);

    // CG and AC markers (in aircraftGroup = MachUpX body frame)
    this.cgMarker = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xe74c3c })
    );
    this.aircraftGroup.add(this.cgMarker);

    this.acMarker = new THREE.Mesh(
      new THREE.SphereGeometry(0.10, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0x00bcd4 })
    );
    this.acMarker.visible = false;
    this.aircraftGroup.add(this.acMarker);

    // OrbitControls
    this.orbit = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbit.enableDamping = true;
    this.orbit.dampingFactor = 0.08;

    // TransformControls
    this.transform = new TransformControls(this.camera, this.renderer.domElement);
    this.transform.addEventListener("dragging-changed", (e) => {
      this.orbit.enabled = !e.value;
    });
    this.transform.addEventListener("objectChange", () => {
      const obj3d = this.transform.object;
      if (!obj3d || !obj3d.userData?.objId) return;
      if (this.selectionBox) this.selectionBox.update();
      const id = obj3d.userData.objId;
      const pos = [obj3d.position.x, obj3d.position.y, obj3d.position.z];
      const rad2deg = 180 / Math.PI;
      const rot = [obj3d.rotation.x * rad2deg, obj3d.rotation.y * rad2deg, obj3d.rotation.z * rad2deg];
      const scale = [obj3d.scale.x, obj3d.scale.y, obj3d.scale.z];
      this.callbacks.onTransformChange?.(id, pos, rot, scale);
    });
    this.scene.add(this.transform);

    this.selectionBox = null;
    this.objectMeshes = new Map(); // objId -> THREE.Group
    this.raycaster = new THREE.Raycaster();
    this.pointerDownPos = null;

    this.renderer.domElement.addEventListener("pointerdown", (e) => {
      this.pointerDownPos = { x: e.clientX, y: e.clientY };
    });
    this.renderer.domElement.addEventListener("pointerup", (e) => {
      if (!this.pointerDownPos) return;
      const dx = e.clientX - this.pointerDownPos.x;
      const dy = e.clientY - this.pointerDownPos.y;
      if (dx * dx + dy * dy < 16 && !this.transform.dragging) {
        this._handlePick(e);
      }
    });

    window.addEventListener("resize", () => this.resize());
    this._animate();
  }

  resize() {
    const w = this.container.clientWidth || 800;
    const h = this.container.clientHeight || 600;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  _animate() {
    requestAnimationFrame(() => this._animate());
    this.orbit.update();
    this.renderer.render(this.scene, this.camera);
  }

  setGridVisible(visible) {
    this.grid.visible = Boolean(visible);
  }

  setTheme(theme) {
    this.scene.background = new THREE.Color(theme === "dark" ? 0x222222 : 0x999999);
  }

  setMarkerRadii(cgRadius, acRadius) {
    const cgS = (Number(cgRadius) || 0.06) / 0.11;
    const acS = (Number(acRadius) || 0.06) / 0.10;
    this.cgMarker.scale.set(cgS, cgS, cgS);
    this.acMarker.scale.set(acS, acS, acS);
  }

  setSnap(enabled, step) {
    const s = Number(step) || 1.0;
    this.transform.setTranslationSnap(enabled ? s : null);
    this.transform.setRotationSnap(enabled ? THREE.MathUtils.degToRad(15) : null);
    this.transform.setScaleSnap(enabled ? 0.1 : null);
  }

  setTransformMode(mode) {
    this.transform.setMode(mode);
  }

  setCameraPreset(preset) {
    this.orbit.target.set(-1.0, 0, 0);
    if (preset === "top") this.camera.position.set(-1, 12, 0.01);
    else if (preset === "front") this.camera.position.set(11, 0.5, 0);
    else if (preset === "side") this.camera.position.set(-1, 0.5, 11);
    else this.camera.position.set(7, 4.5, 7);
    this.orbit.update();
  }

  setAeroCenter(acPos) {
    if (Array.isArray(acPos) && acPos.length === 3) {
      this.acMarker.position.set(acPos[0], acPos[1], acPos[2]);
      this.acMarker.visible = true;
    } else {
      this.acMarker.visible = false;
    }
  }

  _handlePick(e) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    this.raycaster.setFromCamera(mouse, this.camera);
    const targets = [];
    this.objectMeshes.forEach((grp) => targets.push(grp));
    const hits = this.raycaster.intersectObjects(targets, true);
    if (hits.length > 0) {
      let node = hits[0].object;
      while (node && !node.userData?.objId) node = node.parent;
      if (node?.userData?.objId) {
        this.callbacks.onSelect?.(node.userData.objId);
        return;
      }
    }
    this.callbacks.onSelect?.(null);
  }

  selectObject(objId) {
    if (this.selectionBox) {
      this.scene.remove(this.selectionBox);
      this.selectionBox.dispose();
      this.selectionBox = null;
    }
    const meshGrp = this.objectMeshes.get(objId);
    if (meshGrp) {
      this.transform.attach(meshGrp);
      this.selectionBox = new THREE.BoxHelper(meshGrp, 0xffff00);
      this.scene.add(this.selectionBox);
    } else {
      this.transform.detach();
    }
  }

  /** Rebuild the entire 3D aircraft hierarchy from project state */
  syncProject(project, selectedId) {
    this.transform.detach();
    if (this.selectionBox) {
      this.scene.remove(this.selectionBox);
      this.selectionBox.dispose();
      this.selectionBox = null;
    }

    this.objectMeshes.forEach((grp) => {
      if (grp.parent) grp.parent.remove(grp);
    });
    this.objectMeshes.clear();

    // Remove previous user lights
    for (const l of this.userLights) {
      if (l.parent) l.parent.remove(l);
    }
    this.userLights = [];

    // Update CG & AC marker
    const cg = project.cg || [0, 0, 0];
    this.cgMarker.position.set(cg[0], cg[1], cg[2]);
    this.setMarkerRadii(project.cgRadius, project.acRadius);
    this.setTheme(project.theme || "light");

    const hasUserLight = project.objects.some((o) => o.kind?.endsWith("light") && o.visible !== false);
    this.defaultFillAmbient.intensity = hasUserLight ? 0.3 : 0.65;
    this.defaultDir1.intensity = hasUserLight ? 0.35 : 0.85;
    this.defaultDir2.intensity = hasUserLight ? 0.2 : 0.35;

    const byId = new Map(project.objects.map((o) => [o.id, o]));

    // Create groups for each object first
    for (const obj of project.objects) {
      const grp = new THREE.Group();
      grp.userData.objId = obj.id;
      grp.position.set(obj.position[0], obj.position[1], obj.position[2]);
      const deg2rad = Math.PI / 180;
      grp.rotation.set(obj.rotation[0] * deg2rad, obj.rotation[1] * deg2rad, obj.rotation[2] * deg2rad);
      if (obj.scaleEnabled) {
        grp.scale.set(obj.scale[0], obj.scale[1], obj.scale[2]);
      }
      grp.visible = obj.visible !== false;

      if (obj.kind === "wing") {
        this._buildWingMeshes(grp, obj, project.condition || {});
      } else if (obj.kind === "sphere") {
        const geo = new THREE.SphereGeometry(obj.radius ?? 0.3, obj.widthSegments ?? 32, obj.heightSegments ?? 16);
        grp.add(new THREE.Mesh(geo, this._makeMat(obj.material)));
      } else if (obj.kind === "cylinder") {
        const geo = new THREE.CylinderGeometry(
          obj.radiusTop ?? 0.1,
          obj.radiusBottom ?? 0.05,
          obj.height ?? 3.0,
          obj.radialSegments ?? 24,
          1,
          Boolean(obj.openEnded)
        );
        grp.add(new THREE.Mesh(geo, this._makeMat(obj.material)));
      } else if (obj.kind === "circle") {
        const geo = new THREE.CircleGeometry(obj.radius ?? 0.5, obj.segments ?? 32);
        grp.add(new THREE.Mesh(geo, this._makeMat(obj.material)));
      } else if (obj.kind === "box") {
        const geo = new THREE.BoxGeometry(obj.width ?? 1, obj.height ?? 0.4, obj.depth ?? 0.4);
        grp.add(new THREE.Mesh(geo, this._makeMat(obj.material)));
      } else if (obj.kind === "propeller") {
        this._buildPropellerMeshes(grp, obj);
      } else if (obj.kind?.endsWith("light")) {
        this._buildLightObject(grp, obj);
      }

      this.objectMeshes.set(obj.id, grp);
    }

    // Attach hierarchy (Connect To)
    for (const obj of project.objects) {
      const grp = this.objectMeshes.get(obj.id);
      const parentObj = obj.connectTo && obj.connectTo !== "MyAirplane" ? byId.get(obj.connectTo) : null;
      if (parentObj && this.objectMeshes.has(parentObj.id)) {
        const parentGrp = this.objectMeshes.get(parentObj.id);
        // If connected to wing tip, offset by parent's tip position
        if (parentObj.kind === "wing" && obj.connectLocation === "tip") {
          const tipOff = this._getWingTipOffset(parentObj);
          grp.position.set(
            obj.position[0] + tipOff[0],
            obj.position[1] + tipOff[1],
            obj.position[2] + tipOff[2]
          );
        }
        parentGrp.add(grp);
      } else {
        this.aircraftGroup.add(grp);
      }
    }

    if (selectedId) {
      this.selectObject(selectedId);
    }
  }

  _getWingTipOffset(w) {
    const sign = w.side === "left" ? -1 : 1;
    const sweepRad = (w.sweep || 0) * (Math.PI / 180);
    const dihRad = (w.dihedral || 0) * (Math.PI / 180);
    const b = Number(w.semispan || 4);
    return [
      -b * Math.tan(sweepRad),
      sign * ((w.yOffset || 0) + b * Math.cos(dihRad)),
      -b * Math.sin(dihRad),
    ];
  }

  _makeMat(matCfg = {}) {
    return new THREE.MeshPhongMaterial({
      color: new THREE.Color(matCfg.color || "#d9e2ec"),
      emissive: new THREE.Color(matCfg.emissive || "#000000"),
      shininess: Number(matCfg.shininess ?? 30),
      opacity: Number(matCfg.opacity ?? 1.0),
      transparent: Number(matCfg.opacity ?? 1.0) < 1.0,
      wireframe: Boolean(matCfg.wireframe),
      side: THREE.DoubleSide,
    });
  }

  _buildPropellerMeshes(grp, obj) {
    const mat = this._makeMat(obj.material);
    const hubR = Math.max(0.005, Number(obj.hubRadius ?? 0.04));
    const diam = Math.max(0.05, Number(obj.diameter ?? 0.4));
    const blades = Math.max(2, Math.min(6, parseInt(obj.blades ?? 2, 10)));
    const cRoot = Math.max(0.005, Number(obj.rootChord ?? 0.05));
    const cTip = Math.max(0.005, Number(obj.tipChord ?? 0.025));

    // Spinner cone pointing along +X
    const hubGeo = new THREE.ConeGeometry(hubR, hubR * 2.5, 16);
    hubGeo.rotateZ(-Math.PI / 2);
    grp.add(new THREE.Mesh(hubGeo, mat));

    // Blades in Y-Z plane (perpendicular to +X thrust axis)
    const bladeLen = diam / 2 - hubR;
    for (let i = 0; i < blades; i++) {
      const angle = (i * 2 * Math.PI) / blades;
      const bladeGeo = new THREE.BoxGeometry(0.008, bladeLen, (cRoot + cTip) * 0.5);
      bladeGeo.translate(0, hubR + bladeLen * 0.5, 0);
      const mesh = new THREE.Mesh(bladeGeo, mat);
      mesh.rotation.x = angle;
      grp.add(mesh);
    }
  }

  _buildLightObject(grp, obj) {
    const col = new THREE.Color(obj.color || "#ffffff");
    const intensity = Number(obj.intensity ?? 0.85);
    let light;
    if (obj.kind === "ambientlight") {
      light = new THREE.AmbientLight(col, intensity);
    } else if (obj.kind === "hemispherelight") {
      light = new THREE.HemisphereLight(col, new THREE.Color(obj.groundColor || "#444444"), intensity);
    } else if (obj.kind === "directionallight") {
      light = new THREE.DirectionalLight(col, intensity);
    } else if (obj.kind === "spotlight") {
      light = new THREE.SpotLight(col, intensity);
    } else {
      light = new THREE.PointLight(col, intensity, Number(obj.distance ?? 0));
    }
    grp.add(light);
    this.userLights.push(light);

    // Subtle selectable bulb indicator for positioned lights
    if (obj.kind !== "ambientlight") {
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 8, 8),
        new THREE.MeshBasicMaterial({ color: col, wireframe: true })
      );
      grp.add(bulb);
    }
  }

  _buildWingMeshes(grp, w, condition) {
    const sides = w.side === "both" ? [1, -1] : w.side === "left" ? [-1] : [1];
    const mat = this._makeMat(w.material);
    const csMat = new THREE.MeshPhongMaterial({
      color: 0x2c3e50,
      shininess: 40,
      side: THREE.DoubleSide,
    });

    const b = Math.max(0.01, Number(w.semispan || 4));
    const cRoot = Math.max(0.01, Number(w.rootChord || 1));
    const cTip = Math.max(0.01, Number(w.tipChord || 1));
    const yOff = Number(w.yOffset || 0);
    const sweepRad = Number(w.sweep || 0) * (Math.PI / 180);
    const dihRad = Number(w.dihedral || 0) * (Math.PI / 180);
    const twistRoot = Number(w.mountAngle || 0) * (Math.PI / 180);
    const twistTip = (Number(w.mountAngle || 0) - Number(w.washout || 0)) * (Math.PI / 180);

    for (const sign of sides) {
      const rootQC = new THREE.Vector3(0, sign * yOff, 0);
      const tipQC = new THREE.Vector3(
        -b * Math.tan(sweepRad),
        sign * (yOff + b * Math.cos(dihRad)),
        -b * Math.sin(dihRad)
      );

      // Main wing lofted prism between root & tip
      grp.add(this._makeAirfoilLoft(rootQC, tipQC, cRoot, cTip, twistRoot, twistTip, 0, 1, mat));

      // Control surface mesh if enabled
      if (w.controlSurface?.enabled) {
        const rs = Math.max(0, Math.min(1, Number(w.controlSurface.rootSpan ?? 0.2)));
        const ts = Math.max(rs + 0.01, Math.min(1, Number(w.controlSurface.tipSpan ?? 0.8)));
        const cfR = Math.max(0.05, Math.min(0.8, Number(w.controlSurface.cfRoot ?? 0.2)));
        const cfT = Math.max(0.05, Math.min(0.8, Number(w.controlSurface.cfTip ?? 0.2)));

        // Symmetric (elevator, flap) vs asymmetric (aileron, rudder)
        const deflDeg =
          (condition.elevator || 0) * (w.controlSurface.elevatorMix || 0) +
          (condition.flap || 0) * (w.controlSurface.flapMix || 0) +
          sign * (condition.aileron || 0) * (w.controlSurface.aileronMix || 0) +
          sign * (condition.rudder || 0) * (w.controlSurface.rudderMix || 0);
        const deflRad = deflDeg * (Math.PI / 180);

        const p0 = rootQC.clone().lerp(tipQC, rs);
        const p1 = rootQC.clone().lerp(tipQC, ts);
        const c0 = cRoot + (cTip - cRoot) * rs;
        const c1 = cRoot + (cTip - cRoot) * ts;
        const tw0 = twistRoot + (twistTip - twistRoot) * rs;
        const tw1 = twistRoot + (twistTip - twistRoot) * ts;

        const hingeX0 = (0.25 - (1 - cfR)) * c0;
        const hingeX1 = (0.25 - (1 - cfT)) * c1;
        const flapLen0 = cfR * c0;
        const flapLen1 = cfT * c1;

        const csGeo = this._makeFlapQuad(p0, p1, hingeX0, hingeX1, flapLen0, flapLen1, tw0, tw1, deflRad);
        grp.add(new THREE.Mesh(csGeo, csMat));
      }
    }
  }

  _makeAirfoilLoft(p0, p1, c0, c1, tw0, tw1, _s0, _s1, mat) {
    // 8-point symmetric/cambered airfoil profile around quarter-chord (0.25c LE to -0.75c TE)
    const profilePts = (c, tw) => {
      const t = 0.10 * c;
      const raw = [
        [0.25 * c, 0],
        [0.12 * c, -0.45 * t],
        [-0.15 * c, -0.5 * t],
        [-0.75 * c, 0],
        [-0.15 * c, 0.5 * t],
        [0.12 * c, 0.45 * t],
      ];
      // Positive twist = nose up (+X goes toward -Z in MachUpX body frame)
      const cos = Math.cos(tw), sin = Math.sin(tw);
      return raw.map(([x, z]) => [x * cos + z * sin, -x * sin + z * cos]);
    };

    const rPts = profilePts(c0, tw0);
    const tPts = profilePts(c1, tw1);
    const n = rPts.length;
    const positions = [];

    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const rA = [p0.x + rPts[i][0], p0.y, p0.z + rPts[i][1]];
      const rB = [p0.x + rPts[j][0], p0.y, p0.z + rPts[j][1]];
      const tA = [p1.x + tPts[i][0], p1.y, p1.z + tPts[i][1]];
      const tB = [p1.x + tPts[j][0], p1.y, p1.z + tPts[j][1]];
      positions.push(...rA, ...rB, ...tB, ...rA, ...tB, ...tA);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, mat);
  }

  _makeFlapQuad(p0, p1, hx0, hx1, len0, len1, tw0, tw1, deflRad) {
    const pt = (p, hx, len, tw, isTE) => {
      const totalTw = tw - (isTE ? deflRad : 0);
      const dx = isTE ? hx - len * Math.cos(totalTw) : hx * Math.cos(tw);
      const dz = isTE ? -hx * Math.sin(tw) + len * Math.sin(totalTw) : -hx * Math.sin(tw);
      return [p.x + dx, p.y, p.z + dz];
    };
    const rH = pt(p0, hx0, len0, tw0, false);
    const rT = pt(p0, hx0, len0, tw0, true);
    const tH = pt(p1, hx1, len1, tw1, false);
    const tT = pt(p1, hx1, len1, tw1, true);
    const positions = [...rH, ...rT, ...tT, ...rH, ...tT, ...tH];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.computeVertexNormals();
    return geo;
  }
}
