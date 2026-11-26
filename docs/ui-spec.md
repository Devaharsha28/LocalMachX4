# MachUp-Style UI Specification

Derived from analyzing all 150 reference frames (`frame_001.jpg`–`frame_150.jpg`) of the MachUp Conventional Aircraft Overview video, paired with MachUpX v2.7.2 capabilities.

---

## 1. Overall Window Layout & Theme

- **Theme**: Classic light-gray Three.js Editor-inspired UI:
  - Top menu bar & bottom bar: `#EEEEEE` / `#F0F0F0` with `1px solid #CCCCCC` borders.
  - Right sidebar (~260px–300px wide, scrollable): `#EEEEEE` background, `1px solid #CCCCCC` left border.
  - Section headers: Collapsible accordion headers (`▾` / `▸`) in uppercase medium-gray (`#555555`), `11px`, bold.
  - Interactive numbers: Rendered in bright blue (`#0088FF`) with tabular numerals, editable on click/drag (4 decimal places `0.0000` by default).
  - Checked checkboxes: Blue accent (`#0088FF`).
- **Layout Regions**:
  1. **Top Menu Bar**:
     - Left-aligned menus: `MachUp`, `File`, `Edit`, `Add`, `View`, `Help`.
     - Right-aligned toggle: `Autosave` checkbox (checked by default) + solver status indicator.
  2. **3D Viewport** (flex-grow center/left):
     - Solid neutral gray background (`#999999`).
     - Ground grid plane (`Grid` toggle, finite grid with minor light-gray lines and darker major origin cross-axes).
     - Red sphere marker for `Center of Gravity`, cyan/blue sphere marker for `Aerodynamic Center` (updated after solver runs).
     - Three.js `OrbitControls` + `TransformControls` (RGB 3-axis translation/rotation/scale gizmo with planar drag handles and yellow hover highlight).
     - Thin yellow wireframe bounding box around selected object.
     - Live 3D control surface deflection meshes when `Condition` deflections change.
  3. **Bottom Viewport Bar**:
     - `Grid` checkbox (checked by default).
     - `Snap` checkbox (unchecked by default) + numeric snap step `1.0000`.
     - Keyboard shortcut hints / mode toggle (`T` Translate, `R` Rotate, `S` Scale, `Del` Delete).
  4. **Right Sidebar** (scrollable inspector with collapsible sections):
     - `COMPONENT TREE`
     - `OBJECT`
     - `GEOMETRY`
     - `MATERIAL`
     - `CONDITION`
     - `ANALYSIS`
  5. **Results Drawer / Modal / Tabbed View** (for MachUpX outputs beyond the sidebar summary):
     - Forces & Moments (dimensional + non-dimensional, body/stability/wind frames)
     - Pitch Trim results (trim alpha, trim elevator, residuals)
     - Aerodynamic Derivatives (stability, damping, control, `%_static_margin`)
     - Spanwise Distributions plots (`c_l`, `C_L`, `C_Di`, `Gamma`, `alpha`, `chord` vs span fraction)
     - Aerodynamic Center (`[x, y, z]`, `Cm_ac`)

---

## 2. Top Menu Bar Items

- **MachUp**: About MachUpX Local GUI, MachUpX v2.7.2 info, Axis Convention reference.
- **File**:
  - `New` (clears scene to default empty airplane)
  - `Open...` (loads `.json` project file)
  - `Save As...` (downloads `.json` project file)
  - ---
  - `Load Example` -> `Traditional Airplane`, `Flying Wing`
  - `Export MachUpX JSON...` (exports `aircraft.json` + `scene.json`)
  - ---
  - `Export STL` (calls MachUpX `export_stl` on current aircraft)
- **Edit**:
  - `Duplicate Selected`
  - `Delete Selected`
  - `Aircraft Settings...` (CG, Weight, Units: `English`/`SI`, Reference Area/Lengths, Solver: `nonlinear`/`linear`/`scipy_fsolve`, Convergence, Relaxation, Max Iterations)
- **Add**:
  - `Group`
  - ---
  - `Wing`
  - ---
  - `Box` (cosmetic/fuselage primitive)
  - `Cylinder` (cosmetic/fuselage/tailboom primitive)
  - `Sphere` (cosmetic/fuselage primitive)
