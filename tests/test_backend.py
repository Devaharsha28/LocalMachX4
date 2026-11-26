"""Unit and integration tests for the MachUpX backend runner and FastAPI app."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from server.app import app
from server.runner import run_machupx_task

BASE_DIR = Path(__file__).resolve().parent.parent
EXAMPLES_DIR = BASE_DIR / "vendor" / "MachUpX" / "examples"

client = TestClient(app)


def _load_example(folder: str, sc_name: str, ap_name: str):
    with open(EXAMPLES_DIR / folder / sc_name, "r", encoding="utf-8") as f:
        scene = json.load(f)
    with open(EXAMPLES_DIR / folder / ap_name, "r", encoding="utf-8") as f:
        aircraft = json.load(f)
    return scene, aircraft


def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_traditional_solve_matches_machupx():
    scene, aircraft = _load_example("Traditional", "traditional_input.json", "traditional_airplane.json")
    r = client.post("/api/solve", json={"scene": scene, "aircraft": aircraft, "aircraft_name": "traditional_airplane"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["ok"] is True
    assert data["reference_geometry"]["area"] == pytest.approx(8.0)
    total = data["forces"]["total"]
    assert total["CL"] == pytest.approx(0.36515823, rel=1e-4)
    assert total["CD"] == pytest.approx(0.01490185, rel=1e-4)
    assert total["Cm"] == pytest.approx(-0.11220139, rel=1e-4)


def test_traditional_trim_and_derivatives():
    scene, aircraft = _load_example("Traditional", "traditional_input.json", "traditional_airplane.json")
    r = client.post("/api/trim", json={"scene": scene, "aircraft": aircraft, "aircraft_name": "traditional_airplane"})
    assert r.status_code == 200, r.text
    trim = r.json()["trim"]
    assert trim["alpha"] == pytest.approx(10.6524976, rel=1e-4)
    assert trim["elevator"] == pytest.approx(-8.6559178, rel=1e-4)

    r_der = client.post("/api/derivatives", json={"scene": scene, "aircraft": aircraft, "aircraft_name": "traditional_airplane"})
    assert r_der.status_code == 200, r_der.text
    stab = r_der.json()["derivatives"]["stability"]
    assert stab["CL,a"] > 5.0
    assert stab["Cm,a"] < 0.0  # statically stable


def test_flying_wing_full_and_distributions():
    scene, aircraft = _load_example("FlyingWing", "flying_wing_input.json", "flying_wing.json")
    r = client.post("/api/full", json={"scene": scene, "aircraft": aircraft, "aircraft_name": "flying_wing"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert "forces" in data
    assert "derivatives" in data
    assert "distributions" in data
    assert "aero_center" in data
    assert "main_wing_right" in data["distributions"]
    assert len(data["distributions"]["main_wing_right"]["cpx"]) > 0


def test_export_stl():
    scene, aircraft = _load_example("Traditional", "traditional_input.json", "traditional_airplane.json")
    r = client.post("/api/export_stl", json={"scene": scene, "aircraft": aircraft, "aircraft_name": "traditional_airplane"})
    assert r.status_code == 200
    assert len(r.content) > 1000


def test_error_translation_missing_elevator():
    scene, aircraft = _load_example("Traditional", "traditional_input.json", "traditional_airplane.json")
    del aircraft["controls"]["elevator"]
    del aircraft["wings"]["h_stab"]["control_surface"]
    r = client.post("/api/trim", json={"scene": scene, "aircraft": aircraft, "aircraft_name": "traditional_airplane"})
    assert r.status_code == 400
    assert "elevator" in r.json()["detail"].lower()
