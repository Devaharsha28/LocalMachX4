"""Subprocess-isolated MachUpX solver runner.

Executes MachUpX Scene analyses in a temporary directory and returns
JSON-serializable results with plain-language error translation.
"""

from __future__ import annotations

import json
import math
import os
import re
import sys
import tempfile
import traceback
from typing import Any, Dict

import matplotlib
matplotlib.use("Agg")
import numpy as np
import machupX as MX


def _to_jsonable(obj: Any) -> Any:
    """Recursively convert numpy types/arrays and NaN/Inf into JSON-safe values."""
    if isinstance(obj, dict):
        return {k: _to_jsonable(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_to_jsonable(v) for v in obj]
    if isinstance(obj, np.ndarray):
        return [_to_jsonable(v) for v in obj.tolist()]
    if isinstance(obj, (np.floating, float)):
        val = float(obj)
        if math.isnan(val) or math.isinf(val):
            return None
        return val
    if isinstance(obj, (np.integer, int)):
        return int(obj)
    if isinstance(obj, (np.bool_, bool)):
        return bool(obj)
    return obj


def translate_error(exc: Exception) -> str:
    """Translate common MachUpX exceptions into actionable user messages."""
    msg = str(exc)
    if "Cannot find file" in msg:
        return f"Missing input file reference: {msg}"
    if "did not converge" in msg.lower() or "convergence" in msg.lower():
        return (
            f"Solver did not converge: {msg}. Try switching solver type to 'linear', "
            "increasing max_iterations, or lowering relaxation (e.g. 0.5)."
        )
    if "not defined for airfoil" in msg or "Outline points cannot be generated" in msg:
        return (
            f"Airfoil geometry missing for STL export: {msg}. "
            "Specify a NACA code (e.g. '2410' or 'NACA 2410') in Root/Tip Airfoil."
        )
    if "elevator" in msg.lower() and "control" in msg.lower():
        return (
            f"Pitch trim control error: {msg}. Ensure at least one wing has a "
            "Control Surface with Elevator Mix > 0 and 'elevator' is in controls."
        )
    if "Singular matrix" in msg or "LinAlgError" in type(exc).__name__:
        return (
            "Singular aerodynamic matrix. Check that all wings have positive semispan "
            "and chord, and that no two identical lifting segments overlap exactly."
        )
    if "ID" in msg and "0" in msg:
        return f"Invalid wing ID: {msg}. Wing segment IDs must be positive integers (>= 1)."
    return f"{type(exc).__name__}: {msg}"


def _prepare_airfoil_geometry_for_stl(aircraft_dict: Dict[str, Any]) -> Dict[str, Any]:
    """Ensure airfoils have geometry defined for STL export if their name is NACA-like."""
    ap = json.loads(json.dumps(aircraft_dict))
    for name, af in ap.get("airfoils", {}).items():
        if "geometry" not in af or not af["geometry"]:
            m = re.search(r"(\d{4,5})", name)
            if m:
                af["geometry"] = {"NACA": m.group(1)}
            else:
                af["geometry"] = {"NACA": "0012"}
    return ap


def run_machupx_task(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Run a MachUpX analysis task inside an isolated temporary directory."""
    action = payload.get("action", "solve")
    scene_data = json.loads(json.dumps(payload["scene"]))
    aircraft_data = json.loads(json.dumps(payload["aircraft"]))
    options = payload.get("options", {})

    aircraft_dict = scene_data.get("scene", {}).get("aircraft", {})
    if not aircraft_dict:
        raise ValueError("Scene JSON must define at least one aircraft under scene.aircraft.")

    aircraft_name = payload.get("aircraft_name") or next(iter(aircraft_dict.keys()))
    if aircraft_name not in aircraft_dict:
        raise ValueError(f"Aircraft '{aircraft_name}' not found in scene.aircraft.")

    if action == "export_stl":
        aircraft_data = _prepare_airfoil_geometry_for_stl(aircraft_data)

    orig_cwd = os.getcwd()
    try:
        with tempfile.TemporaryDirectory(prefix="machupx_") as tmpdir:
            aircraft_path = os.path.join(tmpdir, "aircraft.json")
            scene_path = os.path.join(tmpdir, "scene.json")

            with open(aircraft_path, "w", encoding="utf-8") as f:
                json.dump(aircraft_data, f, indent=2)

            scene_data["scene"]["aircraft"][aircraft_name]["file"] = "aircraft.json"
            # Remove "run" block so MX.Scene() doesn't auto-run unwanted steps
            scene_data.pop("run", None)

            with open(scene_path, "w", encoding="utf-8") as f:
                json.dump(scene_data, f, indent=2)

            os.chdir(tmpdir)
            scene = MX.Scene("scene.json")

            S_w, l_lon, l_lat = scene.get_aircraft_reference_geometry(aircraft_name)
            result: Dict[str, Any] = {
                "ok": True,
                "aircraft_name": aircraft_name,
                "reference_geometry": {
                    "area": float(S_w),
                    "longitudinal_length": float(l_lon),
                    "lateral_length": float(l_lat),
                },
            }

            if action == "solve":
                fm = scene.solve_forces(
                    dimensional=True,
                    non_dimensional=True,
                    body_frame=True,
                    stab_frame=True,
                    wind_frame=True,
                    report_by_segment=True,
                    verbose=False,
                )
                result["forces"] = _to_jsonable(fm.get(aircraft_name, {}))

            elif action == "trim":
                trim_res = scene.pitch_trim(
                    aircraft=aircraft_name,
                    set_trim_state=True,
                    verbose=False,
                    **{k: v for k, v in options.items() if k in ("CL", "Cm", "pitch_control", "max_iterations", "relaxation")},
                )
                fm = scene.solve_forces(
                    dimensional=True,
                    non_dimensional=True,
                    body_frame=True,
                    stab_frame=True,
                    wind_frame=True,
                    verbose=False,
                )
                result["trim"] = _to_jsonable(trim_res.get(aircraft_name, {}))
                result["forces"] = _to_jsonable(fm.get(aircraft_name, {}))

            elif action == "derivatives":
                derivs = scene.derivatives()
                result["derivatives"] = _to_jsonable(derivs.get(aircraft_name, {}))

            elif action == "aero_center":
                ac = scene.aero_center(aircraft=aircraft_name, verbose=False)
                result["aero_center"] = _to_jsonable(ac.get(aircraft_name, {}))

            elif action == "target_cl":
                cl_target = float(options.get("CL", 0.4))
                alpha_res = scene.target_CL(CL=cl_target, set_state=True, verbose=False)
                fm = scene.solve_forces(
                    dimensional=True,
                    non_dimensional=True,
                    body_frame=True,
                    stab_frame=True,
                    wind_frame=True,
                    report_by_segment=True,
                    verbose=False,
                )
                result["target_cl"] = {"alpha": float(alpha_res), "CL": cl_target}
                result["forces"] = _to_jsonable(fm.get(aircraft_name, {}))

            elif action == "stall_onset":
                # Sweep alpha using MachUpX solver to find first section reaching airfoil CL_max
                cl_max_limit = min(
                    (float(af.get("CL_max", 1.4)) for af in aircraft_data.get("airfoils", {}).values()),
                    default=1.4,
                )
                stall_info = None
                last_fm = None
                base_state = dict(scene_data["scene"]["aircraft"][aircraft_name].get("state", {}))
                if "velocity" not in base_state:
                    base_state["velocity"] = 100.0
                for a_deg in [float(x) for x in range(0, 26)]:
                    step_state = dict(base_state)
                    step_state["alpha"] = a_deg
                    scene.set_aircraft_state(aircraft=aircraft_name, state=step_state)
                    fm = scene.solve_forces(
                        dimensional=True,
                        non_dimensional=True,
                        body_frame=True,
                        stab_frame=True,
                        wind_frame=True,
                        verbose=False,
                    )
                    dist = scene.distributions()
                    ac_dist = dist.get(aircraft_name, {})
                    max_sec_cl = -1e9
                    max_seg = None
                    for seg_name, seg_data in ac_dist.items():
                        if isinstance(seg_data, dict) and "CL" in seg_data:
                            sec_cls = seg_data["CL"]
                            if len(sec_cls) > 0:
                                m = float(max(sec_cls))
                                if m > max_sec_cl:
                                    max_sec_cl = m
                                    max_seg = seg_name
                    last_fm = fm
                    if max_sec_cl >= cl_max_limit:
                        stall_info = {
                            "alpha": a_deg,
                            "CL": float(fm.get(aircraft_name, {}).get("total", {}).get("CL", 0.0)),
                            "max_section_CL": max_sec_cl,
                            "CL_max_limit": cl_max_limit,
                            "segment": max_seg,
                        }
                        break
                if stall_info is None:
                    stall_info = {
                        "alpha": 25.0,
                        "CL": float((last_fm or {}).get(aircraft_name, {}).get("total", {}).get("CL", 0.0)),
                        "max_section_CL": None,
                        "CL_max_limit": cl_max_limit,
                        "segment": None,
                    }
                result["stall_onset"] = stall_info
                result["forces"] = _to_jsonable((last_fm or {}).get(aircraft_name, {}))

            elif action == "distributions":
                scene.solve_forces(dimensional=True, non_dimensional=True, verbose=False)
                dist = scene.distributions()
                result["distributions"] = _to_jsonable(dist.get(aircraft_name, {}))

            elif action == "full":
                fm = scene.solve_forces(
                    dimensional=True,
                    non_dimensional=True,
                    body_frame=True,
                    stab_frame=True,
                    wind_frame=True,
                    report_by_segment=True,
                    verbose=False,
                )
                result["forces"] = _to_jsonable(fm.get(aircraft_name, {}))

                dist = scene.distributions()
                result["distributions"] = _to_jsonable(dist.get(aircraft_name, {}))

                derivs = scene.derivatives()
                result["derivatives"] = _to_jsonable(derivs.get(aircraft_name, {}))

                ac = scene.aero_center(aircraft=aircraft_name, verbose=False)
                result["aero_center"] = _to_jsonable(ac.get(aircraft_name, {}))

                if options.get("run_trim", False):
                    try:
                        trim_res = scene.pitch_trim(
                            aircraft=aircraft_name,
                            set_trim_state=False,
                            verbose=False,
                        )
                        result["trim"] = _to_jsonable(trim_res.get(aircraft_name, {}))
                    except Exception as trim_exc:
                        result["trim_error"] = translate_error(trim_exc)

            elif action == "export_stl":
                stl_path = os.path.join(tmpdir, f"{aircraft_name}.stl")
                scene.export_stl(filename=stl_path, aircraft=aircraft_name)
                with open(stl_path, "rb") as sf:
                    import base64
                    result["stl_base64"] = base64.b64encode(sf.read()).decode("ascii")
                    result["filename"] = f"{aircraft_name}.stl"
            else:
                raise ValueError(f"Unknown action: {action}")

            return result
    finally:
        os.chdir(orig_cwd)


if __name__ == "__main__":
    # CLI mode for subprocess isolation: reads JSON from stdin or file arg, writes JSON to stdout
    try:
        if len(sys.argv) > 1:
            with open(sys.argv[1], "r", encoding="utf-8") as f:
                req = json.load(f)
        else:
            req = json.load(sys.stdin)
        out = run_machupx_task(req)
        sys.stdout.write(json.dumps(out))
    except Exception as exc:
        sys.stdout.write(
            json.dumps(
                {
                    "ok": False,
                    "error": translate_error(exc),
                    "detail": traceback.format_exc(),
                }
            )
        )
        sys.exit(1)