- **View**:
  - `Reset Camera`
  - `Top / Front / Side / Iso` presets
  - `Toggle Grid`
  - `Toggle Results Drawer`
- **Help**:
  - `Axis Conventions`
  - `Keyboard Shortcuts`

---

## 3. Right Sidebar Panels

### A. `COMPONENT TREE`
- Scrollable white-bordered list box showing hierarchy:
  - `MyAirplane` (root, gray square)
  - `Center of Gravity` (purple square)
  - `Aerodynamic Center` (cyan square)
  - Wing segments & Groups (indented when `Connect To` is another wing or group; trailing orange square indicator for active lifting segments).
- Clicking any item selects it in the 3D viewport and populates `OBJECT`, `GEOMETRY`, `MATERIAL`.

### B. `OBJECT`
- `Name`: text input
- `Connect To`: `<select>` dropdown (`MyAirplane`, any `Group`, or any `Wing` — sets `connect_to.ID` and `location: "root"|"tip"` when connected to a wing)
- `Connect Location` (shown when `Connect To` is a Wing): `root` / `tip`
- `Position`: 3 numeric inputs `X`, `Y`, `Z` (`0.0000`, MachUpX body-fixed `dx, dy, dz`)
- `Rotation`: 3 numeric inputs `Rx`, `Ry`, `Rz` (degrees, used for cosmetic primitives/groups)
- `Scale`: checkbox + 3 numeric inputs `Sx`, `Sy`, `Sz` (`1.0000`, used for cosmetic primitives)
- `Visible`: checkbox (checked by default)

### C. `GEOMETRY`
- **When a Wing is selected**:
  - `Main Wing`: checkbox (`is_main`)
  - `Side`: `<select>` (`Both`, `Right`, `Left`)
  - `y-Offset`: number (`0.0000`)
  - `Semispan`: number (`4.0000`)
  - `Mount Angle (deg)`: number (`0.0000`)
  - `Washout (deg)`: number (`0.0000`) -> maps to MachUpX `twist: [[0, mount], [1, mount - washout]]`
  - `Sweep (deg)`: number (`0.0000`)
  - `Dihedral (deg)`: number (`0.0000`)
  - `Root Chord`: number (`1.0000`)
  - `Tip Chord`: number (`1.0000`)
  - `Root Airfoil` (collapsible sub-section):
    - `Airfoil (graphics & NACA)`: text input (e.g. `NACA 2410` or `NACA 0010`)
    - `Type`: `linear` (or `database` / `poly_fit` if configured)
    - `Zero-Lift Alpha (rad)` (`aL0`)
    - `Lift Slope (1/rad)` (`CLa`)
    - `Zero-Lift Cm` (`CmL0`)
    - `Moment Slope (1/rad)` (`Cma`)
    - `Parasitic CD` (`CD0`)
    - `CD1` (`CD1`), `CD2` (`CD2`)
    - `Max Lift Coefficient` (`CL_max`)
  - `Tip Airfoil` (collapsible sub-section): same fields (optional override; if same as root, shares airfoil)
  - `Spanwise Segments` (`grid.N`): integer (`40`)
  - `Control Surface` (collapsible sub-section):
    - `Has control surface`: checkbox
    - `Root/Span`: number (`0.2000`)
    - `Tip/Span`: number (`0.8000`)
    - `C_f (root)`: number (`0.2000`)
    - `C_f (tip)`: number (`0.2000`)
    - `Sealed`: checkbox (`is_sealed`)
    - `Elevator Mix`: number (`1.0000`)
    - `Rudder Mix`: number (`0.0000`)
    - `Aileron Mix`: number (`0.0000`)
    - `Flap Mix`: number (`0.0000`)
- **When Sphere / Cylinder / Box is selected** (cosmetic geometry, not exported as lifting wings):
  - Sphere: `Radius`, `Width segments`, `Height segments`
  - Cylinder: `Radius top`, `Radius bottom`, `Height`, `Radial segments`, `Open ended`
  - Box: `Width`, `Height`, `Depth`

