# Known Limitations & Deviations from Original MachUp 4/5

1. **Cosmetic Primitives (`Box`, `Cylinder`, `Sphere`)**: Rendered in the 3D viewport for fuselage/tailboom visualization and saved in project JSON, but **not** exported to MachUpX (MachUpX is a lifting-line solver and models lifting surfaces only).
2. **Airfoil Models**: The sidebar currently exposes `linear` airfoil coefficients (`aL0`, `CLa`, `CmL0`, `Cma`, `CD0`, `CD1`, `CD2`, `CL_max`) plus NACA name for 3D/STL geometry. Nonlinear `database` (`airfoil_db`) and `poly_fit` airfoil types supported by MachUpX are not yet exposed in the sidebar form (though they can be imported/run via raw JSON).
3. **Propellers**: Not implemented in the `Add` menu (MachUpX focuses on lifting surfaces).
4. **Control Surface Chordwise Distribution**: The 3D viewport renders a simplified flat control-surface flap quad; MachUpX itself computes full lifting-line aerodynamics using `chord_fraction`, `root_span`, `tip_span`, and `is_sealed`.
5. **Single-Aircraft Scene**: The GUI edits one aircraft at a time (multi-aircraft formation scenes from MachUpX are not exposed in the GUI).
6. **Headless STL Export**: Requires a NACA code (e.g. `2410`, `0012`) in the airfoil name or `geometry` field; the backend automatically infers NACA geometry from the airfoil name if omitted.
