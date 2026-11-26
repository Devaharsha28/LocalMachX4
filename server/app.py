"""FastAPI backend for MachUpX Aircraft Design GUI."""

from __future__ import annotations

import base64
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any, Dict, Optional

import signal
import threading

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / "static"
EXAMPLES_DIR = BASE_DIR / "vendor" / "MachUpX" / "examples"

app = FastAPI(title="MachUpX Local GUI", version="0.1.0")

if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


class SolveRequest(BaseModel):
    scene: Dict[str, Any]
    aircraft: Dict[str, Any]
    aircraft_name: Optional[str] = None
    options: Dict[str, Any] = Field(default_factory=dict)


def _invoke_runner(action: str, req: SolveRequest, timeout: int = 60) -> Dict[str, Any]:
    """Run MachUpX in an isolated subprocess to prevent solver crashes from taking down the server."""
    payload = {
        "action": action,
        "scene": req.scene,
        "aircraft": req.aircraft,
        "aircraft_name": req.aircraft_name,
        "options": req.options,
    }
    env = os.environ.copy()
    env.setdefault("MPLCONFIGDIR", os.path.join(tempfile.gettempdir(), "mpl"))

    try:
        proc = subprocess.run(
            [sys.executable, "-m", "server.runner"],
            input=json.dumps(payload),
            text=True,
            capture_output=True,
            cwd=str(BASE_DIR),
            env=env,
            timeout=timeout,
        )
    except subprocess.TimeoutExpired:
        raise HTTPException(
            status_code=504,
            detail=f"MachUpX solver timed out after {timeout}s. Try reducing Spanwise Segments (N) or using the linear solver.",
        )

    stdout = proc.stdout.strip()
    if not stdout:
        raise HTTPException(
            status_code=500,
            detail=f"MachUpX subprocess produced no output (exit {proc.returncode}): {proc.stderr[-500:]}",
        )

    # MachUpX prints progress lines to stdout before our runner's JSON?
    # Wait: if MachUpX prints to stdout when verbose=True, capture last JSON line or use a dedicated fd.
    # Let's parse from the last '{' if needed, though verbose=False keeps stdout clean.
    try:
        data = json.loads(stdout)
    except json.JSONDecodeError:
        idx = stdout.rfind('{"ok":')
        if idx != -1:
            data = json.loads(stdout[idx:])
        else:
            raise HTTPException(
                status_code=500,
                detail=f"Invalid JSON from MachUpX runner: {stdout[-500:]}",
            )

    if not data.get("ok"):
        raise HTTPException(status_code=400, detail=data.get("error", "MachUpX error"))

    return data


@app.post("/api/shutdown")
def api_shutdown() -> Dict[str, str]:
    """Gracefully stop the server (used by File > Exit in the UI)."""
    threading.Timer(0.5, lambda: os.kill(os.getpid(), signal.SIGTERM)).start()
    return {"status": "shutting down"}


@app.get("/api/health")
def health() -> Dict[str, str]:
    return {"status": "ok", "solver": "MachUpX 2.7.2"}


@app.get("/")
def index():
    index_path = STATIC_DIR / "index.html"
    if not index_path.exists():
        return JSONResponse({"status": "backend ready", "message": "static/index.html not built yet"})
    return FileResponse(str(index_path))


@app.post("/api/solve")
def api_solve(req: SolveRequest) -> Dict[str, Any]:
    return _invoke_runner("solve", req)


@app.post("/api/trim")
def api_trim(req: SolveRequest) -> Dict[str, Any]:
    return _invoke_runner("trim", req)


@app.post("/api/derivatives")
def api_derivatives(req: SolveRequest) -> Dict[str, Any]:
    return _invoke_runner("derivatives", req)


@app.post("/api/distributions")
def api_distributions(req: SolveRequest) -> Dict[str, Any]:
    return _invoke_runner("distributions", req)


@app.post("/api/aero_center")
def api_aero_center(req: SolveRequest) -> Dict[str, Any]:
    return _invoke_runner("aero_center", req)


@app.post("/api/target_cl")
def api_target_cl(req: SolveRequest) -> Dict[str, Any]:
    return _invoke_runner("target_cl", req)


@app.post("/api/stall_onset")
def api_stall_onset(req: SolveRequest) -> Dict[str, Any]:
    return _invoke_runner("stall_onset", req)


@app.post("/api/full")
def api_full(req: SolveRequest) -> Dict[str, Any]:
    return _invoke_runner("full", req, timeout=90)


@app.post("/api/export_stl")
def api_export_stl(req: SolveRequest):
    data = _invoke_runner("export_stl", req)
    stl_bytes = base64.b64decode(data["stl_base64"])
    filename = data.get("filename", "aircraft.stl")
    return Response(
        content=stl_bytes,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.get("/api/examples/{name}")
def api_get_example(name: str) -> Dict[str, Any]:
    mapping = {
        "traditional": ("Traditional", "traditional_input.json", "traditional_airplane.json"),
        "flying_wing": ("FlyingWing", "flying_wing_input.json", "flying_wing.json"),
    }
    if name not in mapping:
        raise HTTPException(status_code=404, detail=f"Unknown example '{name}'. Available: {list(mapping.keys())}")
    folder, sc_file, ap_file = mapping[name]
    ex_dir = EXAMPLES_DIR / folder
    with open(ex_dir / sc_file, "r", encoding="utf-8") as f:
        scene = json.load(f)
    with open(ex_dir / ap_file, "r", encoding="utf-8") as f:
        aircraft = json.load(f)
    aircraft_name = next(iter(scene["scene"]["aircraft"].keys()))
    return {"name": name, "aircraft_name": aircraft_name, "scene": scene, "aircraft": aircraft}