### D. `MATERIAL` (collapsed by default)
- `Color`: color picker input
- `Emissive`: color picker input
- `Shininess`: number (`30.0000`)
- `Opacity`: number (`1.0000`)
- `Wireframe`: checkbox

### E. `CONDITION`
- `Velocity`: number (`100.0000`)
- `Altitude` (`-pos[2]`): number (`0.0000`)
- `Alpha (deg)`: number (`2.0000`)
- `Beta (deg)`: number (`0.0000`)
- `Elevator (deg)`: number (`0.0000`)
- `Rudder (deg)`: number (`0.0000`)
- `Aileron (deg)`: number (`0.0000`)
- `Flap (deg)`: number (`0.0000`)

### F. `ANALYSIS`
- `Run`: dropdown (`Forces and Moments`, `Pitch Trim`, `Aerodynamic Derivatives`, `Spanwise Distributions`, `Full Analysis (All)`)
- Buttons: `Update Results` (runs real MachUpX backend), `Save Results` (downloads JSON)
- Reference geometry readouts (populated from MachUpX `get_aircraft_reference_geometry`):
  - `Reference Area`
  - `Longitudinal Length`
  - `Lateral Length`
- Aerodynamic coefficient readouts:
  - `CL =`, `CD =`, `CY =` (or `CS =`)
  - `Cl =`, `Cm =`, `Cn =`
  - `Static Margin (%) =` (when derivatives run)
  - `Trim Alpha / Elevator` (when pitch trim runs)
  - Button `Open Detailed Results & Plots` -> opens the bottom/overlay Results Drawer with full tables & spanwise distribution SVG plots.

---
# some_frames/ Video: "Mission Specific Aircraft Design — Part 3/3"
## Batch SF-1: some_frames/frame_002.jpg – some_frames/frame_025.jpg

### Critical finding: This is a DIFFERENT VIDEO from the root frames
- **some_frames/frame_002.jpg**: Title card "Mission Specific Aircraft Design / Part 3/3" (gray gradient, no UI). Confirms some_frames/ is from a different video series than root frames ("Conventional Aircraft Overview").
- **some_frames/frame_003.jpg–frame_013.jpg**: Google Sheets "General Sizing Blank Short Course" sizing spreadsheet (NOT MachUp UI). Three tabs: "Edit", "Values for MachUp", "Calculation (Don't Edit)". Key design values exported to MachUp: Main Wing Semispan 0.735 m, Root Chord 0.181 m, Tip Chord 0.145 m, Taper 0.8, AR 9; H-Stab Lever Arm 0.7 m; V-Stab Semispan 0.17 m; Max Lift Coefficient 1.4; design airspeed 16 m/s. Spreadsheet results: CL 0.46, CD 0.0299, L/D 15.37, Estimated Flight Time 54.5 min. Frames 003-005 identical, 006-007 slight scroll/selection differences, 008 scrolled further down (shows Propulsion: Total Capacity Used 90%, Overall Efficiency 40%, Cruise Current Draw 4.05 A), 009-010 back to top, 011 cursor moved to toolbar, 012-013 same view.
- **some_frames/frame_014.jpg**: MachUp web app — empty scene. Top menu bar (7 items): MachUp | File | Edit | Add | View | Help | **Tutorials** (NOTE: "Tutorials" is an additional menu item not seen in root frames). Right sidebar: COMPONENT TREE only (shows: MyAirplane, Center of Gravity, Aerodynamic Center, PointLight). ANALYSIS panel visible but collapsed (no wing = no OBJECT/GEOMETRY/MATERIAL/CONDITION panels). Bottom status bar: ☑ Grid  ☐ Snap  1.0000. CG red dot visible at origin in viewport. Viewport background: dark gray.
- **some_frames/frame_015.jpg**: Same as frame_014. Tooltip "MachUp" appears near cursor hovering over viewport center.
- **some_frames/frame_016.jpg–frame_025.jpg**: Same as frame_014. Cursor moved slightly each frame. All identical empty scene with grid visible and CG red dot at origin. Near-identical consecutive frames noted: 016-025 same as previous.


---
## Batch SF-2–SF-6: some_frames/frame_027.jpg – some_frames/frame_500.jpg (Workflow Results)

