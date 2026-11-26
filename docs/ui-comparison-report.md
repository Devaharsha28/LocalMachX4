# MachUp 4/5 vs. Local MachUpX GUI — 1:1 Comparison & Work Report

**Date:** 2026-11-26  
**Reference Material Reviewed:** **650 / 650 frames** (`0` pending in `docs/frames_manifest.txt`)  
- `root/` (`MachUp_Conventional_Aircraft_Overview_-_USU_AeroLab__720p__h264__frames/`): **151 frames** (`frame_001 (2).jpg`, `frame_001.jpg`–`frame_150.jpg`) — MachUp 4 (`blucraft.com/mu2/`) Conventional Aircraft Overview  
- `some_frames/`: **499 frames** (`frame_002.jpg`–`frame_500.jpg`) — Mission Specific Aircraft Design Part 3/3 (sizing spreadsheet + MachUp 4/5 UAV build & trim workflow)

---

## 1. Summary of What We Built & Fixed

1. **Real MachUpX v2.7.2 Backend (`server/runner.py`, `server/app.py`)**
   - Installed `MachUpX` v2.7.2 + `airfoil_db` v1.4.3 in `.venv`.
   - Built subprocess-isolated solver runner supporting `solve`, `trim`, `derivatives`, `aero_center`, `distributions`, `full`, and `export_stl`.
   - Fixed MachUpX `WingSegment.__init__` bug where `origin` (`ID == 0`) skipped `_initialize_params()` and lacked `y_offset`, causing `AttributeError: 'WingSegment' object has no attribute 'y_offset'`.
   - Fixed `scene.derivatives()` double-`aircraft` kwarg bug and auto-inferred NACA geometry for STL export.
   - Verified with **6/6 passing integration tests** (`tests/test_backend.py`).

2. **Three.js 3D Viewport (`static/js/viewport.js`)**
   - Verified MachUpX body-frame axis convention (`+X` forward, `+Y` right, `+Z` down) via `aircraftGroup.rotation.x = Math.PI / 2`.
   - Live 3D lofted wings, control surface deflection animations, CG & Aerodynamic Center markers (with editable radii), transform gizmos (`Move [T]`, `Rotate [R]`, `Scale [S]`), grid/snap toggles, camera presets (`Iso`, `Top`, `Front`, `Side`), Light/Dark theme viewport backgrounds, and raycast pick/deselect.
   - Added 3D builders for `Box`, `Circle`, `Cylinder`, `Sphere`, `Propeller` (spinner + blades), and all 5 Three.js light types (`PointLight`, `SpotLight`, `DirectionalLight`, `HemisphereLight`, `AmbientLight`).

3. **MachUp 4/5 UI & Workflow (`static/index.html`, `static/css/style.css`, `static/js/model.js`, `static/js/app.js`, `static/js/plots.js`)**
   - Fixed `File -> New` to open a **blank scene** (`MyAirplane`, `Center of Gravity`, `Aerodynamic Center`, `PointLight`) instead of pre-loading an airplane.
   - Fixed the **color picker clipping** off the right edge of the display by replacing native `<input type="color">` with a viewport-clamped popover anchored to the left of the sidebar (with 18 preset swatches + R/G/B sliders + hex input).
   - Added `Group` nesting (`Connect To` parent selector accumulating offsets), `Tutorials` menu, `View -> Light/Dark Theme`, and auto-hiding `OBJECT` / `GEOMETRY` / `MATERIAL` panels when nothing is selected.

---

## 2. 1:1 Parity Audit Against All 650 Reference Frames

