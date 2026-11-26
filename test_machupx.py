#!/usr/bin/env python3
"""Run both MachUpX examples headless, verify results, and export STL for axis check."""

import sys, os, json, tempfile
import matplotlib
matplotlib.use('Agg')  # headless

import machupX as MX
import numpy as np

def run_traditional():
    print("=" * 60)
    print("TRADITIONAL AIRPLANE EXAMPLE")
    print("=" * 60)
    
    base_dir = os.path.dirname(os.path.abspath(__file__))
    ex_dir = os.path.join(base_dir, "vendor", "MachUpX", "examples", "Traditional")
    os.chdir(ex_dir)
    scene = MX.Scene("traditional_input.json")
    
    # Solve forces (dimensional)
    FM = scene.solve_forces(dimensional=True, non_dimensional=True, verbose=True)
    print("\n--- TOTAL FORCES (dimensional) ---")
    print(json.dumps(FM["traditional_airplane"]["total"], indent=4))
    
    # Pitch trim
    trim = scene.pitch_trim(set_trim_state=True, verbose=True)
    print("\n--- PITCH TRIM ---")
    print(json.dumps(trim["traditional_airplane"], indent=4))
    
    # Derivatives (after trim)
    derivs = scene.derivatives()
    print("\n--- DERIVATIVES ---")
    print(json.dumps(derivs["traditional_airplane"], indent=4))
    
    # Stability derivatives
    stab_derivs = scene.stability_derivatives()
    print("\n--- STABILITY DERIVATIVES ---")
    print(json.dumps(stab_derivs["traditional_airplane"], indent=4))
    
    # Damping derivatives
    damp_derivs = scene.damping_derivatives()
    print("\n--- DAMPING DERIVATIVES ---")
    print(json.dumps(damp_derivs["traditional_airplane"], indent=4))
    
    # Control derivatives
    ctrl_derivs = scene.control_derivatives()
    print("\n--- CONTROL DERIVATIVES ---")
    print(json.dumps(ctrl_derivs["traditional_airplane"], indent=4))
    
    # Aero center
    ac = scene.aero_center(verbose=True)
    print("\n--- AERO CENTER ---")
    print(json.dumps(ac["traditional_airplane"], indent=4))
    
    # Distributions
    dist = scene.distributions()
    print("\n--- DISTRIBUTIONS (segments & cpx/cpy/cpz ranges) ---")
    for seg_name, seg_data in dist["traditional_airplane"].items():
        if isinstance(seg_data, dict) and "cpx" in seg_data:
            cpx = np.array(seg_data["cpx"])
            cpy = np.array(seg_data["cpy"])
            cpz = np.array(seg_data["cpz"])
            print(f"  {seg_name}: cpx=[{cpx.min():.3f},{cpx.max():.3f}], cpy=[{cpy.min():.3f},{cpy.max():.3f}], cpz=[{cpz.min():.3f},{cpz.max():.3f}]")
        else:
            print(f"  {seg_name}: {type(seg_data).__name__}")
    
    # Reference geometry
    ref = scene.get_aircraft_reference_geometry("traditional_airplane")
    print("\n--- REFERENCE GEOMETRY ---")
    print(f"  S_w = {ref[0]}, l_ref_lon = {ref[1]}, l_ref_lat = {ref[2]}")
    
    # MAC
    mac = scene.MAC()
    print("\n--- MAC ---")
    print(json.dumps(mac, indent=4, default=str))
    
    # Save wireframe (to file, no display)
    wf_file = os.path.join(base_dir, "traditional_wireframe.png")
    scene.display_wireframe(show_legend=True, filename=wf_file)
    print(f"--- Wireframe saved to {wf_file} ---")
    
    # Test STL export using a copy of airplane JSON with NACA geometry defined
    with open("traditional_airplane.json") as f:
        ap_dict = json.load(f)
    ap_dict["airfoils"]["NACA_2410"]["geometry"] = {"NACA": "2410"}
    ap_dict["airfoils"]["NACA_0010"]["geometry"] = {"NACA": "0010"}
    with open("traditional_input.json") as f:
        sc_dict = json.load(f)
    sc_dict["scene"]["aircraft"]["traditional_airplane"]["file"] = ap_dict
    stl_scene = MX.Scene(sc_dict)
    stl_file = os.path.join(base_dir, "traditional.stl")
    stl_scene.export_stl(filename=stl_file)
    print(f"\n--- STL exported to {stl_file} ---")
    
    return FM, derivs

def run_flying_wing():
    print("\n" + "=" * 60)
    print("FLYING WING EXAMPLE")
    print("=" * 60)
    
    base_dir = os.path.dirname(os.path.abspath(__file__))
    ex_dir = os.path.join(base_dir, "vendor", "MachUpX", "examples", "FlyingWing")
    os.chdir(ex_dir)
    scene = MX.Scene("flying_wing_input.json")
    
    # Solve forces
    FM = scene.solve_forces(dimensional=True, non_dimensional=True, verbose=True)
    print("\n--- TOTAL FORCES (dimensional) ---")
    print(json.dumps(FM["flying_wing"]["total"], indent=4))
    
    # Pitch trim
    trim = scene.pitch_trim(set_trim_state=True, verbose=True)
    print("\n--- PITCH TRIM ---")
    print(json.dumps(trim["flying_wing"], indent=4))
    
    # Derivatives
    derivs = scene.derivatives()
    print("\n--- DERIVATIVES ---")
    print(json.dumps(derivs["flying_wing"], indent=4))
    
    # Aero center
    ac = scene.aero_center(verbose=True)
    print("\n--- AERO CENTER ---")
    print(json.dumps(ac["flying_wing"], indent=4))
    
    # STL with NACA geometry
    with open("flying_wing.json") as f:
        fw_ap = json.load(f)
    fw_ap["airfoils"]["NACA_0010"]["geometry"] = {"NACA": "0010"}
    with open("flying_wing_input.json") as f:
        fw_sc = json.load(f)
    fw_sc["scene"]["aircraft"]["flying_wing"]["file"] = fw_ap
    fw_stl_scene = MX.Scene(fw_sc)
    stl_file = os.path.join(base_dir, "flying_wing.stl")
    fw_stl_scene.export_stl(filename=stl_file)
    print(f"\n--- STL exported to {stl_file} ---")
    
    return FM, derivs

def verify_stl_axes(stl_file, label):
    """Read STL and print bounding box to verify axis convention."""
    from stl import mesh
    m = mesh.Mesh.from_file(stl_file)
    print(f"\n--- STL AXIS CHECK: {label} ---")
    print(f"  X range: {m.x.min():.4f} to {m.x.max():.4f}")
    print(f"  Y range: {m.y.min():.4f} to {m.y.max():.4f}")
    print(f"  Z range: {m.z.min():.4f} to {m.z.max():.4f}")
    # For traditional airplane:
    # If x-forward: main wing x ≈ 0, h_stab x ≈ -3 (aft), so x range should include negative
    # If y-right: main wing y spans ±4 (semispan 4, side "both")
    # If z-down: v_stab dz=-0.1 means upward, dihedral 90 means it goes in -z direction (up)

if __name__ == "__main__":
    trad_FM, trad_derivs = run_traditional()
    fw_FM, fw_derivs = run_flying_wing()
    
    verify_stl_axes(os.path.join(os.path.dirname(__file__), "traditional.stl"), "Traditional")
    verify_stl_axes(os.path.join(os.path.dirname(__file__), "flying_wing.stl"), "Flying Wing")
    
    print("\n\nALL TESTS COMPLETED SUCCESSFULLY")
