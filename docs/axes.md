# MachUpX Coordinate & Axis Conventions

Verified empirically against MachUpX v2.7.2 (`Traditional` and `FlyingWing` examples) via `distributions()` control point coordinates and `export_stl()` bounding boxes.

## 1. Body-Fixed Frame (Aircraft Geometry)

MachUpX uses the standard aerospace body-fixed coordinate system:

| Axis | Positive Direction | Negative Direction |
|------|--------------------|--------------------|
| **+X** | Forward (towards nose) | Aft (towards tail) |
| **+Y** | Starboard (right wing) | Port (left wing) |
| **+Z** | Downward (ventral) | Upward (dorsal) |

### Empirical Evidence (`Traditional` example)
- `main_wing`: chord = 1.0, quarter-chord at `[0, 0, 0]`, semispan = 4.0 (`side: "both"`).
  - STL X span: `+0.2501` (LE) to `-0.75` (TE).
  - STL Y span: `-4.0000` (port tip) to `+4.0000` (starboard tip).
- `h_stab`: `connect_to: {ID: 1, location: "root", dx: -3.0}`.
  - STL X span extends to `-3.7500` (TE of h_stab at `x = -3.0 - 0.75 = -3.75`), confirming **-X is aft**.
- `v_stab`: `side: "left"`, `dihedral: 90.0`, `semispan: 2.0`, `connect_to: {ID: 1, location: "root", dx: -3.0, dz: -0.1}`.
  - STL Z span: `-2.1000` to `+0.0500`, confirming **-Z is up** (`dz = -0.1` shifts root up 0.1, and 2.0 semispan at 90° dihedral on left side extends up to `z = -2.1`).

## 2. Earth-Fixed Frame

- **+Z is down** (altitude is `-z`). Confirmed in `machupX/scene.py` where standard atmosphere density is queried with `-pos[2]`.
- `position` in scene aircraft `state` is `[x, y, z]` in Earth-fixed coordinates.

## 3. Mapping to Three.js Viewport (Y-Up)

Three.js uses a right-handed **Y-up** coordinate system by default (`X_3js`, `Y_3js`, `Z_3js`).
To display the aircraft upright with nose pointing along `-Z_3js` (or `+X_3js`) and starboard to the right while preserving a right-handed coordinate system (`det = +1`):

Let:
- `X_3js = -Y_mx`  (or `Y_mx` if nose points `-Z_3js`)
Let's use the clean right-handed mapping:
- `X_3js = +X_mx` (Nose forward = `+X_3js`)
- `Y_3js = -Z_mx` (Upward = `+Y_3js`, since `-Z_mx` is up)
- `Z_3js = +Y_mx` (Starboard = `+Z_3js`)

Check handedness (determinant of transformation matrix):
```
|  1   0   0 |
|  0   0  -1 |  => det = 1 * (0 - (-1)) = +1 (Right-handed!)
|  0   1   0 |
```
Inverse mapping (Three.js -> MachUpX):
- `X_mx = +X_3js`
- `Y_mx = +Z_3js`
- `Z_mx = -Y_3js`

In Three.js, we can either apply this transform at the root aircraft group (`rotation.x = -Math.PI/2`? Wait: `rotation.x = -pi/2` maps `(x, y, z) -> (x, z, -y)`, which is `X_3js = X_mx`, `Y_3js = Z_mx`, `Z_3js = -Y_mx` — that makes `+Z_mx` UP! Instead, `rotation.x = +Math.PI/2` maps `(x, y, z) -> (x, -z, y)`, so `X_3js = X_mx`, `Y_3js = -Z_mx` (UP!), `Z_3js = +Y_mx` (Starboard)!).
Let's verify:
For `(0, 0, -1)` (up in MachUpX):
`Rx(+90°)` = `[[1, 0, 0], [0, 0, -1], [0, 1, 0]]` * `[0, 0, -1]^T` = `[0, +1, 0]^T` (+Y_3js = UP!).
For `(1, 0, 0)` (nose in MachUpX):
`Rx(+90°)` * `[1, 0, 0]^T` = `[1, 0, 0]^T` (+X_3js = Nose!).
For `(0, 1, 0)` (starboard in MachUpX):
`Rx(+90°)` * `[0, 1, 0]^T` = `[0, 0, 1]^T` (+Z_3js = Starboard!).

So a single Three.js `Group` with `group.rotation.x = Math.PI / 2` converts MachUpX body-fixed coordinates directly into Three.js Y-up space cleanly!

## 4. Wing Angles & Twist Convention

- **Dihedral** (`degrees`): positive dihedral tips the right wing upward (`-z` in MachUpX body frame).
- **Sweep** (`degrees`): positive sweep sweeps the wing aft (`-x` in MachUpX body frame).
- **Twist** (`degrees`): MachUpX accepts `[[span_frac, angle_deg], ...]`.
  - Positive twist = nose-up (leading edge up, trailing edge down).
  - Prototype convention `[[0, mount_angle], [1, mount_angle - washout]]` gives positive `mount_angle` at root and `washout` decreasing incidence toward the tip, which matches standard aerospace washout.
- **Control Surfaces**:
  - `is_symmetric: true` (e.g., `elevator`, `flap`): positive deflection deflects trailing edge **downward** on both left and right wings (producing positive lift / negative pitching moment `Cm,delevator < 0`, verified in `Traditional` run: `Cm,delevator = -4.8378`, `CL,delevator = +1.6821`).
  - `is_symmetric: false` (e.g., `aileron`, `rudder`): asymmetric deflection between left and right wings (`Cl,daileron = -0.4813`).