### A. Exact 1:1 Matches
| Area | Reference Frames (`root/` & `some_frames/`) | Our Implementation | Status |
|---|---|---|---|
| **Top Menu Bar** | `MachUp`, `File`, `Edit`, `Add`, `View`, `Help`, `Tutorials` + right `Autosave` | Same 7 menus + status badge + `Autosave` checkbox | **1:1** |
| **Add Menu** | `Group`, `Wing`, `Propeller`, `Box`, `Circle`, `Cylinder`, `Sphere`, `PointLight`, `SpotLight`, `DirectionalLight`, `HemisphereLight`, `AmbientLight` | Exact same 12 items in the same order & grouping | **1:1** |
| **File -> New** | Blank viewport with grid, CG dot, `PointLight` in tree | `createDefaultProject()` creates blank scene with `PointLight` | **1:1** |
| **Component Tree** | `MyAirplane`, `Center of Gravity`, `Aerodynamic Center`, `PointLight`, nested `Group`/wings | Exact same tree root items + hierarchical nesting | **1:1** |
| **Sidebar Visibility** | Only `COMPONENT TREE`, `CONDITION`, `ANALYSIS` when nothing is selected; `OBJECT`/`GEOMETRY`/`MATERIAL` appear on selection | `updatePanelVisibility()` hides/shows panels identically | **1:1** |
| **Wing GEOMETRY** | `Main Wing`, `Side` (Both/Right/Left), `y-Offset`, `Semispan`, `Mount Angle`, `Washout`, `Sweep`, `Dihedral`, `Root/Tip Chord`, `Root/Tip Airfoil`, `Spanwise Segments`, `Control Surface` (`Root/Span`, `Tip/Span`, `C_f`, `Elevator/Rudder/Aileron/Flap Mix`) | All fields present and wired to MachUpX | **1:1** |
| **Bottom Viewport Bar** | `Grid` checkbox, `Snap` checkbox + numeric step (`1.0000`) | Present on bottom-left + Gizmo mode buttons (`T/R/S`) on bottom-right | **1:1** |
| **View Themes** | `Light Theme` & `Dark Theme` (`some_frames/frame_120+`, `root/frame_142`) | `View -> Light Theme` / `Dark Theme` updates CSS + 3D background | **1:1** |
| **CG / AC Inspection** | Selecting CG/AC shows `Position` and `Radius` (`some_frames/frame_327-350`) | Selecting `Center of Gravity` / `Aerodynamic Center` edits `Position` & `Radius` | **1:1** |

### B. Where We Have **More** Than MachUp 4/5
1. **Detailed Results Drawer & SVG Spanwise Plots** (`static/js/plots.js`): Interactive multi-tab drawer (`Forces & Moments`, `Derivatives`, `Spanwise Distributions`, `Raw JSON`) with live SVG spanwise lift/drag/moment plots.
2. **`Full Analysis (All)` Mode**: Runs forces, distributions, derivatives, aerodynamic center, and pitch trim in one click.
3. **One-click MachUpX Examples & JSON/STL Export**: `Load Example: Traditional` / `Flying Wing`, `Export MachUpX JSONs`, and `Export STL (via MachUpX)`.
4. **Viewport-Safe Color Popover**: Custom swatch + RGB popover that opens left into the viewport and never clips off-screen.
5. **Axis Convention HUD & Keyboard Shortcuts**: Live body-frame axis legend (`+X Red / +Y Green / +Z Blue`) and `T/R/S/Ctrl+D/Del` shortcuts.

### C. Where We Have **Less** Than MachUp 4/5 (Remaining Differences)
Looked up directly from `some_frames/frame_216.jpg` and `root/frame_102-150`:
1. **`ANALYSIS -> Run` Dropdown Modes**:
   - Reference shows 7 modes: `Forces and Moments`, `Performance Derivatives`, `Aerodynamic Center`, **`Stall Onset`**, **`Target CL`**, `Pitch Trim`, `Distributions`.
   - We currently implement 6 modes (`Full Analysis`, `Forces and Moments`, `Pitch Trim`, `Performance Derivatives`, `Aerodynamic Center`, `Spanwise Distributions`). **`Stall Onset`** and standalone **`Target CL`** are not yet exposed in the `Run` dropdown.
2. **`OBJECT -> Scale [X, Y, Z]` Inputs**:
   - Reference (`root/frame_102-110`, `some_frames/frame_085+`) allows typing `Scale` `[X, Y, Z]` directly in the `OBJECT` panel (used heavily to stretch a `Sphere` into a `Fuselage`, e.g., `Scale X = 5.0`). Currently `Scale` is available via the 3D gizmo (`S`), not as numeric inputs in `OBJECT`.
3. **Native macOS/OS Color Picker vs. Custom Popover**:
   - Reference uses the OS color picker; we intentionally use an in-page left-anchored popover so it never clips off the right edge of the browser window.
4. **Loading Overlay (`"Just a sec..."`)**:
   - Reference shows a centered modal `"Just a sec..."` overlay during solver runs; we show status in the top-right badge (`Running MachUpX...`).
5. **Propeller Aerodynamics**:
   - Just like MachUp 4/5's basic lifting-line mode, `Propeller` in our UI is visual/geometric (MachUpX lifting-line solves lifting wing segments).

---

## 3. Verification Status
- **Frames Manifest (`docs/frames_manifest.txt`)**: `viewed=650`, `pending=0`, `total=650`.
- **Backend Tests (`tests/test_backend.py`)**: `6/6 passed`.
- **Live Server**: Running at `http://127.0.0.1:8000` (all static assets & `/api/health` verified `200 OK`).