### SF-2: frame_027–frame_126
Across frames 027 to 126, the tutorial demonstrates building a conventional T-tail search-and-rescue UAV in MachUp using dimensions from a Google Sheets sizing workbook, a HobbyKing battery spec sheet, and a Google Docs mission profile. Starting from an empty workspace, the user disables the 3D grid, resizes the Center of Gravity and Aerodynamic Center markers, and uses the Add -> Wing menu to create and configure the main wing ('Main'), horizontal stabilizer ('H-Stab'), and vertical stabilizer ('V-Stab') with exact semispan, chord, sweep, dihedral, and position values. The user then expands Root Airfoil and Tip Airfoil sections to input aerodynamic parameters (NACA 0006 for V-Stab and NACA 4412 for Main), applies dark blue colors via the macOS crayon color picker, and enables Control Surface sections to configure chord fractions (C_f) and control mixes (Elevator Mix and Rudder Mix). Finally, the user opens the Add menu to insert geometric primitives—two Box components sized and positioned as 'Battery' and 'Payload', a scaled Sphere renamed 'Fuselage', and a Cylinder renamed 'Boom' parented to 'Fuselage' via the Connect To hierarchy dropdown—while briefly displaying the View menu's Light/Dark theme options.

### SF-3: frame_127–frame_226
Across frames 127–226, the tutorial finishes assembling and styling the conventional aircraft model in MachUp, adjusts main wing aerodynamics/geometry, and runs aerodynamic analysis before switching to a sizing spreadsheet. Key UI interactions include: editing cylinder/ellipsoid geometry and rotation for the Boom and Fuselage; recoloring components via the macOS Colors crayon picker (changing Fuselage/Boom to Tangerine and later Main Prop to Licorice); toggling Fuselage visibility to inspect and translate internal Box components (Payload and Battery) using the 3D axis gizmo; adding a Propeller via the top Add menu, renaming it to Main Prop, and tuning its diameter, pitch, hub radius, root/tip chords, and nose position; selecting the Main wing in the 3D viewport and entering 2 degrees of Washout and 4 degrees of Dihedral; and expanding the right-hand ANALYSIS panel to inspect Forces and Moments coefficients (CL, CD, CY, Cl, Cm, Cn) and switch the Run mode dropdown to Pitch Trim (computing alpha = -6.09 deg, elevator = 7.97 deg for Target CL = 0) before referencing a Google Sheets sizing workbook for target CL = 0.46.

### SF-4: frame_227–frame_326
This sequence begins with the presenter referencing a target cruise Lift Coefficient of 0.46 from a Google Sheets aircraft sizing spreadsheet before switching to MachUp to perform Pitch Trim and Aerodynamic Center analyses. In MachUp's ANALYSIS panel, the user enters Target CL = 0.46 under the Pitch Trim run mode and clicks Update Results (triggering the 'Just a sec...' loading overlay), which computes a trimmed alpha of 3.45 deg and elevator deflection of -6.96 deg. Next, the user scrolls to the Component Tree, clicks the Main Wing in the 3D viewport (activating its RGB transform gizmo and yellow selection outline), and inspects its Geometry panel, changing Mount Angle (deg) from 0.0000 to 3.5 so the wing sits near zero angle of attack in cruise. Re-running Pitch Trim updates the trimmed condition to alpha = -0.08 deg and elevator = -0.04 deg. Finally, the user clicks the viewport to deselect components, opens the Run analysis dropdown menu (showing Forces and Moments, Performance Derivatives, Aerodynamic Center, Stall Onset, Target CL, Pitch Trim, and Distributions), selects Aerodynamic Center, and runs Update Results, which displays updated coordinates (x = -0.0376, z = -0.0192, Cm(ac) = 0.1222) and renders a purple aerodynamic center marker on the 3D aircraft model.

### SF-5: frame_327–frame_426
Across frames 327–426, the tutorial demonstrates inspecting and adjusting the Center of Gravity visual marker and running multiple aerodynamic analyses in MachUp before feeding the computed zero-lift drag coefficient back into an external sizing spreadsheet. In MachUp, the user scrolls the Component Tree to select the Center of Gravity object, views its Geometry/Material properties, increases its Radius from 0.0300 to 0.04, and zooms in on the fuselage to inspect the purple Aerodynamic Center and enlarged red Center of Gravity spheres. Next, using the Analysis panel's Run dropdown, the user executes Performance Derivatives (obtaining Static Margin = 0.2769 and stability derivatives), switches to Pitch Trim with Target CL set to 0 and Target Cm = 0.0000 (which automatically updates Condition Alpha to -6.1931 deg and Elevator to 7.9727 deg), and then runs Forces and Moments at that zero-lift condition to find CD = 0.0095. Finally, the user switches to the Google Sheets 'General Sizing Blank Short Course' workbook and updates the Zero Lift Drag Coeff. cell from 0.021 to .0095, improving the estimated L/D from 15.37 to 25.13, flight time from 54.5 to 79.9 min, and range from 52.4 to 76.7 km.

### SF-6: frame_427–frame_500
Frames 427–500 capture the conclusion of the MachUp Conventional Aircraft Overview tutorial, alternating between an external Google Sheets sizing calculator ('General Sizing Blank Short Course') and the MachUp desktop UI before ending on a BLUCRAFT outro card. In the spreadsheet (frames 427–451, 464–468), the presenter reviews aircraft sizing parameters—Payload, Aircraft CD0/Oswald efficiency, Main Wing, Horizontal/Vertical Stabilizers, Propulsion/Batteries, and performance Results (L/D 25.13, Flight Time 79.9 min, Range 76.7 km)—comparing them against MachUp values. In MachUp (frames 452–463, 469–497), the 3D viewport displays the completed conventional T-tail aircraft with a tractor propeller, orange fuselage, and blue lifting surfaces, while the right-hand ANALYSIS sidebar displays the trimmed Forces and Moments state under Condition (Alpha -6.1931 deg, Beta 0.0000 deg, Elevator 7.9727 deg; Reference Area 0.2795, Longitudinal Length 0.1393, Lateral Length 2.0060; CL 0.0000, CD 0.0095, Cm -0.0000) with Update Results and Save Results buttons and an Autosave toggle enabled in the top-right. The only interactive viewport manipulation in MachUp occurs in frames 485–487, where the user clicks and drags to orbit the 3D camera briefly to a head-on front view before returning to the front-right 3/4 view, followed by a fade-out to the BLUCRAFT outro in frames 498–500.

---
## Root Frames Revisited: frame_001 – frame_150 + duplicate (Workflow Results)

### R-1: frame_001(2)–frame_050
The 51 frames document the beginning of a MachUp web app (blucraft.com/mu2/) tutorial on building a conventional aircraft from scratch. Starting from the default flying wing scene, the user selects File > New to clear the workspace, adds a wing group (Wing_1 with child Wing_2), and configures Wing_1 as the inboard main wing section (Semispan 3, Root Chord 0.9, Tip Chord 0.8) with full-span flaps (Root/Span 0.15, Tip/Span 1, C_f 0.3, Flap Mix 1). The user then configures Wing_2 as tapered, dihedraled, washed-out outboard panels (Semispan 2, Root Chord 0.8, Tip Chord 0.5, Dihedral 4 deg, Washout 2 deg) with outboard ailerons (Root/Span 0.2, Tip/Span 1, Aileron Mix 1), testing flap (15 and 45 deg) and aileron (15 deg) deflections via the CONDITION panel. Finally, the user duplicates Wing_1 via Edit > Duplicate Selected, renames it H-Stab, attaches it to MyAirplane at x = -3.3119, sizes and sweeps it (Semispan 1.4, Root Chord 0.6, Tip Chord 0.4, Sweep 5 deg), and begins configuring its full-span elevator control surface.

### R-2: frame_051–frame_101
Frames 051–101 demonstrate building and configuring the vertical stabilizer (V-Stab), grouping the empennage, testing control surface deflections, adjusting viewport display, and adding primitive geometry in MachUp. The user adds a new wing (`Wing_4`), renames it `V-Stab`, tests parent connections via the `Connect To` dropdown (`MyAirplane`, `H-Stab`, then a newly created `Group 5` renamed `Tail` that nests both `H-Stab` and `V-Stab`), and positions the `Tail` group aft along the fuselage axis. The `V-Stab` is configured with `Side: Right`, `Dihedral: 90`, `NACA 0012` root/tip airfoils, tapered chord (`0.7` root, `0.4` tip), `Semispan: 1`, `Sweep: 20`, and a rudder control surface (`Root/Span: 0.05`, `Tip/Span: 1`, `C_f: 0.3`, `Elevator Mix: 0`, `Rudder Mix: 1`). Setting `Rudder (deg)` to `15` in the `CONDITION` panel visibly deflects the rudder alongside the previously set elevator (`14`), aileron (`15`), and flap (`45`) deflections. Finally, the user toggles off the bottom-left `Grid` checkbox, orbits the 3D viewport around the aircraft, and uses `Add -> Sphere` to insert `Sphere 6` at the origin with editable transform and spherical geometry parameters.

### R-3: frame_102–frame_150
This sequence of frames demonstrates building the fuselage and tail boom, adjusting flight/control-surface conditions, and customizing component materials in the MachUp web UI. First, the user scales Sphere 6 along X (Scale 5.0) and reduces its GEOMETRY Radius (to 0.3) to form a streamlined fuselage around the wing root. Next, via Add -> Cylinder, the user creates Cylinder 7, experiments with Radial segments (8, 32, 3, 4, back to 32), rotates it 90 degrees around Z, sets Radius top/bottom to 0.05, and positions it at (-2.7245, 0, 0.1335) as a tail boom connecting the fuselage to the Tail group (at X = -4.2887). The user then inspects the expanded ANALYSIS panel (Run: Forces and Moments with Update Results / Save Results buttons and aerodynamic coefficient readouts), resets Flap, Rudder, and Aileron deflections in CONDITION from 45/15/15 deg to 0 deg and sets Elevator to -10 deg, and finally opens the MATERIAL panel and OS color picker to assign distinct colors to Sphere 6 and Cylinder 7 (Tangerine), H-Stab (Aqua), V-Stab (Blueberry), and Wing_1/Wing_2 (Spring green).

---
## Key UI Features Discovered Across All 650 Frames

### Menu Structure
- **7 top-level menus**: MachUp, File, Edit, Add, View, Help, Tutorials
- **Add menu items**: Wing, Sphere, Cylinder, Box (primitives for fuselage/payload), Propeller
- **View menu**: Light/Dark theme toggle
- **File menu**: New, Open, Save, Export
- **Edit menu**: Duplicate Selected

### Analysis Panel (ANALYSIS)
- **Run modes dropdown**: Forces and Moments, Performance Derivatives, Aerodynamic Center, Stall Onset, Target CL, Pitch Trim, Distributions
- **Buttons**: Update Results, Save Results
- **Autosave toggle** in top-right
- **Loading overlay**: "Just a sec..." during computation
- **Results display**: CL, CD, CY, Cl, Cm, Cn coefficients; trimmed alpha/elevator; static margin; AC coordinates

### Component Tree
- Default items: MyAirplane, Center of Gravity, Aerodynamic Center, PointLight
- Hierarchical nesting: wings can be children of groups, groups of groups
- **Connect To** dropdown for reparenting
- Side panel shows: OBJECT, GEOMETRY, MATERIAL, CONDITION (only when object selected)

### Wing Configuration
- Semispan, Root/Tip Chord, Sweep, Dihedral, Washout, Mount Angle
- Root/Tip Airfoil sections (NACA code entry)
- Control Surface: Root/Span, Tip/Span, C_f (chord fraction), Flap/Aileron/Elevator/Rudder Mix
- CONDITION panel: deflection angles for each control surface

### Geometric Primitives
- Sphere (fuselage), Cylinder (boom/nacelle), Box (battery/payload)
- Scale X/Y/Z, Position, Rotation, Radius, Segments
- Visibility toggle per component

### Workflow Pattern
1. Size aircraft in external spreadsheet
2. Enter geometry in MachUp
3. Run Pitch Trim → check trimmed alpha/elevator
4. Set Mount Angle to cruise alpha
5. Re-run Pitch Trim → verify near-zero trim
6. Run Aerodynamic Center → check static margin
7. Run Forces and Moments at zero-lift → get CD0
8. Feed CD0 back to spreadsheet → iterate
